import asyncio
import xml.etree.ElementTree as ET
import httpx

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
CTGOV = "https://clinicaltrials.gov/api/v2/studies"
OPENTARGETS = "https://api.platform.opentargets.org/api/v4/graphql"
CHEMBL = "https://www.ebi.ac.uk/chembl/api/data"
REACTOME = "https://reactome.org/AnalysisService/identifiers/projection"
AD_EFO = "MONDO_0004975"
_ncbi_lock = asyncio.Lock()


async def _ncbi(c, path, params):
    async with _ncbi_lock:
        r = await c.get(f"{EUTILS}/{path}", params=params)
        await asyncio.sleep(0.4)
        return r


async def pubmed_search(query: str, n: int = 8, alzheimer: bool = True, reldate: int = 1825, sort: str = "relevance"):
    term = f"({query}) AND alzheimer" if alzheimer else query
    async with httpx.AsyncClient(timeout=40) as c:
        r = await _ncbi(c, "esearch.fcgi", {"db": "pubmed", "term": term, "retmax": n, "retmode": "json",
                                            "sort": sort, "datetype": "pdat", "reldate": reldate})
        ids = r.json()["esearchresult"]["idlist"]
        if not ids:
            return []
        x = await _ncbi(c, "efetch.fcgi", {"db": "pubmed", "id": ",".join(ids), "retmode": "xml"})
    out = []
    for art in ET.fromstring(x.text).findall(".//PubmedArticle"):
        pmid = art.findtext(".//MedlineCitation/PMID")
        t = art.find(".//ArticleTitle")
        authors = []
        for a in art.findall(".//AuthorList/Author")[:6]:
            if a.findtext("LastName"):
                authors.append({"name": f"{a.findtext('ForeName') or ''} {a.findtext('LastName')}".strip(),
                                "affiliation": (a.findtext(".//AffiliationInfo/Affiliation") or "")[:200]})
        out.append({
            "pmid": pmid, "title": "".join(t.itertext()) if t is not None else "",
            "journal": art.findtext(".//Journal/Title") or "",
            "year": art.findtext(".//JournalIssue/PubDate/Year") or "",
            "abstract": " ".join("".join(a.itertext()) for a in art.findall(".//Abstract/AbstractText"))[:1400],
            "authors": authors, "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        })
    return out


async def pubmed_verify(pmids):
    ids = [p for p in pmids if str(p).isdigit()]
    if not ids:
        return {}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await _ncbi(c, "esummary.fcgi", {"db": "pubmed", "id": ",".join(ids), "retmode": "json"})
    res = r.json().get("result", {})
    return {p: (p in res and "error" not in res[p]) for p in ids}


async def trials_search(term: str, n: int = 10):
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(CTGOV, params={"query.cond": "Alzheimer Disease", "query.term": term, "pageSize": n})
    out = []
    for s in r.json().get("studies", []):
        p = s.get("protocolSection", {})
        nct = p.get("identificationModule", {}).get("nctId")
        elig = p.get("eligibilityModule", {})
        out.append({
            "nct_id": nct, "title": p.get("identificationModule", {}).get("briefTitle", ""),
            "status": p.get("statusModule", {}).get("overallStatus", ""),
            "phases": p.get("designModule", {}).get("phases", []),
            "enrollment": p.get("designModule", {}).get("enrollmentInfo", {}).get("count"),
            "interventions": [i.get("name") for i in p.get("armsInterventionsModule", {}).get("interventions", [])][:4],
            "primary_outcomes": [o.get("measure") for o in p.get("outcomesModule", {}).get("primaryOutcomes", [])][:3],
            "age_range": f"{elig.get('minimumAge', '?')}–{elig.get('maximumAge', '?')}", "sex": elig.get("sex"),
            "url": f"https://clinicaltrials.gov/study/{nct}",
        })
    return out


async def trials_verify(ncts):
    async with httpx.AsyncClient(timeout=30) as c:
        rs = await asyncio.gather(*[c.get(f"{CTGOV}/{n}", params={"fields": "NCTId"}) for n in ncts], return_exceptions=True)
    return {n: (not isinstance(r, Exception) and r.status_code == 200) for n, r in zip(ncts, rs)}


async def opentargets_ad(n: int = 30):
    q = """query($id:String!,$n:Int!){ disease(efoId:$id){ associatedTargets(page:{index:0,size:$n}){
      rows{ score datatypeScores{ id score } target{ id approvedSymbol approvedName } } } } }"""
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(OPENTARGETS, json={"query": q, "variables": {"id": AD_EFO, "n": n}})
    rows = r.json()["data"]["disease"]["associatedTargets"]["rows"]
    return [{"symbol": x["target"]["approvedSymbol"], "name": x["target"]["approvedName"], "ensembl": x["target"]["id"],
             "score": round(x["score"], 3), "evidence": {d["id"]: round(d["score"], 2) for d in x["datatypeScores"] if d["score"] > 0},
             "url": f"https://platform.opentargets.org/target/{x['target']['id']}"} for x in rows]


async def chembl_ad_drugs(n: int = 40):
    async with httpx.AsyncClient(timeout=40) as c:
        r = await c.get(f"{CHEMBL}/drug_indication.json", params={"efo_id": "MONDO:0004975", "limit": n, "order_by": "-max_phase_for_ind"})
        inds = r.json().get("drug_indications", [])
        ids = list(dict.fromkeys(i["parent_molecule_chembl_id"] for i in inds))
        if not ids:
            return []
        m, mech = await asyncio.gather(
            c.get(f"{CHEMBL}/molecule.json", params={"molecule_chembl_id__in": ",".join(ids), "limit": n}),
            c.get(f"{CHEMBL}/mechanism.json", params={"molecule_chembl_id__in": ",".join(ids), "limit": 100}))
    names = {x["molecule_chembl_id"]: x for x in m.json().get("molecules", [])}
    mechs = {}
    for x in mech.json().get("mechanisms", []):
        mechs.setdefault(x["molecule_chembl_id"], []).append(x.get("mechanism_of_action"))
    phase = {i["parent_molecule_chembl_id"]: i["max_phase_for_ind"] for i in inds}
    return [{"chembl_id": i, "name": (names.get(i) or {}).get("pref_name") or i, "ad_max_phase": phase.get(i),
             "approved_phase": (names.get(i) or {}).get("max_phase"), "mechanisms": mechs.get(i, []),
             "url": f"https://www.ebi.ac.uk/chembl/compound_report_card/{i}/"} for i in ids]


async def reactome_enrich(genes, n: int = 15):
    async with httpx.AsyncClient(timeout=40) as c:
        r = await c.post(REACTOME, params={"pageSize": n, "page": 1, "sortBy": "ENTITIES_PVALUE"},
                         content="\n".join(genes), headers={"Content-Type": "text/plain"})
    d = r.json()
    return [{"id": p["stId"], "name": p["name"], "found": p["entities"]["found"], "total": p["entities"]["total"],
             "p_value": p["entities"]["pValue"], "fdr": p["entities"]["fdr"],
             "url": f"https://reactome.org/content/detail/{p['stId']}"} for p in d.get("pathways", [])]

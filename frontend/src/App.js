import "@/App.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Docs from "@/pages/Docs";
import ResearchReport from "@/pages/ResearchReport";
import Dashboard from "@/pages/Dashboard";
import Runs from "@/pages/Runs";
import RunDetail from "@/pages/RunDetail";
import Insights from "@/pages/Insights";
import Agents from "@/pages/Agents";
import Audit from "@/pages/Audit";
import Schedules from "@/pages/Schedules";
import Memory from "@/pages/Memory";
import Goals from "@/pages/Goals";
import Orchestrator from "@/pages/Orchestrator";
import Chat from "@/pages/Chat";
import Bias from "@/pages/Bias";
import Settings from "@/pages/Settings";

const TITLES = [
  [/^\/$/, "OpenAlz · Self-Evolving Alzheimer's Research Foundry"],
  [/^\/doc\/research\//, "Research Report · OpenAlz"],
  [/^\/doc/, "Documentation & Research Library · OpenAlz"],
  [/^\/app\/runs\/.+/, "Research Run · OpenAlz"],
  [/^\/app\/runs/, "Research Runs · OpenAlz"],
  [/^\/app\/goals/, "Research Goals · OpenAlz"],
  [/^\/app\/insights/, "Insights · OpenAlz"],
  [/^\/app\/chat/, "Research Assistant · OpenAlz"],
  [/^\/app\/orchestrator/, "Orchestrator · OpenAlz"],
  [/^\/app\/schedules/, "Schedules · OpenAlz"],
  [/^\/app\/memory/, "Strategy Memory · OpenAlz"],
  [/^\/app\/agents/, "Agent Registry · OpenAlz"],
  [/^\/app\/bias/, "Bias Detection · OpenAlz"],
  [/^\/app\/audit/, "Audit Trail · OpenAlz"],
  [/^\/app\/settings/, "Settings · OpenAlz"],
  [/^\/app/, "Command Center · OpenAlz"],
];

const TitleSync = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = (TITLES.find(([re]) => re.test(pathname)) || TITLES[0])[1];
  }, [pathname]);
  return null;
};

function App() {
  return (
    <BrowserRouter>
      <TitleSync />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/doc" element={<Docs />} />
        <Route path="/docs" element={<Navigate to="/doc" replace />} />
        <Route path="/doc/research/:id" element={<ResearchReport />} />
        <Route path="/app" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="goals" element={<Goals />} />
          <Route path="runs" element={<Runs />} />
          <Route path="runs/:id" element={<RunDetail />} />
          <Route path="insights" element={<Insights />} />
          <Route path="chat" element={<Chat />} />
          <Route path="chat/:sid" element={<Chat />} />
          <Route path="orchestrator" element={<Orchestrator />} />
          <Route path="agents" element={<Agents />} />
          <Route path="audit" element={<Audit />} />
          <Route path="schedules" element={<Schedules />} />
          <Route path="memory" element={<Memory />} />
          <Route path="bias" element={<Bias />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/runs/:id" element={<Navigate to="/app/runs" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-center" />
    </BrowserRouter>
  );
}

export default App;

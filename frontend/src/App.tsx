import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import EndpointsPage from './pages/EndpointsPage';
import TestingPage from './pages/TestingPage';
import ExperimentDetailPage from './pages/ExperimentDetailPage';
import PromptsPage from './pages/PromptsPage';
import EvaluationHubPage from './pages/EvaluationHubPage';
import MigrationHubPage from './pages/MigrationHubPage';
import RAGPipelinePage from './pages/RAGPipelinePage';
import MonitoringPage from './pages/MonitoringPage';
import AboutPage from './pages/AboutPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/model-endpoints" element={<EndpointsPage />} />
        <Route path="/testing" element={<TestingPage />} />
        <Route path="/testing/:id" element={<ExperimentDetailPage />} />
        <Route path="/prompts" element={<PromptsPage />} />
        <Route path="/evaluation" element={<EvaluationHubPage />} />
        <Route path="/migration" element={<MigrationHubPage />} />
        <Route path="/rag" element={<RAGPipelinePage />} />
        <Route path="/monitoring" element={<MonitoringPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </Layout>
  );
}

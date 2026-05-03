import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { DatabasePage } from "@/pages/DatabasePage";
import { PageEditor } from "@/pages/PageEditor";
import { PagesHome } from "@/pages/PagesHome";
import { SettingsPage } from "@/pages/SettingsPage";
import { TemplatesPage } from "@/pages/TemplatesPage";

const qc = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<WorkspaceShell />}>
        <Route path="/" element={<Navigate to="/pages" replace />} />
        <Route path="/pages" element={<PagesHome />} />
        <Route path="/pages/p/:pageId" element={<PageEditor spaceId="" />} />
        <Route path="/pages/space/:spaceId" element={<Navigate to="/pages" replace />} />
        <Route path="/pages/db/:databaseId" element={<DatabasePage />} />
        <Route path="/pages/templates" element={<TemplatesPage />} />
        <Route path="/pages/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}


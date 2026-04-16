import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell.js";
import { Dashboard } from "./pages/Dashboard.js";
import { StudyBrowser } from "./pages/StudyBrowser.js";
import { StudyDetail } from "./pages/StudyDetail.js";
import { FhirExplorer } from "./pages/FhirExplorer.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="studies" element={<StudyBrowser />} />
          <Route path="studies/:studyUid" element={<StudyDetail />} />
          <Route path="fhir" element={<FhirExplorer />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

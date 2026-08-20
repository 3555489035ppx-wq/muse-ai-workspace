import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ToastStack } from "./components/ui";
import { MigrationService } from "./domain/services/MigrationService";
import { db } from "./db/database";
import { Phase0Recovery } from "./features/system/Phase0Recovery";
import { useMuseStore } from "./stores/useMuseStore";

const lazyNamed = (loader, name) => lazy(() => loader().then((module) => ({ default: module[name] })));
const loadProjectPages = () => import("./features/projects/ProjectPages");
const loadIndustrialPages = () => import("./features/industrial/IndustrialPages");
const LandingPage = lazyNamed(() => import("./features/landing/LandingPage"), "LandingPage");
const NewProjectPage = lazyNamed(loadProjectPages, "NewProjectPage");
const ProjectCreationProgressPage = lazyNamed(loadProjectPages, "ProjectCreationProgressPage");
const ProjectsPage = lazyNamed(loadProjectPages, "ProjectsPage");
const IndustrialBriefPage = lazyNamed(loadIndustrialPages, "IndustrialBriefPage");
const IndustrialCMFPage = lazyNamed(loadIndustrialPages, "IndustrialCMFPage");
const IndustrialConceptPage = lazyNamed(loadIndustrialPages, "IndustrialConceptPage");
const IndustrialDecisionMapPage = lazyNamed(loadIndustrialPages, "IndustrialDecisionMapPage");
const IndustrialDirectionPage = lazyNamed(loadIndustrialPages, "IndustrialDirectionPage");
const IndustrialInsightPage = lazyNamed(loadIndustrialPages, "IndustrialInsightPage");
const IndustrialOverviewPage = lazyNamed(loadIndustrialPages, "IndustrialOverviewPage");
const IndustrialResearchPage = lazyNamed(loadIndustrialPages, "IndustrialResearchPage");
const IndustrialReviewPage = lazyNamed(loadIndustrialPages, "IndustrialReviewPage");
const IndustrialVersionsPage = lazyNamed(loadIndustrialPages, "IndustrialVersionsPage");
const OnboardingTour = lazyNamed(() => import("./features/onboarding/OnboardingTour"), "OnboardingTour");
const TemplatesPage = lazyNamed(() => import("./features/library/GlobalLibraryPages"), "TemplatesPage");
const AssetsPage = lazyNamed(() => import("./features/library/GlobalLibraryPages"), "AssetsPage");
const DirectionLibraryPage = lazyNamed(() => import("./features/library/DirectionLibraryPage"), "DirectionLibraryPage");
const SettingsPage = lazyNamed(() => import("./features/system/SystemPages"), "SettingsPage");
const AccountPage = lazyNamed(() => import("./features/system/SystemPages"), "AccountPage");
const TrashPage = lazyNamed(() => import("./features/system/SystemPages"), "TrashPage");
const MusePortfolioPage = lazyNamed(() => import("./portfolio/muse"), "MusePortfolioPage");
const MuseShowreelPage = lazyNamed(() => import("./portfolio/muse/ShowreelPage"), "MuseShowreelPage");
const Phase0DebugPage = import.meta.env.DEV ? lazyNamed(() => import("./features/dev/Phase0DebugPage"), "Phase0DebugPage") : null;
const migrationService = new MigrationService(db);

function Startup() {
  const { pathname, search } = useLocation();
  const ready = useMuseStore((state) => state.ready);
  const initialize = useMuseStore((state) => state.initialize);
  const [migrationResult, setMigrationResult] = useState(null);
  const captureMode = new URLSearchParams(search).get("portfolio") === "true";
  const portfolioRoute = pathname.startsWith("/portfolio/muse");
  const landingRoute = pathname === "/";
  useEffect(() => {
    document.body.classList.toggle("portfolio-capture", captureMode);
    document.body.classList.toggle("muse-portfolio-active", portfolioRoute);
    document.body.classList.toggle("muse-landing-active", landingRoute);
    return () => {
      document.body.classList.remove("portfolio-capture", "muse-portfolio-active");
      document.body.classList.remove("muse-landing-active");
    };
  }, [captureMode, landingRoute, portfolioRoute]);
  useEffect(() => {
    migrationService.inspectAndMigrate().then((result) => {
      setMigrationResult(result);
      if (result.state !== "recovery_required") initialize();
    });
  }, [initialize]);
  const resolveRecovery = async (result) => {
    setMigrationResult(result);
    if (result.state !== "recovery_required") await initialize();
  };
  if (migrationResult?.state === "recovery_required") return <Phase0Recovery service={migrationService} result={migrationResult} onResolved={resolveRecovery} />;
  if (!ready || !migrationResult)
    return (
      <main className="app-loading">
        <span className="app-loading__mark">✦</span>
        <strong>Muse 正在准备你的创意工作台…</strong>
      </main>
    );
  return (
    <>
      <Suspense fallback={<main className="route-loading">正在打开页面…</main>}><Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/direction-library" element={<DirectionLibraryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/trash" element={<TrashPage />} />
        <Route path="/portfolio/muse" element={<MusePortfolioPage />} />
        <Route path="/portfolio/muse/presentation" element={<MusePortfolioPage />} />
        <Route path="/portfolio/muse/showreel" element={<MuseShowreelPage />} />
        <Route path="/projects/new" element={<NewProjectPage />} />
        <Route path="/projects/:projectId/creating" element={<ProjectCreationProgressPage />} />
        <Route path="/projects/:projectId/overview" element={<IndustrialOverviewPage />} />
        <Route path="/projects/:projectId/workspace" element={<IndustrialOverviewPage />} />
        <Route path="/projects/:projectId/brief" element={<IndustrialBriefPage />} />
        <Route path="/projects/:projectId/research" element={<IndustrialResearchPage />} />
        <Route path="/projects/:projectId/insight" element={<IndustrialInsightPage />} />
        <Route path="/projects/:projectId/moodboard" element={<IndustrialInsightPage />} />
        <Route path="/projects/:projectId/direction" element={<IndustrialDirectionPage />} />
        <Route path="/projects/:projectId/directions" element={<IndustrialDirectionPage />} />
        <Route path="/projects/:projectId/concept" element={<IndustrialConceptPage />} />
        <Route path="/projects/:projectId/exploration" element={<IndustrialConceptPage />} />
        <Route path="/projects/:projectId/cmf" element={<IndustrialCMFPage />} />
        <Route path="/projects/:projectId/review" element={<IndustrialReviewPage />} />
        <Route path="/projects/:projectId/critique" element={<IndustrialReviewPage />} />
        <Route path="/projects/:projectId/generation" element={<IndustrialConceptPage />} />
        <Route path="/projects/:projectId/versions" element={<IndustrialVersionsPage />} />
        <Route path="/projects/:projectId/decision-map" element={<IndustrialDecisionMapPage />} />
        {import.meta.env.DEV && Phase0DebugPage ? <Route path="/dev/phase0-debug" element={<Phase0DebugPage />} /> : null}
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes></Suspense>
      {!captureMode && !portfolioRoute && !landingRoute ? <ToastStack /> : null}
      {!captureMode && !portfolioRoute && !landingRoute ? <Suspense fallback={null}><OnboardingTour /></Suspense> : null}
    </>
  );
}

export function App() {
  return <Startup />;
}

import { ArrowUpRight, Clapperboard, MonitorPlay } from "lucide-react";
import { useLocation } from "react-router-dom";
import "./portfolio.css";
import { usePortfolioMotion } from "./usePortfolioMotion";
import {
  AIArchitectureSection,
  ConceptSection,
  ContextSection,
  DecisionMapSection,
  DirectionComparisonSection,
  DirectionHeroSection,
  EvidenceSection,
  FinalSystemSection,
  HeroSection,
  InsightSection,
  IterationSection,
  OpportunitySection,
  ProblemSection,
  ReflectionSection,
  ReviewSection,
  StrategySection,
  VersionSection,
  WorkflowSection,
} from "./sections";

const navItems = [
  ["Context", "#context"], ["Strategy", "#strategy"], ["Evidence", "#evidence"],
  ["Direction", "#direction"], ["Iteration", "#iteration"], ["Final", "#final-system"],
] as const;

export function MusePortfolioPage() {
  const { pathname } = useLocation();
  const presentation = pathname.endsWith("/presentation");
  usePortfolioMotion();
  return (
    <div className={`muse-portfolio ${presentation ? "is-presentation" : ""}`}>
      {!presentation ? (
        <header className="mp-nav">
          <a className="mp-nav__brand" href="#cover" aria-label="Muse Case Study 首页">MUSE / CASE 01</a>
          <nav aria-label="Case Study 章节">{navItems.map(([label, href]) => <a key={label} href={href}>{label}</a>)}</nav>
          <div className="mp-nav__modes">
            <a href="/portfolio/muse/presentation"><MonitorPlay aria-hidden="true" />Presentation</a>
            <a href="/portfolio/muse/showreel"><Clapperboard aria-hidden="true" />Showreel</a>
          </div>
        </header>
      ) : null}
      <main>
        <HeroSection />
        <ContextSection />
        <ProblemSection />
        <OpportunitySection />
        <StrategySection />
        <WorkflowSection />
        <EvidenceSection />
        <InsightSection />
        <DirectionHeroSection />
        <DirectionComparisonSection />
        <ConceptSection />
        <AIArchitectureSection />
        <IterationSection />
        <ReviewSection />
        <VersionSection />
        <DecisionMapSection />
        <FinalSystemSection />
        <ReflectionSection />
      </main>
      {!presentation ? <footer className="mp-footer"><span>Muse / AI Product Design / 2026</span><a href="#cover">Back to top <ArrowUpRight aria-hidden="true" /></a></footer> : null}
    </div>
  );
}

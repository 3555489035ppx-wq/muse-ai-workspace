import { useEffect, useMemo, useState } from "react";
import { Joyride, EVENTS, STATUS } from "react-joyride";
import { X } from "lucide-react";
import { onboardingSteps, TOUR_STORAGE_KEY } from "./tourConfig";

function MuseTourTooltip({
  backProps,
  closeProps,
  index,
  isLastStep,
  primaryProps,
  size,
  skipProps,
  step,
  tooltipProps,
}) {
  return (
    <section className="muse-tour" {...tooltipProps}>
      <header className="muse-tour__header">
        <span>快速认识 Muse</span>
        <button {...closeProps} className="muse-tour__close">
          <X size={17} />
        </button>
      </header>
      <div className="muse-tour__progress" aria-label={`第 ${index + 1} 步，共 ${size} 步`}>
        <span style={{ transform: `scaleX(${(index + 1) / size})` }} />
      </div>
      <div className="muse-tour__body">
        <small>{String(index + 1).padStart(2, "0")} / {String(size).padStart(2, "0")}</small>
        <h2>{step.title}</h2>
        <p>{step.content}</p>
      </div>
      <footer className="muse-tour__actions">
        <button {...skipProps} className="muse-tour__skip">跳过导览</button>
        <div>
          {index > 0 ? <button {...backProps}>上一步</button> : null}
          <button {...primaryProps} className="muse-tour__next">
            {isLastStep ? "开始创作" : "下一步"}
          </button>
        </div>
      </footer>
    </section>
  );
}

export function OnboardingTour() {
  const [run, setRun] = useState(false);
  const steps = useMemo(
    () => onboardingSteps.map((step) => ({ ...step, placement: "auto", skipBeacon: true })),
    [],
  );
  const [activeSteps, setActiveSteps] = useState(steps);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY) === "1";
    if (!completed && location.pathname === "/projects") {
      setActiveSteps(steps.filter((step) => document.querySelector(step.target)));
      localStorage.setItem(TOUR_STORAGE_KEY, "1");
      const timer = window.setTimeout(() => setRun(true), 500);
      return () => window.clearTimeout(timer);
    }
  }, []);

  return (
    <Joyride
      run={run}
      continuous
      scrollToFirstStep
      steps={activeSteps}
      tooltipComponent={MuseTourTooltip}
      locale={{ back: "上一步", close: "关闭", last: "开始创作", next: "下一步", skip: "跳过导览" }}
      options={{
        blockTargetInteraction: false,
        hideOverlay: false,
        overlayClickAction: false,
        dismissKeyAction: "close",
        showProgress: true,
        spotlightRadius: 14,
        scrollDuration: 260,
        scrollOffset: 96,
        zIndex: 1000,
      }}
      styles={{
        overlay: { backgroundColor: "var(--muse-tour-overlay)" },
        spotlight: { stroke: "var(--muse-tour-ring)", strokeWidth: 1 },
      }}
      onEvent={(data) => {
        if (data.type === EVENTS.TOUR_END || [STATUS.FINISHED, STATUS.SKIPPED].includes(data.status)) {
          localStorage.setItem(TOUR_STORAGE_KEY, "1");
          setRun(false);
        }
      }}
    />
  );
}

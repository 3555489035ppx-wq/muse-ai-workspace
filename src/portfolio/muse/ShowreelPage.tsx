import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { showreelTimeline } from "./content";
import { BrowserFrame } from "./mockups";
import "./portfolio.css";

const duration = 60;

export function MuseShowreelPage() {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const startedAt = useRef(performance.now());
  const pausedAt = useRef(0);

  useEffect(() => {
    if (!playing) return;
    startedAt.current = performance.now() - pausedAt.current * 1000;
    let frame = 0;
    const update = (now: number) => {
      const next = ((now - startedAt.current) / 1000) % duration;
      pausedAt.current = next;
      setElapsed(next);
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const active = showreelTimeline.find((scene) => elapsed >= scene.start && elapsed < scene.end) ?? showreelTimeline[0];
  const toggle = () => setPlaying((value) => !value);
  const restart = () => {
    pausedAt.current = 0;
    setElapsed(0);
    setPlaying(true);
  };

  return (
    <main className="mp-reel">
      <div className="mp-reel__brand"><span>MUSE</span><span>AI PRODUCT DESIGN / 60 SEC</span></div>
      <div className="mp-reel__stage" aria-live="off">
        {showreelTimeline.map((scene) => (
          <section key={scene.key} className={`mp-reel__scene ${scene.key === active.key ? "is-active" : ""}`} aria-hidden={scene.key !== active.key}>
            <div className="mp-reel__copy"><span>{String(scene.start).padStart(2, "0")}—{String(scene.end).padStart(2, "0")}</span><h1>{scene.label}</h1></div>
            <div className="mp-reel__visual">
              <BrowserFrame label={scene.key === "map" ? "Decision trace" : "Muse product interface"}>
                <img src={scene.screen} alt="" />
              </BrowserFrame>
            </div>
          </section>
        ))}
      </div>
      <div className="mp-reel__controls">
        <button type="button" onClick={toggle} aria-label={playing ? "暂停 Showreel" : "播放 Showreel"}>{playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}</button>
        <button type="button" onClick={restart} aria-label="重新播放"><RotateCcw aria-hidden="true" /></button>
        <div className="mp-reel__track"><span style={{ transform: `scaleX(${elapsed / duration})` }} /></div>
        <output>{Math.floor(elapsed).toString().padStart(2, "0")} / 60</output>
      </div>
    </main>
  );
}

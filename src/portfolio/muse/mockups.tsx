import type { CSSProperties, ComponentPropsWithoutRef, ReactNode } from "react";
import { mockupPresets, type MockupPreset } from "./presets";

type FrameProps = ComponentPropsWithoutRef<"figure"> & {
  children: ReactNode;
  label?: string;
  variant?: "browser" | "safari" | "chrome" | "window";
};

export function AmbientShadow() {
  return <span className="mp-shadow mp-shadow--ambient" aria-hidden="true" />;
}
export function ContactShadow() {
  return <span className="mp-shadow mp-shadow--contact" aria-hidden="true" />;
}

export function NoiseLayer() {
  return <span className="mp-noise" aria-hidden="true" />;
}

export function BrowserFrame({ children, label = "Muse product interface", variant = "browser", className = "", ...props }: FrameProps) {
  return (
    <figure className={`mp-frame mp-frame--${variant} ${className}`} {...props}>
      <div className="mp-frame__rail"><span>{label}</span><span aria-hidden="true">MUSE / PRODUCT</span></div>
      <div className="mp-frame__viewport">{children}</div>
    </figure>
  );
}

export function SafariFrame(props: Omit<FrameProps, "variant">) {
  return <BrowserFrame {...props} variant="safari" />;
}

export function ChromeFrame(props: Omit<FrameProps, "variant">) {
  return <BrowserFrame {...props} variant="chrome" />;
}

export function FloatingWindow(props: Omit<FrameProps, "variant">) {
  return <BrowserFrame {...props} variant="window" />;
}

type PerspectiveStageProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode;
  preset?: keyof typeof mockupPresets | MockupPreset;
};

export function PerspectiveStage({ children, preset = "flat", className = "", ...props }: PerspectiveStageProps) {
  const value = typeof preset === "string" ? mockupPresets[preset] : preset;
  const style = {
    "--mockup-tilt-x": `${value.tiltX}deg`,
    "--mockup-tilt-y": `${value.tiltY}deg`,
    "--mockup-rotate": `${value.rotate}deg`,
    "--mockup-scale": value.scale,
    "--mockup-origin": value.origin,
  } as CSSProperties;
  return <div className={`mp-perspective ${className}`} style={style} {...props}>{children}</div>;
}

type ScreenshotProps = ComponentPropsWithoutRef<"img"> & { src: string; alt: string };

export function ScreenshotLayer({ className = "", ...props }: ScreenshotProps) {
  return <img className={`mp-screenshot ${className}`} loading="lazy" decoding="async" {...props} />;
}

export function ScreenshotStack({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mp-stack ${className}`}>{children}</div>;
}

export function DetailCrop({ src, alt, position = "50% 50%", className = "" }: ScreenshotProps & { position?: string }) {
  return <div className={`mp-crop ${className}`}><img src={src} alt={alt} style={{ objectPosition: position }} loading="lazy" decoding="async" /></div>;
}

export function PortfolioCaption({ index, eyebrow, children }: { index: string; eyebrow: string; children: ReactNode }) {
  return <figcaption className="mp-caption"><span>{index}</span><strong>{eyebrow}</strong><p>{children}</p></figcaption>;
}

export function PhysicalMacbook({ src, alt }: ScreenshotProps) {
  return <div className="mp-device mp-device--laptop"><div className="mp-device__screen"><ScreenshotLayer src={src} alt={alt} /></div><div className="mp-device__deck" aria-hidden="true" /></div>;
}

export function PhysicalDisplay({ src, alt }: ScreenshotProps) {
  return <div className="mp-device mp-device--display"><div className="mp-device__screen"><ScreenshotLayer src={src} alt={alt} /></div><span className="mp-device__stem" aria-hidden="true" /><span className="mp-device__foot" aria-hidden="true" /></div>;
}

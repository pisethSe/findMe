"use client";

import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import { PredictiveArcCanvas } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";
import styles from "./rentme.module.css";

class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function RibbonScene({ enabled }: { enabled: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [still, setStill] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    const change = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useEffect(() => {
    if (!enabled || !visible || finished) return;
    let frame = 0;
    const timer = window.setTimeout(() => {
      frame = requestAnimationFrame(() => {
        try {
          const canvas = host.current?.querySelector("canvas");
          if (!canvas) return;
          const gl = canvas.getContext("webgl");
          if (!gl || gl.isContextLost()) return;
          // Capture the authored shader with its existing uniforms and buffers.
          // A redraw preserves pixels even when preserveDrawingBuffer is false.
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          setStill(canvas.toDataURL("image/webp", 0.9));
        } catch {
          // A blocked canvas capture falls back to the plain hero surface.
          setStill(null);
        } finally {
          // Stop the intro even if WebGL or its frame capture is unavailable.
          setFinished(true);
        }
      });
    }, 4800);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [enabled, visible, finished]);
  return (
    <div
      ref={host}
      className={`shader-frame ${styles.ribbon}`}
      aria-hidden="true"
      style={
        still
          ? {
              backgroundImage: `url(${still})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {enabled && visible && !finished ? (
        <SceneBoundary>
          <PredictiveArcCanvas
            variant="ribbon-field"
            speed={1.0}
            pointerAmount={1.0}
            smoothing={0.035}
            hue={0}
            saturation={1.0}
            brightness={1.0}
            opacity={1.0}
          />
        </SceneBoundary>
      ) : null}
    </div>
  );
}

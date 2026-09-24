"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./rentme.module.css";

/** The supplied BorderGlow's angle/proximity effect, restricted to the border. */
export function SearchBorderGlow({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return (
    <div
      ref={host}
      className={styles.borderGlow}
      onPointerMove={(event) => {
        if (
          event.pointerType !== "mouse" ||
          matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          return;
        const { clientX, clientY } = event;
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          const element = host.current;
          if (!element) return;
          const bounds = element.getBoundingClientRect();
          const x = clientX - bounds.left - bounds.width / 2;
          const y = clientY - bounds.top - bounds.height / 2;
          const proximity = Math.min(
            1,
            Math.max(
              Math.abs(x) / (bounds.width / 2),
              Math.abs(y) / (bounds.height / 2),
            ),
          );
          element.style.setProperty(
            "--glow-angle",
            `${(Math.atan2(y, x) * 180) / Math.PI + 90}deg`,
          );
          element.style.setProperty(
            "--glow-opacity",
            String(Math.max(0, (proximity - 0.3) / 0.7)),
          );
        });
      }}
      onPointerLeave={() => {
        cancelAnimationFrame(frame.current);
        host.current?.style.setProperty("--glow-opacity", "0");
      }}
    >
      {children}
      <span className={styles.borderGlowRing} aria-hidden="true" />
    </div>
  );
}

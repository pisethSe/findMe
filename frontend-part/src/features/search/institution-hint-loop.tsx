"use client";

import { useEffect, useState } from "react";

/**
 * Slow, looping hint that shows one real campus name at a time.
 *
 * The visible line is decorative: assistive technology reads the stable
 * `sr-only` sentence once instead of every rotation, so the loop never becomes a
 * repeated live announcement. Reduced-motion users see the first name only.
 */
export function InstitutionHintLoop({
  names,
  label,
  paused = false,
  intervalMs = 2800,
}: {
  names: readonly string[];
  label: string;
  paused?: boolean;
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(motion.matches);
    update();
    motion.addEventListener("change", update);
    return () => motion.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [names]);

  useEffect(() => {
    if (paused || reducedMotion || names.length < 2) return;
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % names.length),
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [intervalMs, names.length, paused, reducedMotion]);

  const current = names[index % names.length] ?? "";
  if (!current) return null;

  return (
    <span className="institution-hint-loop">
      <span className="institution-hint-loop-label">{label}</span>
      <span className="institution-hint-loop-window">
        <span
          className="institution-hint-loop-name"
          data-motion={reducedMotion ? "still" : "flip"}
          key={current}
        >
          {current}
        </span>
      </span>
      <span className="sr-only">{`${label} ${names[0] ?? ""}`}</span>
    </span>
  );
}

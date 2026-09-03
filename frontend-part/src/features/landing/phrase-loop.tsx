"use client";

import { useEffect, useState } from "react";

const PHRASES = [
  {
    km: "នៅជិតសាលារបស់អ្នក",
    en: "Near your university",
  },
  {
    km: "សមនឹងថវិការបស់អ្នក",
    en: "Within your monthly budget",
  },
  {
    km: "បញ្ជាក់ថានៅទំនេរ",
    en: "Availability you can check",
  },
] as const;

export function PhraseLoop() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyPreference = () => {
      setReducedMotion(query.matches);
      if (query.matches) setActiveIndex(0);
    };

    applyPreference();
    query.addEventListener("change", applyPreference);
    return () => query.removeEventListener("change", applyPreference);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % PHRASES.length);
    }, 5_000);

    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  const activePhrase = PHRASES[activeIndex] ?? PHRASES[0];

  return (
    <div className="phrase-loop">
      <p className="sr-only">
        Find rentals near your university, within your monthly budget, with
        availability you can check.
      </p>
      <div className="phrase-window" aria-hidden="true">
        <p key={activePhrase.en} className="phrase-copy">
          <span lang="km">{activePhrase.km}</span>
          <span lang="en">{activePhrase.en}</span>
        </p>
      </div>
      {!reducedMotion ? (
        <button
          className="phrase-control"
          type="button"
          onClick={() => setPaused((current) => !current)}
          aria-pressed={paused}
        >
          <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>
          {paused ? "Play phrases" : "Pause phrases"}
        </button>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import {
  formatSearchRadius,
  MAX_SEARCH_RADIUS_METERS,
  MIN_SEARCH_RADIUS_METERS,
  radiusFromKilometres,
  SEARCH_RADIUS_PRESETS_METERS,
} from "./distance-filter-model";

const DISTANCE_ERROR =
  "Enter a distance from 0.1 to 20 km, with up to three decimal places.";

export function DistanceFilter({ radiusMeters }: { radiusMeters: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(String(radiusMeters / 1_000));
  const [touched, setTouched] = useState(false);
  const selectedRadius = radiusFromKilometres(value);
  const invalid = touched && selectedRadius === undefined;

  useEffect(() => {
    // Native GET submissions may restore an edited draft from Chrome's
    // back-forward cache. Restore the applied filter, not the abandoned draft.
    const restoreAppliedRadius = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setValue(String(radiusMeters / 1_000));
      setTouched(false);
      inputRef.current?.setCustomValidity("");
    };
    window.addEventListener("pageshow", restoreAppliedRadius);
    return () => window.removeEventListener("pageshow", restoreAppliedRadius);
  }, [radiusMeters]);

  return (
    <div className="distance-filter">
      <label htmlFor="search-distance">Maximum distance (km)</label>
      <input
        ref={inputRef}
        id="search-distance"
        name="maxDistanceKm"
        type="number"
        min={MIN_SEARCH_RADIUS_METERS / 1_000}
        max={MAX_SEARCH_RADIUS_METERS / 1_000}
        step="0.001"
        inputMode="decimal"
        required
        value={value}
        aria-invalid={invalid}
        aria-describedby={`search-distance-help${invalid ? " search-distance-error" : ""}`}
        onChange={(event) => {
          const input = event.currentTarget;
          setValue(input.value);
          input.setCustomValidity(
            radiusFromKilometres(input.value) === undefined
              ? DISTANCE_ERROR
              : "",
          );
        }}
        onBlur={() => setTouched(true)}
        onInvalid={() => setTouched(true)}
      />
      <div
        className="distance-presets"
        role="group"
        aria-label="Quick maximum distances"
      >
        {SEARCH_RADIUS_PRESETS_METERS.map((radius) => (
          <button
            key={radius}
            type="button"
            aria-pressed={selectedRadius === radius}
            onClick={() => {
              setValue(String(radius / 1_000));
              setTouched(false);
              inputRef.current?.setCustomValidity("");
            }}
          >
            {formatSearchRadius(radius)}
          </button>
        ))}
      </div>
      <p id="search-distance-help">
        Straight-line distance from your institution, not walking distance.
        Choose 0.1–20 km, then update results.
      </p>
      {invalid ? (
        <p
          id="search-distance-error"
          className="distance-filter-error"
          role="alert"
        >
          {DISTANCE_ERROR}
        </p>
      ) : null}
    </div>
  );
}

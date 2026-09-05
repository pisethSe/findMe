"use client";

import type { InstitutionDto } from "@findme/contracts";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { InstitutionPicker } from "./institution-picker";
import { findInstitutionBySlug, searchInstitutions } from "./search-api";

const DEFAULT_INSTITUTION_SLUG = "royal-university-of-phnom-penh";

export function InstitutionStartForm() {
  const [institution, setInstitution] = useState<InstitutionDto | null>(null);
  const [selectionValid, setSelectionValid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setEmpty(false);
    setError(null);

    async function loadInitialInstitution() {
      try {
        const preferred = await findInstitutionBySlug(
          DEFAULT_INSTITUTION_SLUG,
          controller.signal,
        );
        const fallback = preferred
          ? null
          : await searchInstitutions({ limit: 1 }, controller.signal);
        if (controller.signal.aborted) return;
        const selected = preferred ?? fallback?.data[0] ?? null;
        setInstitution(selected);
        setSelectionValid(Boolean(selected));
        setEmpty(!selected);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "FindMe could not load active institutions.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadInitialInstitution();
    return () => controller.abort();
  }, [attempt]);

  const updateValidity = useCallback((valid: boolean) => {
    setSelectionValid(valid);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    if (!selectionValid || !institution) event.preventDefault();
  }

  return (
    <form
      className="institution-search"
      action="/search"
      method="get"
      onSubmit={submit}
    >
      <div className="institution-search-row">
        <InstitutionPicker
          id="home-institution"
          label="Start with your school, university, or college"
          selectedInstitution={institution}
          onSelect={setInstitution}
          onSelectionValidityChange={updateValidity}
          disabled={loading || empty || Boolean(error)}
        />
        <button
          type="submit"
          disabled={loading || empty || Boolean(error) || !selectionValid}
        >
          {loading ? "Loading institutions…" : "Find nearby rooms"}
        </button>
      </div>
      {error ? (
        <div className="institution-start-feedback" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      ) : empty ? (
        <p className="institution-start-feedback" role="status">
          No active institutions are available yet. Please check again later.
        </p>
      ) : null}
    </form>
  );
}

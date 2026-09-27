"use client";

import { Localized } from "../preferences/translated-text";
import type { InstitutionDto } from "@findme/contracts";
import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import {
  institutionInputValue,
  institutionTypeLabel,
  nextInstitutionOptionIndex,
  normalizeInstitutionQuery,
} from "./institution-search-model";
import type { CampusRunningPhrase } from "./campus-running-phrases";
import { InstitutionHintLoop } from "./institution-hint-loop";
import { searchInstitutions } from "./search-api";

/** How long one running example rests before the next one slides in. */
const RUNNING_PHRASE_INTERVAL_MS = 3000;

interface InstitutionPickerProps {
  id: string;
  label: string;
  locale?: "en" | "km";
  selectedInstitution: InstitutionDto | null;
  onSelect: (institution: InstitutionDto) => void;
  onSelectionValidityChange: (valid: boolean) => void;
  disabled?: boolean;
  name?: string;
  /**
   * Active campus names for the looping hint under the field. Only the landing
   * search panel passes these; other pickers keep the plain help text.
   */
  hintLoop?: readonly string[];
  hintLoopLabel?: string;
  /**
   * Bilingual examples that run inside the field while it is idle. They stop as
   * soon as the field is focused or holds text, so typing is never covered.
   */
  runningPhrases?: readonly CampusRunningPhrase[];
}

export function InstitutionPicker({
  id,
  label,
  locale = "en",
  selectedInstitution,
  onSelect,
  onSelectionValidityChange,
  disabled = false,
  name = "institution",
  hintLoop,
  hintLoopLabel,
  runningPhrases,
}: InstitutionPickerProps) {
  const generatedId = useId().replaceAll(":", "");
  const listboxId = `${id}-${generatedId}-results`;
  const helpId = `${id}-${generatedId}-help`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const keyboardNavigationRef = useRef(false);
  const [query, setQuery] = useState(
    selectedInstitution ? institutionInputValue(selectedInstitution) : "",
  );
  const [selectionValid, setSelectionValid] = useState(
    Boolean(selectedInstitution),
  );
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<readonly InstitutionDto[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const runningCount = runningPhrases?.length ?? 0;
  const idle = !focused && !open && !disabled;
  // Before the first interaction the examples run over the default campus, so
  // the bar reads as an invitation. After that they only run in an empty
  // field, so typed text and a chosen campus are never covered.
  const runningActive =
    runningCount > 0 && idle && (!touched || query.trim() === "");
  const activePhrase = runningActive
    ? runningPhrases?.[phraseIndex % runningCount]
    : undefined;

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(motion.matches);
    update();
    motion.addEventListener("change", update);
    return () => motion.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setPhraseIndex(0);
  }, [runningPhrases]);

  useEffect(() => {
    // The running examples stop the moment the field is used, so typed text is
    // never covered, and reduced-motion readers keep one static example.
    if (!runningActive || reducedMotion || runningCount < 2) return;
    const timer = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % runningCount);
    }, RUNNING_PHRASE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [reducedMotion, runningActive, runningCount]);

  useEffect(() => {
    if (!open || activeIndex < 0 || !keyboardNavigationRef.current) return;
    const listbox = listboxRef.current;
    const option = listbox?.children.item(activeIndex);
    if (!listbox || !(option instanceof HTMLElement)) return;

    // Move only the option list. Scrolling the page would move the focused
    // search input, especially when the on-screen keyboard is open.
    const listTop = listbox.getBoundingClientRect().top + listbox.clientTop;
    const listBottom = listTop + listbox.clientHeight;
    const optionBounds = option.getBoundingClientRect();
    if (
      optionBounds.top < listTop ||
      optionBounds.height > listbox.clientHeight
    ) {
      listbox.scrollTop += optionBounds.top - listTop;
    } else if (optionBounds.bottom > listBottom) {
      listbox.scrollTop += optionBounds.bottom - listBottom;
    }
  }, [activeIndex, open]);

  useEffect(() => {
    const nextValue = selectedInstitution
      ? institutionInputValue(selectedInstitution)
      : "";
    setQuery(nextValue);
    setSelectionValid(Boolean(selectedInstitution));
    onSelectionValidityChange(Boolean(selectedInstitution));
  }, [onSelectionValidityChange, selectedInstitution]);

  useEffect(() => {
    if (!open || disabled) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      setOptions([]);
      setActiveIndex(-1);
      setSearchError(null);
      const normalizedQuery = normalizeInstitutionQuery(query);
      void searchInstitutions(
        { ...(normalizedQuery ? { query: normalizedQuery } : {}), limit: 12 },
        controller.signal,
      )
        .then((result) => {
          setOptions(result.data);
          setActiveIndex(-1);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setOptions([]);
          setSearchError(
            error instanceof Error
              ? error.message
              : "Institution search is unavailable.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [disabled, open, query, retry]);

  function setValid(valid: boolean) {
    setSelectionValid(valid);
    onSelectionValidityChange(valid);
  }

  function choose(institution: InstitutionDto) {
    setQuery(institutionInputValue(institution));
    setValid(true);
    setTouched(true);
    setOpen(false);
    setActiveIndex(-1);
    onSelect(institution);
  }

  function changeQuery(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    setValid(false);
    setTouched(true);
    setOpen(true);
    setActiveIndex(-1);
  }

  function leavePicker(event: FocusEvent<HTMLInputElement>) {
    if (
      event.relatedTarget instanceof Node &&
      wrapperRef.current?.contains(event.relatedTarget)
    ) {
      return;
    }
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      keyboardNavigationRef.current = true;
      setOpen(true);
      setActiveIndex((current) =>
        nextInstitutionOptionIndex(
          current,
          options.length,
          event.key === "ArrowDown" ? "next" : "previous",
        ),
      );
      return;
    }
    if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) choose(option);
      return;
    }
    if (event.key === "Enter" && !selectionValid) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setQuery(
        selectedInstitution ? institutionInputValue(selectedInstitution) : "",
      );
      setValid(Boolean(selectedInstitution));
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const activeOptionId =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <Localized>
      <div className="institution-picker" ref={wrapperRef}>
        <label htmlFor={id}>{label}</label>
        <div className="institution-picker-control">
          <input
            id={id}
            type="search"
            role="combobox"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            maxLength={100}
            placeholder={
              runningActive
                ? undefined
                : locale === "km"
                  ? "ស្វែងរកជាខ្មែរ ឬអង់គ្លេស"
                  : "Search in Khmer or English"
            }
            value={query}
            disabled={disabled}
            aria-autocomplete="list"
            aria-controls={open && options.length > 0 ? listboxId : undefined}
            aria-expanded={open}
            aria-activedescendant={activeOptionId}
            aria-describedby={helpId}
            aria-invalid={!selectionValid && query.length > 0}
            data-running={runningActive ? "true" : undefined}
            onChange={changeQuery}
            onFocus={() => {
              setFocused(true);
              setTouched(true);
              setOpen(true);
            }}
            onBlur={(event) => {
              setFocused(false);
              leavePicker(event);
            }}
            onKeyDown={handleKeyDown}
          />

          {activePhrase ? (
            <span
              className="institution-picker-running"
              data-motion={reducedMotion ? "still" : "cycle"}
              key={`${activePhrase.km}|${activePhrase.en}`}
              aria-hidden="true"
            >
              <span className="institution-picker-running-km" lang="km">
                {activePhrase.km}
              </span>
              <span className="institution-picker-running-en" lang="en">
                {activePhrase.en}
              </span>
            </span>
          ) : null}

          {open ? (
            <div className="institution-picker-popover">
              {searching ? (
                <p className="institution-picker-state" role="status">
                  {locale === "km"
                    ? "កំពុងស្វែងរកគ្រឹះស្ថាន…"
                    : "Searching active institutions…"}
                </p>
              ) : searchError ? (
                <div className="institution-picker-state" role="alert">
                  <p>{searchError}</p>
                  <button
                    type="button"
                    onClick={() => setRetry((value) => value + 1)}
                  >
                    {locale === "km"
                      ? "សាកល្បងស្វែងរកម្ដងទៀត"
                      : "Try institution search again"}
                  </button>
                </div>
              ) : options.length === 0 ? (
                <p className="institution-picker-state" role="status">
                  {locale === "km"
                    ? "មិនមានគ្រឹះស្ថានត្រូវនឹងឈ្មោះនេះ។ សាកល្បងខ្មែរ អង់គ្លេស ឬអក្សរកាត់។"
                    : "No active institutions match this name. Try Khmer, English, or an abbreviation."}
                </p>
              ) : (
                <ul
                  ref={listboxRef}
                  id={listboxId}
                  role="listbox"
                  aria-label="Active institutions"
                >
                  {options.map((institution, index) => (
                    <li
                      id={`${listboxId}-option-${index}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      key={institution.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => {
                        keyboardNavigationRef.current = false;
                        setActiveIndex(index);
                      }}
                      onClick={() => choose(institution)}
                    >
                      <strong lang="km">{institution.nameKm}</strong>
                      <span>{institution.nameEn}</span>
                      <small>
                        {institution.shortName
                          ? `${institution.shortName} · `
                          : ""}
                        {institutionTypeLabel(institution.type)} ·{" "}
                        {institution.city}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
        <input
          type="hidden"
          name={name}
          value={selectionValid ? (selectedInstitution?.slug ?? "") : ""}
        />

        <p id={helpId} className="institution-picker-help">
          {!selectionValid && query.length > 0 ? (
            "Choose an institution from the search results."
          ) : hintLoop && hintLoop.length > 0 ? (
            <InstitutionHintLoop
              names={hintLoop}
              label={hintLoopLabel ?? (locale === "km" ? "សាកល្បង៖" : "Try:")}
              paused={open || disabled}
            />
          ) : selectedInstitution ? (
            selectedInstitution.nameKm
          ) : (
            "Enter a school, university, college, or abbreviation."
          )}
        </p>
      </div>
    </Localized>
  );
}

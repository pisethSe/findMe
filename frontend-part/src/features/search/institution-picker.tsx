"use client";

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
} from "./institution-search-model";
import { searchInstitutions } from "./search-api";

interface InstitutionPickerProps {
  id: string;
  label: string;
  selectedInstitution: InstitutionDto | null;
  onSelect: (institution: InstitutionDto) => void;
  onSelectionValidityChange: (valid: boolean) => void;
  disabled?: boolean;
  name?: string;
}

export function InstitutionPicker({
  id,
  label,
  selectedInstitution,
  onSelect,
  onSelectionValidityChange,
  disabled = false,
  name = "institution",
}: InstitutionPickerProps) {
  const generatedId = useId().replaceAll(":", "");
  const listboxId = `${id}-${generatedId}-results`;
  const helpId = `${id}-${generatedId}-help`;
  const wrapperRef = useRef<HTMLDivElement>(null);
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
      void searchInstitutions(
        { ...(query.trim() ? { query: query.trim() } : {}), limit: 12 },
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
    setOpen(false);
    setActiveIndex(-1);
    onSelect(institution);
  }

  function changeQuery(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    setValid(false);
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
    <div className="institution-picker" ref={wrapperRef}>
      <label htmlFor={id}>{label}</label>
      <div className="institution-picker-control">
        <input
          id={id}
          type="search"
          role="combobox"
          autoComplete="off"
          maxLength={100}
          placeholder="Search in Khmer or English"
          value={query}
          disabled={disabled}
          aria-autocomplete="list"
          aria-controls={open && options.length > 0 ? listboxId : undefined}
          aria-expanded={open}
          aria-activedescendant={activeOptionId}
          aria-describedby={helpId}
          aria-invalid={!selectionValid && query.length > 0}
          onChange={changeQuery}
          onFocus={() => setOpen(true)}
          onBlur={leavePicker}
          onKeyDown={handleKeyDown}
        />

        {open ? (
          <div className="institution-picker-popover">
            {searching ? (
              <p className="institution-picker-state" role="status">
                Searching active institutions…
              </p>
            ) : searchError ? (
              <div className="institution-picker-state" role="alert">
                <p>{searchError}</p>
                <button
                  type="button"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  Try institution search again
                </button>
              </div>
            ) : options.length === 0 ? (
              <p className="institution-picker-state" role="status">
                No active institutions match this name. Try Khmer, English, or
                an abbreviation.
              </p>
            ) : (
              <ul
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
                    onMouseEnter={() => setActiveIndex(index)}
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
        {!selectionValid && query.length > 0
          ? "Choose an institution from the search results."
          : selectedInstitution
            ? selectedInstitution.nameKm
            : "Enter a school, university, college, or abbreviation."}
      </p>
    </div>
  );
}

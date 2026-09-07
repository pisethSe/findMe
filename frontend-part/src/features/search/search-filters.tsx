"use client";

import type { InstitutionDto, PropertyType } from "@findme/contracts";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { DistanceFilter } from "./distance-filter";
import { formatSearchRadius } from "./distance-filter-model";

export const PROPERTY_TYPE_OPTIONS: ReadonlyArray<{
  value: PropertyType;
  label: string;
}> = [
  { value: "ROOM", label: "Room" },
  { value: "STUDIO", label: "Studio" },
  { value: "APARTMENT", label: "Apartment" },
  { value: "HOUSE", label: "House" },
  { value: "DORM_ROOM", label: "Dorm room" },
  { value: "OTHER_STUDENT_RENTAL", label: "Other student rental" },
];

interface SearchFiltersProps {
  institution: InstitutionDto | null;
  selectionValid: boolean;
  maxRentUsd: number;
  radiusMeters: number;
  propertyType?: PropertyType;
}

export function SearchFilters(props: SearchFiltersProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inlineRef = useRef<HTMLDivElement>(null);
  const rentalType = PROPERTY_TYPE_OPTIONS.find(
    (option) => option.value === props.propertyType,
  )?.label;

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    titleRef.current?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // A rotation or resize must not leave a modal over the desktop form.
    const desktop = window.matchMedia("(min-width: 961px)");
    const closeOnDesktop = () => {
      if (desktop.matches) dialog.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    closeOnDesktop();
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      document.body.style.overflow = previousOverflow;
      dialog.close();
    };
  }, [open]);

  function restoreFocus() {
    // Ignore a queued close event if a new modal session already opened.
    if (dialogRef.current?.open) return;
    setOpen(false);
    window.requestAnimationFrame(() => {
      if (window.matchMedia("(min-width: 961px)").matches) {
        inlineRef.current
          ?.querySelector<HTMLInputElement>("input[type=number]")
          ?.focus({ preventScroll: true });
      } else {
        triggerRef.current?.focus({ preventScroll: true });
      }
    });
  }

  return (
    <div className="search-filters">
      <div className="search-filter-summary">
        <p>
          Up to ${props.maxRentUsd.toLocaleString("en-US")} / month ·{" "}
          {formatSearchRadius(props.radiusMeters)} ·{" "}
          {rentalType ?? "All rental types"}
        </p>
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="search-filter-dialog"
          onClick={() => setOpen(true)}
        >
          Filters
        </button>
      </div>
      <div ref={inlineRef} className="search-filters-inline">
        {!open ? <FilterForm {...props} /> : null}
      </div>
      <dialog
        ref={dialogRef}
        id="search-filter-dialog"
        className="search-filter-dialog"
        aria-labelledby="search-filter-title"
        onClose={restoreFocus}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not([type="hidden"]):not(:disabled), select:not(:disabled)',
          );
          const first = controls.item(0);
          const last = controls.item(controls.length - 1);
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === titleRef.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        {open ? (
          <>
            <div className="search-filter-dialog-heading">
              <h2 ref={titleRef} id="search-filter-title" tabIndex={-1}>
                Search filters
              </h2>
              <button type="button" onClick={() => dialogRef.current?.close()}>
                Cancel
              </button>
            </div>
            <p className="search-filter-institution">
              Near {props.institution?.nameEn ?? "your institution"}
            </p>
            <FilterForm {...props} />
          </>
        ) : null}
      </dialog>
    </div>
  );
}

function FilterForm({
  institution,
  selectionValid,
  maxRentUsd,
  radiusMeters,
  propertyType,
}: SearchFiltersProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    if (!institution || !selectionValid) event.preventDefault();
  }

  return (
    <form
      className="filter-form"
      action="/search"
      method="get"
      onSubmit={submit}
    >
      <input type="hidden" name="institution" value={institution?.slug ?? ""} />
      <label>
        Maximum rent (USD)
        <input
          key={maxRentUsd}
          name="maxRentUsd"
          type="number"
          min="1"
          max="9999999999"
          step="0.01"
          inputMode="decimal"
          defaultValue={maxRentUsd}
        />
      </label>
      <label>
        Rental type
        <select
          key={propertyType ?? "all"}
          name="propertyType"
          defaultValue={propertyType ?? ""}
        >
          <option value="">All rental types</option>
          {PROPERTY_TYPE_OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <DistanceFilter key={radiusMeters} radiusMeters={radiusMeters} />
      {!institution || !selectionValid ? (
        <p className="search-filter-help">
          Choose an institution from the search results before updating filters.
        </p>
      ) : null}
      <button type="submit" disabled={!institution || !selectionValid}>
        Update results
      </button>
    </form>
  );
}

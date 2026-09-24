"use client";

import { useEffect, useRef, useState } from "react";
import type { Currency, PropertyType } from "@findme/contracts";
import {
  LandingIcon,
  type LandingLocale,
  translate as t,
} from "./landing-icons";
import {
  filterDirectory,
  UNIVERSITY_DIRECTORY,
} from "./university-directory-data";
import { ROOM_TYPE_OPTIONS } from "../search/room-type-options";
import styles from "./rentme.module.css";

export interface LandingFilters {
  maxPrice: string;
  currency: Currency;
  propertyType: PropertyType | "";
}
export const DEFAULT_LANDING_FILTERS: LandingFilters = {
  maxPrice: "300",
  currency: "USD",
  propertyType: "",
};

export function FilterDialog({
  locale,
  filters,
  onClose,
  onApply,
}: {
  locale: LandingLocale;
  filters: LandingFilters;
  onClose: () => void;
  onApply: (value: LandingFilters) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(filters);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  function close() {
    dialog.current?.close();
    onClose();
  }
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="filter-title"
      onCancel={close}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]",
          ),
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          dialog.current?.close();
          onApply(draft);
        }}
      >
        <div className={styles.dialogTitle}>
          <h2 id="filter-title">
            {t(locale, "Find your kind of room", "ស្វែងរកបន្ទប់ដែលសមនឹងអ្នក")}
          </h2>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t(locale, "Close filters", "បិទតម្រង")}
            onClick={close}
          >
            <LandingIcon name="close" />
          </button>
        </div>
        <p>
          {t(
            locale,
            "Set a monthly budget. You can refine more details in the full search.",
            "កំណត់ថវិកាប្រចាំខែ។ អ្នកអាចកែតម្រងបន្ថែមនៅទំព័រស្វែងរក។",
          )}
        </p>
        <label className={styles.field}>
          {t(
            locale,
            "Maximum monthly rent (USD)",
            "ថ្លៃជួលអតិបរមាប្រចាំខែ (USD)",
          )}
          <input
            type="number"
            required
            min="1"
            max="100000000"
            step="1"
            inputMode="numeric"
            placeholder="300"
            value={draft.maxPrice}
            onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })}
          />
        </label>
        <label className={styles.field}>
          {t(locale, "Rental type", "ប្រភេទបន្ទប់")}
          <select
            value={draft.propertyType}
            onChange={(e) =>
              setDraft({
                ...draft,
                propertyType: e.target.value as LandingFilters["propertyType"],
              })
            }
          >
            <option value="">
              {t(locale, "All rental types", "គ្រប់ប្រភេទ")}
            </option>
            {ROOM_TYPE_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {t(locale, option.en, option.km)}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.dialogActions}>
          <button
            className={styles.textButton}
            type="button"
            onClick={() => setDraft(DEFAULT_LANDING_FILTERS)}
          >
            {t(locale, "Reset", "កំណត់ឡើងវិញ")}
          </button>
          <button className={styles.primaryButton} type="submit">
            {t(locale, "Apply filters", "អនុវត្តតម្រង")}
            <LandingIcon name="check" />
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function UniversityDirectory({
  locale,
  standalone = false,
}: {
  locale: LandingLocale;
  standalone?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All");
  const results = filterDirectory(query, sector);
  return (
    <details
      id="universities"
      className={styles.directory}
      open={standalone || undefined}
    >
      <summary>
        <span>
          <strong>
            {t(locale, "Find your university", "ស្វែងរកសាកលវិទ្យាល័យរបស់អ្នក")}
          </strong>
          <span>
            {t(
              locale,
              `${UNIVERSITY_DIRECTORY.length} institutions across Cambodia`,
              `គ្រឹះស្ថានចំនួន ${UNIVERSITY_DIRECTORY.length} នៅកម្ពុជា`,
            )}
          </span>
        </span>
        <LandingIcon name="chevron" />
      </summary>
      <div className={styles.directoryBody}>
        <p>
          {t(
            locale,
            "Explore the full directory. Rental search currently covers active campuses in Phnom Penh. Choose a campus above to see available rooms.",
            "មើលបញ្ជីគ្រឹះស្ថានទូទាំងប្រទេស។ ការស្វែងរកបន្ទប់បច្ចុប្បន្នផ្តោតលើគ្រឹះស្ថានដែលមានទិន្នន័យនៅភ្នំពេញ។",
          )}
        </p>
        <div className={styles.directoryControls}>
          <label className={styles.field}>
            {t(
              locale,
              "University name or city",
              "ឈ្មោះសាកលវិទ្យាល័យ ឬទីក្រុង",
            )}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="RUPP, បញ្ញាសាស្ត្រ, Battambang…"
            />
          </label>
          <label className={styles.field}>
            {t(locale, "Institution sector", "ប្រភេទគ្រឹះស្ថាន")}
            <select value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="All">
                {t(locale, "All institutions", "គ្រប់គ្រឹះស្ថាន")}
              </option>
              <option value="Public">{t(locale, "Public", "រដ្ឋ")}</option>
              <option value="Private">{t(locale, "Private", "ឯកជន")}</option>
            </select>
          </label>
        </div>
        <p role="status">
          {t(
            locale,
            `${results.length} institutions found`,
            `រកឃើញគ្រឹះស្ថានចំនួន ${results.length}`,
          )}
        </p>
        <ul className={styles.directoryList}>
          {results.map((item) => (
            <li key={item.abbreviation}>
              <div>
                <strong>{item.name}</strong>
                {item.km ? <span lang="km">{item.km}</span> : null}
                <small>
                  {item.abbreviation} · {item.city} ·{" "}
                  {t(
                    locale,
                    item.sector,
                    item.sector === "Public" ? "រដ្ឋ" : "ឯកជន",
                  )}
                </small>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name}, ${item.city}, Cambodia`)}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`${t(locale, "Find on Google Maps", "រកនៅលើ Google Maps")}: ${item.name} (${t(locale, "opens a new tab", "បើកផ្ទាំងថ្មី")})`}
              >
                <LandingIcon name="pin" />
                <span>Google Maps</span>
                <LandingIcon name="arrow" />
              </a>
            </li>
          ))}
        </ul>
        {!results.length ? (
          <p>
            {t(
              locale,
              "No matching institutions. Try another name or abbreviation.",
              "រកមិនឃើញគ្រឹះស្ថាន។ សូមសាកល្បងឈ្មោះ ឬអក្សរកាត់ផ្សេង។",
            )}
          </p>
        ) : null}
      </div>
    </details>
  );
}

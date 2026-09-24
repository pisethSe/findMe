"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "./site-header";
import { useSitePreferences } from "../preferences/site-preferences";
import { HoverSelect } from "./hover-select";
import { SearchBorderGlow } from "./search-border-glow";
import type {
  InstitutionDto,
  PublicListingSearchPage,
} from "@findme/contracts";
import { BrandMark } from "./brand-mark";
import { RibbonScene } from "./ribbon-scene";
import { CloudShader } from "../../components/ui/cloud-shader";
import { LandingIcon, translate as t } from "./landing-icons";
import {
  DEFAULT_LANDING_FILTERS,
  FilterDialog,
  type LandingFilters,
} from "./landing-controls";
import { LandingMap, listingToMapRoom, SAMPLE_MAP_ROOMS } from "./landing-map";
import { InstitutionPicker } from "../search/institution-picker";
import { ROOM_TYPE_OPTIONS } from "../search/room-type-options";
import {
  findInstitutionBySlug,
  searchInstitutions,
  searchPublishedListings,
} from "../search/search-api";
import styles from "./rentme.module.css";

const PHRASES = [
  { km: "នៅជិតសាលារបស់អ្នក", en: "Near your university." },
  { km: "សមនឹងថវិការបស់អ្នក", en: "Within your monthly budget." },
] as const;

export function RentMeLanding() {
  const { locale, theme } = useSitePreferences();
  const router = useRouter();
  const [reducedMotion, setReducedMotion] = useState(true);
  const [introFinished, setIntroFinished] = useState(false);
  const [phrase, setPhrase] = useState(0);
  const [institution, setInstitution] = useState<InstitutionDto | null>(null);
  const [institutionStatus, setInstitutionStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [valid, setValid] = useState(false);
  const [radius, setRadius] = useState(5000);
  const [filters, setFilters] = useState<LandingFilters>(
    DEFAULT_LANDING_FILTERS,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<PublicListingSearchPage | null>(null);
  const [resultStatus, setResultStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [attempt, setAttempt] = useState(0);
  const [campusAttempt, setCampusAttempt] = useState(0);
  const [campusHints, setCampusHints] = useState<readonly string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    SAMPLE_MAP_ROOMS[0]?.id ?? null,
  );
  const filterButton = useRef<HTMLButtonElement>(null);
  const resultSection = useRef<HTMLElement>(null);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(motion.matches);
    update();
    motion.addEventListener("change", update);
    return () => motion.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (reducedMotion) return;
    setIntroFinished(false);
    setPhrase(0);
    const phraseTimer = window.setTimeout(() => setPhrase(1), 2400);
    const finishTimer = window.setTimeout(() => setIntroFinished(true), 4800);
    return () => {
      window.clearTimeout(phraseTimer);
      window.clearTimeout(finishTimer);
    };
  }, [reducedMotion, theme]);
  useEffect(() => {
    const controller = new AbortController();
    setInstitutionStatus("loading");
    async function load() {
      try {
        const preferred = await findInstitutionBySlug(
          "royal-university-of-phnom-penh",
          controller.signal,
        );
        const first =
          preferred ??
          (await searchInstitutions({ limit: 1 }, controller.signal)).data[0];
        if (controller.signal.aborted) return;
        if (first) {
          setInstitution(first);
          setInstitutionStatus("ready");
        } else setInstitutionStatus("error");
      } catch {
        if (!controller.signal.aborted) setInstitutionStatus("error");
      }
    }
    void load();
    return () => controller.abort();
  }, [campusAttempt]);
  useEffect(() => {
    // The looping campus hint lists active campuses a student can really search.
    const controller = new AbortController();
    void searchInstitutions({ limit: 12 }, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        const names = page.data
          .map((entry) => entry.nameEn)
          .filter((name): name is string => Boolean(name?.trim()));
        if (names.length > 1) setCampusHints(names);
      })
      .catch(() => {
        // Without a campus list the field keeps its plain help text.
      });
    return () => controller.abort();
  }, [campusAttempt]);
  useEffect(() => {
    if (!submitted || !institution || !valid) return;
    const controller = new AbortController();
    setResultStatus("loading");
    setResults(null);
    const timer = window.setTimeout(() => {
      void searchPublishedListings(
        {
          institutionId: institution.id,
          radiusMeters: radius,
          currency: filters.currency,
          ...(filters.maxPrice !== ""
            ? { maxPrice: Number(filters.maxPrice) }
            : {}),
          ...(filters.propertyType
            ? { propertyType: filters.propertyType }
            : {}),
          pageSize: 12,
        },
        controller.signal,
      )
        .then((page) => {
          if (controller.signal.aborted) return;
          setResults(page);
          setSelectedId(page.data[0]?.id ?? null);
          setResultStatus("ready");
        })
        .catch(() => {
          if (!controller.signal.aborted) setResultStatus("error");
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [institution, radius, filters, submitted, attempt, valid]);
  const rooms = useMemo(
    () =>
      !submitted
        ? SAMPLE_MAP_ROOMS
        : results && institution
          ? results.data.map((listing) =>
              listingToMapRoom(listing, institution, locale),
            )
          : [],
    [submitted, results, institution, locale],
  );
  const searchParams = new URLSearchParams({
    institution: institution?.slug ?? "royal-university-of-phnom-penh",
    maxDistanceKm: String(radius / 1000),
    currency: filters.currency,
  });
  searchParams.set("maxRentUsd", filters.maxPrice);
  if (filters.propertyType)
    searchParams.set("propertyType", filters.propertyType);
  const searchHref = `/search?${searchParams}`;
  const activePhrase = PHRASES[reducedMotion ? 0 : phrase] ?? PHRASES[0];
  const filterCount =
    Number(Boolean(filters.maxPrice)) + Number(Boolean(filters.propertyType));
  function closeFilters() {
    setFiltersOpen(false);
    filterButton.current?.focus();
  }
  function openDirectory() {
    router.push("/universities");
  }

  return (
    <div className={styles.page} data-theme={theme} lang={locale}>
      <a href="#find-room" className={styles.skip}>
        {t(locale, "Skip to room search", "ទៅកាន់ការស្វែងរកបន្ទប់")}
      </a>
      <SiteHeader />
      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroBackdrop} aria-hidden="true" />
          {theme === "light" ? (
            <div className={styles.dotTexture} aria-hidden="true" />
          ) : null}
          {/* Small warm-tinted clouds drift over the day photograph only.
              The layer is decorative, keeps the headline readable, and the
              shader freezes to a static frame for reduced-motion users. */}
          {theme === "light" ? (
            <div className={styles.heroClouds} aria-hidden="true">
              <CloudShader
                transparent
                count={3}
                scale={0.62}
                speed={0.5}
                cloudColor="#fdf7ee"
                skyTopColor="#7fb0dd"
                skyBottomColor="#f0d6a8"
              />
            </div>
          ) : null}
          {/* The registered ribbon-field intro plays in both themes, captures
              its frame, and releases the renderer; reduced-motion clients
              never mount a canvas (ARCHITECTURE 18.1, landing E2E). */}
          <RibbonScene key={theme} enabled={!reducedMotion} />
          <div className={styles.heroContent}>
            <p className={styles.heroIntro}>
              {t(
                locale,
                "Find rooms in Phnom Penh, near your uni.",
                "ស្វែងរកបន្ទប់នៅភ្នំពេញ ជិតសាកលវិទ្យាល័យរបស់អ្នក។",
              )}
            </p>
            <h1 id="hero-title" lang="km">
              ស្វែងរកបន្ទប់ជួលដែលអ្នកពេញចិត្ត​
              <br className={styles.desktopBreak} /> និងនៅជិតសាលាអ្នកបំផុត
            </h1>
            <div className={styles.phraseLoop}>
              <p className="sr-only">
                នៅជិតសាលារបស់អ្នក។ សមនឹងថវិការបស់អ្នក។ Near your university.
                Within your monthly budget.
              </p>
              <div className={styles.phraseWindow} aria-hidden="true">
                <div
                  key={activePhrase.en}
                  className={styles.phrase}
                  data-paused={introFinished || reducedMotion}
                >
                  <span lang="km">{activePhrase.km}</span>
                  <span lang="en">{activePhrase.en}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <div className={styles.content}>
          <section
            className={styles.searchSection}
            id="find-room"
            aria-label={t(locale, "Find a room", "ស្វែងរកបន្ទប់")}
          >
            <SearchBorderGlow>
              <form
                className={styles.searchBar}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!valid || !institution) return;
                  setSubmitted(true);
                  setAttempt((current) => current + 1);
                  resultSection.current?.scrollIntoView({
                    behavior: reducedMotion ? "instant" : "smooth",
                    block: "start",
                  });
                }}
              >
                <div className={styles.searchPanelTop}>
                  <span className={styles.rentTab}>
                    {t(locale, "Rent", "ជួល")}
                  </span>
                  <span>
                    {t(
                      locale,
                      "A room near your university",
                      "បន្ទប់នៅជិតសាកលវិទ្យាល័យរបស់អ្នក",
                    )}
                  </span>
                  <span className={styles.searchPanelCount}>
                    {results
                      ? t(
                          locale,
                          `${results.meta.total} results`,
                          `លទ្ធផល ${results.meta.total}`,
                        )
                      : t(locale, "Phnom Penh", "ភ្នំពេញ")}
                  </span>
                </div>
                <div className={styles.searchFields}>
                  <div className={styles.campusInput}>
                    <InstitutionPicker
                      id="landing-university"
                      label={t(
                        locale,
                        "Your university",
                        "សាកលវិទ្យាល័យរបស់អ្នក",
                      )}
                      selectedInstitution={institution}
                      onSelect={setInstitution}
                      onSelectionValidityChange={setValid}
                      disabled={institutionStatus === "loading"}
                      locale={locale}
                      hintLoop={campusHints}
                      hintLoopLabel={t(locale, "Try:", "សាកល្បង៖")}
                    />
                  </div>
                  <label className={styles.panelField}>
                    {t(locale, "Location", "ទីតាំង")}
                    <HoverSelect
                      aria-describedby="landing-city-note"
                      defaultValue="phnom-penh"
                    >
                      <option value="phnom-penh">
                        {t(locale, "Phnom Penh", "ភ្នំពេញ")}
                      </option>
                    </HoverSelect>
                  </label>
                  <label className={styles.panelField}>
                    {t(locale, "Distance from campus", "ចម្ងាយពីសាលា")}
                    <HoverSelect
                      value={radius}
                      onChange={(event) =>
                        setRadius(Number(event.target.value))
                      }
                    >
                      {[1000, 2000, 3000, 5000, 10000, 20000].map((value) => (
                        <option key={value} value={value}>
                          {t(
                            locale,
                            `Within ${value / 1000} km`,
                            `ក្នុងរង្វង់ ${value / 1000} គម`,
                          )}
                        </option>
                      ))}
                    </HoverSelect>
                  </label>
                  <label className={styles.panelField}>
                    {t(locale, "Room type", "ប្រភេទបន្ទប់")}
                    <HoverSelect
                      value={filters.propertyType}
                      onChange={(event) =>
                        setFilters({
                          ...filters,
                          propertyType: event.target
                            .value as LandingFilters["propertyType"],
                        })
                      }
                    >
                      <option value="">
                        {t(locale, "All room types", "គ្រប់ប្រភេទ")}
                      </option>
                      {ROOM_TYPE_OPTIONS.map((option) => (
                        <option value={option.value} key={option.value}>
                          {t(locale, option.en, option.km)}
                        </option>
                      ))}
                    </HoverSelect>
                  </label>
                </div>
                <div className={styles.searchActions}>
                  <button
                    className={styles.mapSearchButton}
                    type="submit"
                    disabled={!valid || institutionStatus === "loading"}
                  >
                    <LandingIcon name="pin" />
                    {t(locale, "Map search", "ស្វែងរកលើផែនទី")}
                  </button>
                  <button
                    className={styles.filterButton}
                    type="button"
                    ref={filterButton}
                    onClick={() => setFiltersOpen(true)}
                  >
                    <LandingIcon name="filter" />
                    {t(locale, "More filters", "តម្រងបន្ថែម")}
                    {filterCount ? <span>{filterCount}</span> : null}
                  </button>
                  <button
                    className={styles.searchButton}
                    type="submit"
                    disabled={!valid || institutionStatus === "loading"}
                  >
                    {t(locale, "Search", "ស្វែងរក")}
                    <LandingIcon name="arrow" />
                  </button>
                </div>
              </form>
            </SearchBorderGlow>
            <div className={styles.searchHint} id="landing-city-note">
              {institutionStatus === "loading" ? (
                <span role="status">
                  {t(locale, "Loading campuses…", "កំពុងផ្ទុកសាកលវិទ្យាល័យ…")}
                </span>
              ) : institutionStatus === "error" ? (
                <span role="alert">
                  {t(
                    locale,
                    "Campuses could not load.",
                    "មិនអាចផ្ទុកសាកលវិទ្យាល័យ។",
                  )}{" "}
                  <button
                    className={styles.textButton}
                    type="button"
                    onClick={() => setCampusAttempt((value) => value + 1)}
                  >
                    {t(locale, "Try again", "សាកល្បងម្ដងទៀត")}
                  </button>
                </span>
              ) : (
                <span>
                  {t(
                    locale,
                    "Start with your campus. Find a place that fits.",
                    "ចាប់ផ្ដើមពីសាលារបស់អ្នក។ រកកន្លែងដែលសមនឹងអ្នក។",
                  )}
                </span>
              )}
              <button
                type="button"
                className={styles.textButton}
                onClick={openDirectory}
              >
                {t(
                  locale,
                  "Browse university directory",
                  "មើលបញ្ជីសាកលវិទ្យាល័យ",
                )}
                <LandingIcon name="arrow" />
              </button>
            </div>
          </section>
          <section
            ref={resultSection}
            className={styles.exploreSection}
            id="explore"
            aria-labelledby="explore-title"
          >
            <h2 id="explore-title" className="sr-only">
              {t(locale, "Rental map", "ផែនទីបន្ទប់ជួល")}
            </h2>
            {submitted ? (
              <div className={styles.resultNotice} role="status">
                {resultStatus === "loading" ? (
                  t(
                    locale,
                    "Finding available rooms near your university…",
                    "កំពុងស្វែងរកបន្ទប់ទំនេរជិតសាលា…",
                  )
                ) : resultStatus === "error" ? (
                  <>
                    <span>
                      {t(
                        locale,
                        "Rooms could not load. Please try again.",
                        "មិនអាចផ្ទុកបន្ទប់។ សូមសាកល្បងម្ដងទៀត។",
                      )}
                    </span>
                    <button
                      className={styles.textButton}
                      type="button"
                      onClick={() => setAttempt((value) => value + 1)}
                    >
                      {t(locale, "Retry search", "ស្វែងរកម្ដងទៀត")}
                    </button>
                  </>
                ) : results?.meta.total === 0 ? (
                  <>
                    <span>
                      {t(
                        locale,
                        "No rooms match yet. Try a wider radius or a higher budget.",
                        "មិនទាន់មានបន្ទប់ត្រូវនឹងតម្រង។ សាកល្បងបង្កើនចម្ងាយ ឬថវិកា។",
                      )}
                    </span>
                    <button
                      className={styles.textButton}
                      type="button"
                      onClick={() => {
                        setRadius(10000);
                        setFilters(DEFAULT_LANDING_FILTERS);
                      }}
                    >
                      {t(locale, "Broaden search", "ពង្រីកការស្វែងរក")}
                    </button>
                  </>
                ) : (
                  t(
                    locale,
                    `${results?.meta.total ?? 0} available ${results?.meta.total === 1 ? "room" : "rooms"} · current listings`,
                    `បន្ទប់ទំនេរ ${results?.meta.total ?? 0} · បញ្ជីបច្ចុប្បន្ន`,
                  )
                )}
              </div>
            ) : null}
            <LandingMap
              rooms={rooms}
              institution={submitted ? institution : null}
              locale={locale}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {submitted && rooms.length ? (
              <div className={styles.liveResults}>
                <ul
                  aria-label={t(
                    locale,
                    "Current rental results",
                    "លទ្ធផលបន្ទប់បច្ចុប្បន្ន",
                  )}
                >
                  {rooms.map((room) => (
                    <li key={room.id} data-selected={selectedId === room.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(room.id)}
                        onFocus={() => setSelectedId(room.id)}
                      >
                        <strong>{room.title}</strong>
                        <span>
                          {room.price}/{t(locale, "month", "ខែ")} ·{" "}
                          {room.distance}
                        </span>
                      </button>
                      <Link href={room.href}>
                        {t(locale, "View room", "មើលបន្ទប់")}
                        <LandingIcon name="arrow" />
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link className={styles.outlineButton} href={searchHref}>
                  {t(
                    locale,
                    "See all results & filters",
                    "មើលលទ្ធផល និងតម្រងទាំងអស់",
                  )}
                  <LandingIcon name="arrow" />
                </Link>
              </div>
            ) : null}
          </section>
          <section
            className={styles.roomsSection}
            aria-labelledby="rooms-title"
          >
            <div className={styles.sectionHeading}>
              <div>
                <h2 id="rooms-title">
                  {t(
                    locale,
                    "A space for your student life.",
                    "កន្លែងសម្រាប់ជីវិតនិស្សិតរបស់អ្នក។",
                  )}
                </h2>
                <p>
                  {t(
                    locale,
                    "A few possibilities, from a room of your own to a place to share.",
                    "ជម្រើសខ្លះៗ ពីបន្ទប់ផ្ទាល់ខ្លួន រហូតដល់កន្លែងស្នាក់នៅរួមគ្នា។",
                  )}
                </p>
              </div>
              <Link className={styles.textButton} href={searchHref}>
                {t(locale, "Explore available rooms", "មើលបន្ទប់ទំនេរ")}
                <LandingIcon name="arrow" />
              </Link>
            </div>
            <div className={styles.roomGrid}>
              {SAMPLE_MAP_ROOMS.map((room, index) => (
                <article className={styles.roomCard} key={room.id}>
                  <div className={styles.roomPhoto}>
                    <Image
                      src={room.image ?? "/images/landing/student-room.png"}
                      alt={room.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 33vw"
                    />
                    <span className={styles.photoLabel}>
                      {t(locale, "Sample room", "បន្ទប់គំរូ")}
                    </span>
                  </div>
                  <div className={styles.roomInfo}>
                    <h3>
                      {t(
                        locale,
                        [
                          "Your own little corner",
                          "Room to make yourself at home",
                          "Better with a roommate",
                        ][index] ?? room.title,
                        [
                          "បន្ទប់ផ្ទាល់ខ្លួនរបស់អ្នក",
                          "កន្លែងរស់នៅប្រកបដោយផាសុកភាព",
                          "ចែករំលែកជាមួយមិត្តរួមបន្ទប់",
                        ][index] ?? room.title,
                      )}
                    </h3>
                    <div className={styles.roomSpecs}>
                      <span>
                        <LandingIcon name="bed" />
                        {index === 2 ? 2 : 1}{" "}
                        {t(locale, index === 2 ? "beds" : "bed", "គ្រែ")}
                      </span>
                      <span>
                        <LandingIcon name="floor" />
                        {t(locale, `Floor ${index + 1}`, `ជាន់ ${index + 1}`)}
                      </span>
                      <span>
                        <LandingIcon name="area" />
                        {["5 × 5 m", "5 × 6 m", "4 × 7 m"][index]}
                      </span>
                    </div>
                    <p className={styles.roomLocation}>
                      <LandingIcon name="pin" />
                      {t(
                        locale,
                        [
                          "Teuk La'ak · near RUPP",
                          "Tuol Kork · near ITC",
                          "Boeung Kak · Phnom Penh",
                        ][index] ?? "Phnom Penh",
                        [
                          "ទឹកល្អក់ · ជិត RUPP",
                          "ទួលគោក · ជិត ITC",
                          "បឹងកក់ · ភ្នំពេញ",
                        ][index] ?? "ភ្នំពេញ",
                      )}
                    </p>
                    <div className={styles.cardBottom}>
                      <strong>
                        {room.price}
                        <small>/{t(locale, "month", "ខែ")}</small>
                      </strong>
                      <Link
                        href={searchHref}
                        aria-label={t(
                          locale,
                          `Rent now: find available rooms like sample ${index + 1}`,
                          `ជួលឥឡូវ៖ ស្វែងរកបន្ទប់ដូចគំរូ ${index + 1}`,
                        )}
                      >
                        {t(locale, "Rent now", "ជួលឥឡូវ")}
                        <LandingIcon name="arrow" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <p className={styles.demoNote}>
              {t(
                locale,
                "Illustrative rooms and generated photos. Prices and room details are examples. “Rent now” takes you to available listings to contact a landlord.",
                "បន្ទប់ និងរូបថតជាគំរូ។ តម្លៃ និងព័ត៌មានបន្ទប់ជាឧទាហរណ៍។ «ជួលឥឡូវ» នាំទៅបញ្ជីបន្ទប់ទំនេរ ដើម្បីទាក់ទងម្ចាស់ផ្ទះ។",
              )}
            </p>
          </section>
          <section className={styles.about} id="about">
            <h2>
              {t(
                locale,
                "Less commuting. More student life.",
                "ធ្វើដំណើរតិច។ មានពេលសម្រាប់ជីវិតនិស្សិតច្រើន។",
              )}
            </h2>
            <div>
              <p>
                {t(
                  locale,
                  "Moving for university is a big step. Finding a room should feel a little easier. rentMe helps students in Phnom Penh compare places by what matters: distance, monthly rent, and the details that make a room work for you.",
                  "ការផ្លាស់ទីដើម្បីរៀននៅសាកលវិទ្យាល័យ គឺជាជំហានធំមួយ។ rentMe ជួយនិស្សិតនៅភ្នំពេញប្រៀបធៀបបន្ទប់តាមចម្ងាយ ថ្លៃជួលប្រចាំខែ និងព័ត៌មានដែលសំខាន់សម្រាប់អ្នក។",
                )}
              </p>
              <a href="#find-room" className={styles.textButton}>
                {t(locale, "Find your place", "ស្វែងរកកន្លែងរបស់អ្នក")}
                <LandingIcon name="arrow" />
              </a>
            </div>
          </section>
        </div>
      </main>
      <footer className={styles.footer} id="contact">
        <div className={styles.footerMain}>
          <div>
            <BrandMark />
            <p>
              {t(
                locale,
                "A little closer to where you belong.",
                "កាន់តែជិតកន្លែងដែលសមនឹងអ្នក។",
              )}
            </p>
          </div>
          <div>
            <strong>
              {t(locale, "Find a place", "ស្វែងរកកន្លែងស្នាក់នៅ")}
            </strong>
            <a href="#find-room">
              {t(locale, "Search rooms", "ស្វែងរកបន្ទប់")}
            </a>
            <button
              className={styles.textButton}
              type="button"
              onClick={openDirectory}
            >
              {t(locale, "University directory", "បញ្ជីសាកលវិទ្យាល័យ")}
            </button>
          </div>
          <div>
            <strong>{t(locale, "Get in touch", "ទំនាក់ទំនង")}</strong>
            <Link href={searchHref}>
              {t(
                locale,
                "Find a room & contact its landlord",
                "ស្វែងរកបន្ទប់ និងទាក់ទងម្ចាស់ផ្ទះ",
              )}
            </Link>
            <Link href="/inquiries">
              {t(locale, "Your inquiries", "សំណួររបស់អ្នក")}
            </Link>
            <Link href="/register">
              {t(locale, "Have a room to rent?", "មានបន្ទប់សម្រាប់ជួល?")}
            </Link>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} rentMe</span>
          <span>
            {t(
              locale,
              "Made for student life in Cambodia.",
              "សម្រាប់ជីវិតនិស្សិតនៅកម្ពុជា។",
            )}
          </span>
          <span>ភ្នំពេញ · Phnom Penh</span>
        </div>
      </footer>
      {filtersOpen ? (
        <FilterDialog
          locale={locale}
          filters={filters}
          onClose={closeFilters}
          onApply={(value) => {
            setFilters(value);
            closeFilters();
          }}
        />
      ) : null}
    </div>
  );
}

---
name: rentMe frontend
description: Clear, Khmer-friendly rental discovery centered on a student's institution.
colors:
  background: "#ffffff"
  surface: "#f5f7f9"
  surface-strong: "#eaf2f5"
  ink: "#1c2934"
  muted: "#5c6973"
  primary: "#087b9d"
  primary-strong: "#075b75"
  primary-light: "#e8f4f8"
  landing-primary-light: "#eaf5fa"
  border: "#dce3e8"
  landing-border: "#dde3e7"
  available: "#1764c0"
  unavailable: "#b43b36"
  focus: "oklch(0.55 0.16 245)"
  landing-focus: "#2589ed"
  dark-background: "#101820"
  dark-surface: "#18232d"
  dark-surface-strong: "#223240"
  dark-ink: "#f0f4f8"
  dark-muted: "#b7c5d0"
  dark-primary: "#75b3ff"
  dark-primary-strong: "#acd1ff"
  dark-primary-light: "#173454"
  dark-border: "#35414d"
  dark-landing-muted: "#a8b5c1"
  dark-landing-primary: "#89cef1"
  dark-landing-primary-strong: "#b6e6ff"
  dark-landing-primary-light: "#173747"
  dark-landing-unavailable: "#ffaaa6"
typography:
  display:
    fontFamily: '"Kantumruy Pro", "Khmer OS System", system-ui, sans-serif'
    fontSize: clamp(38px, 4.4vw, 62px)
    fontWeight: 600
    lineHeight: 1.65
    letterSpacing: "0"
  display-phone:
    fontFamily: '"Kantumruy Pro", "Khmer OS System", system-ui, sans-serif'
    fontSize: clamp(30px, 8.7vw, 38px)
    fontWeight: 600
    lineHeight: 1.7
  headline:
    fontFamily: '"Kantumruy Pro", "Khmer OS System", system-ui, sans-serif'
    fontSize: clamp(23px, 2.25vw, 32px)
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: -0.025em
  body:
    fontFamily: '"Kantumruy Pro", "Khmer OS System", system-ui, sans-serif'
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  landing-body:
    fontFamily: '"Kantumruy Pro", "Khmer OS System", system-ui, sans-serif'
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.65
  navigation:
    fontFamily: '"Kantumruy Pro", "Khmer OS System", system-ui, sans-serif'
    fontSize: 13px
    fontWeight: 600
  rental-heading:
    fontFamily: '"Kantumruy Pro", "Khmer OS System", system-ui, sans-serif'
    fontSize: clamp(1.75rem, 3.2vw, 2.8rem)
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: -0.025em
rounded:
  control: 8px
  landing-panel: 12px
  rental-panel: 14px
  search-action: 25px
spacing:
  compact: 8px
  control-gap: 12px
  related: 16px
  card-padding: 20px
  section-gap: 24px
  search-padding: 30px
components:
  button-search:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.search-action}"
    padding: 9px 24px
    height: 46px
  button-search-hover:
    backgroundColor: "{colors.primary-strong}"
  button-filter:
    textColor: "{colors.primary}"
    rounded: "{rounded.search-action}"
    padding: 9px 19px
    height: 44px
  field:
    backgroundColor: "{colors.background}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: 8px 12px
  room-card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.ink}"
    rounded: "{rounded.landing-panel}"
  account-form:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.landing-panel}"
    padding: 34px
---

# Design System: rentMe frontend

## Overview

**Creative North Star: "A clear place to start"**

rentMe is practical, local student rental discovery. White neutral surfaces,
readable Khmer typography and purposeful cyan-blue controls keep the institution,
monthly budget and next search action easy to find. Calm presentation supports
specific rental information instead of decorative trust claims.

This reference records the September 2026 user-directed revision. The centered
hero and white-and-blue public surfaces supersede the former olive palette and
split hero. The landing composition is a surface-specific decision, not a rule
to center every product page. Public account, search and detail pages share the
appearance and language preferences while retaining their task-appropriate layouts.

**Key Characteristics:**

- White-first surfaces with cyan search actions and dark readable text.
- Kantumruy Pro for Khmer and Latin text, with stable bilingual layouts.
- Compact navigation, outlined fields and room photography with clear provenance.
- Maps and short motion introductions enhance a usable search and list path.

Evidence is the final CSS cascade in `src/features/landing/rentme.module.css`
and `src/app/globals.css`, the root font setup, landing/header components,
`src/features/preferences/site-preferences.tsx`, and the current
`../.impeccable/landing-brief.md`. Older declarations remain in the stylesheets;
the later overrides determine the values above. Regression review was still
underway when this document was refreshed. This is a source-based record, not
a claim that full visual, browser or accessibility QA has passed.

## Colors

Cool white and neutral gray surfaces carry the content; cyan directs search
actions and deeper blue identifies available rental examples.

### Primary

- **Search Cyan** (`primary`): search strip, main search action and account submit.
- **Deep Search Cyan** (`primary-strong`): darker hover state and shared strong actions.
- **Quiet Cyan** (`primary-light`): shared selected surfaces; the landing uses its
  separately recorded `landing-primary-light` value.
- **Available Blue** (`available`): accompanies an explicit label/icon on available
  examples. Unavailable examples use `unavailable`, a red with a distinct label/shape.

### Neutral

- **White** (`background`) is the initial page surface; `surface` supports account
  forms and quiet secondary regions. `surface-strong` marks stronger grouping.
- **Slate Ink** (`ink`) carries titles and body copy; `muted` carries supporting text.
- **Cool Divider** (`border`) separates shared controls; the landing's scoped
  divider is `landing-border`.
- Dark appearance uses the `dark-*` tokens. The landing deliberately has scoped
  cyan and muted values, recorded with the `dark-landing-*` prefix. Do not flatten
  those distinctions by extracting the first declaration in a stylesheet.

**The State Has Words Rule.** Availability, selection, loading and errors must
remain understandable without color. Keep the label, icon, shape or control state.

## Typography

**Display Font:** Kantumruy Pro, with Khmer OS System, system-ui and sans-serif fallback.
**Body Font:** The same stack. The root loads Khmer and Latin subsets at 400, 600 and 700.

The hierarchy comes from weight, scale, spacing and wrapping. No decorative
serif pairing, gradient type or replacement Khmer font belongs in this system.

### Hierarchy

- **Display:** the large centered Khmer hero uses the `display` token. At widths
  up to 820px it is 43px; up to 640px it uses `display-phone`.
- **Headline:** landing section titles use the `headline` token and balanced wrapping.
- **Body:** shared product screens use `body`; the landing uses `landing-body`.
- **Navigation:** compact semibold labels use `navigation`; the phone header
  reduces action labels as defined by the component styles.
- **Rental heading:** retains the established detail-page hierarchy. Prices and
  photo counters use tabular numerals; description text preserves line breaks.

**The Khmer Is Content Rule.** Preserve the approved headline exactly:
`ស្វែងរកបន្ទប់ជួលដែលអ្នកពេញចិត្ត​ និងនៅជិតសាលាអ្នកបំផុត`.
The hero and introductory phrases are explicit bilingual copy exceptions.
Translate authored UI through the language catalog; preserve user text, proper
names, numbers, URLs and technical identifiers.

## Layout

The landing header is one row: 66px on desktop, 62px below 820px and 58px below
640px. Desktop uses three tracks for brand, navigation and account/preferences.
Mobile keeps the brand and direct preference/menu controls in the row and opens
navigation as cards beneath it. Do not restore a permanent second navigation row.

The landing content is centered within 1216px with 48px side gutters at wide
widths; phone gutters reduce to 18px, then 14px below 359px. The hero content
maximum is 1200px. Its minimum height is 490px desktop, 440px tablet and 435px
phone; actual content may grow. Search follows it with a 22px gap, reducing to
10px on phones. The map follows the search panel, then illustrative room cards,
product information and footer. The full institution directory has its own
`/universities` route; rental search remains focused on Phnom Penh.

The search panel groups a cyan Rent strip, campus/location/distance/type fields,
then map/filter/search actions. Below 820px fields use two columns with campus
and room type spanning the width. Below 359px all fields stack. On phones search
occupies its own full-width action row. The map and selected room stack below
640px, while full search uses an explicit list/map switch below 960px.

Shared product content retains its 1180px maximum. Account forms pair explanatory
copy with a neutral form surface on desktop and stack below 640px. Rental detail
keeps its asymmetric gallery/summary composition, switching to a single column
below 800px. Detail photographs reserve a 4:3 frame and use containment; landing
room previews use cover crops in their reserved card frames.

## Elevation & Depth

Most separation comes from neutral surfaces, spacing and thin dividers. Shadows
support search, floating menus and small hover responses. Account forms and
rental summaries stay flat. Do not give every section a floating-card shadow.

### Shadow Vocabulary

- **Menu elevation:** `0 12px 40px #10274214`; the scoped dark landing variant uses
  `0 12px 40px #00000035`.
- **Search panel:** `0 10px 28px #172c4114`.
- **Room hover:** `0 12px 30px #172c4112`, paired with a restrained upward shift.
- **Hover options:** `0 12px 30px #14283926`.

**The Border Only Rule.** The user-requested pointer glow belongs only to the
search panel's masked 2px border. Its colored conic gradient and small glow are
a scoped exception, not a new gradient palette. Do not tint, blur or replace the
form surface. The effect is absent for reduced-motion users and ignores touch.

## Shapes

Outlined inputs use the small control radius; landing cards and search panels
use the landing-panel radius; existing rental-detail surfaces retain the
rental-panel radius. Search/filter actions are rounded capsules. Most borders
are neutral and thin; a colored outline indicates state or a purposeful action.

Focus is a visible 3px outline with 3px offset on shared controls and 4px offset
in the scoped landing. It must remain distinct from decorative border glow.
Retain semantic links, labels and explicit disabled states.

## Components

### Buttons

Primary search uses Search Cyan with white text, a darker hover and a clear
disabled surface (`#d4dde5` with `#586875` text). Map and filter controls use cyan
outlines, with a pale fill for map search. Ordinary actions change background or
border on hover rather than fading. Do not imply that every action has the same
shape: the landing filter-dialog submit still uses its existing rectangular blue
primary style. Account submit uses a 24px radius and a minimum 48px height.

### Inputs / Fields

Labels remain visible above values inside outlined fields. Campus search has a
real selectable popover, loading/error recovery and ellipsis for the value;
popover options can wrap. Phone campus inputs use 16px text. Native selects
remain usable on touch; hover menus enrich pointer use. Budget filters open a
dialog with focus containment, Escape/close behavior and an explicit Apply action.

### Navigation

The rentMe wordmark is compact; icons communicate actions rather than decorate
every label. Desktop location navigation supports hover and keyboard operation.
Below 820px, the menu expands into a white card layout with pale navigation
cards and a cyan signup action. This light card menu is an observed scoped
treatment even in dark appearance, not permission to remove dark mode elsewhere.
Direct language and theme buttons remain available in the header.

`SitePreferences` defaults to English and light appearance, restores locally
saved Khmer/English and light/dark choices, and carries them across public
routes. Storage failure retains the current-visit preferences. These are
presentation choices; they never grant a role or entitlement.

### Cards / Containers

Rental cards prioritize photograph, monthly price, rental title, meaningful
location/distance, amenities and explicit availability. Samples remain labelled
illustrative and separate from current backend results. A small hover lift does
not replace a visible link or keyboard focus. The detail gallery keeps retry,
empty and failure states; no price, deposit, freshness or contact data is guessed.
Inquiry and saved-rental surfaces inherit shared neutral and cyan tokens, with
clear status text and long user messages wrapping naturally.

### Hero texture and phrase introduction

The exact registered ThreeUI Ribbon Field source is preserved. Its wrapper
captures the authored WebGL frame at 4.8 seconds and then releases the animated
renderer, leaving the frame still. If capture is unavailable or blocked, the
introduction still ends and the plain hero surface remains. The phrase changes at 2.4 seconds and ends
its introduction at 4.8 seconds, without a pause button. A stable accessible
equivalent remains available; visual phrases are hidden from assistive technology
and never produce repeated live announcements. Reduced motion skips the motion.
The main headline and search controls must not wait for the enhancement.

The white hero uses a faint inverted/multiplied ribbon texture; dark appearance
uses the city image beneath a screened ribbon. The generated house illustration
is removed. The requested private light-image URL returned 403, so the white
surface does not pretend to contain that image. The dark city edit is 1672×941,
not the requested 4K. Preserve these asset limitations and provenance until actual
replacement assets are supplied.

### Map and availability

Default, satellite and flat 2D modes must produce real map changes. Without
Google Maps JavaScript credentials, the Google campus/location embed and a
separate accessible room list are the fallback. The embed does not show custom
synchronized multi-listing markers. Those require configured Maps JavaScript;
do not draw illustrative inventory onto the real embed. Current rental data
comes from the backend; selection remains associated with listing IDs.

The 3D map is progressive enhancement. Loading, unavailable/error, reduced-motion
and unsupported-device states preserve the list and meaningful next actions.
The landing can explain unavailable samples, while actual default student search
uses published, available inventory.

## Do's and Don'ts

### Do:

- **Do** preserve white-first surfaces, cyan search hierarchy and readable dark appearance.
- **Do** retain Kantumruy Pro, explicit labels, visible focus and stable Khmer wrapping.
- **Do** keep search before maps on mobile and offer a complete list alternative.
- **Do** distinguish illustrative samples, current listings and unverified asset requirements.
- **Do** keep language and appearance preferences consistent across public routes.

### Don't:

- **Don't** restore the obsolete olive palette or split landing hero.
- **Don't** turn the search-border effect into a full-surface glow, gradient hero or glass card.
- **Don't** invent availability, verification, prices, statistics, testimonials or map markers.
- **Don't** make motion, color or Google Maps the only way to understand a rental.
- **Don't** re-add a pause control or a second phrase cycle to the landing intro;
  the introduction is finite and ends on its own.
- **Don't** leave a second skeleton for one loading region; the phone map
  skeleton is hidden, so assertions cover visibility rather than element counts.

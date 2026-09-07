---
name: FindMe frontend
description: Practical, Khmer-friendly student rental discovery.
colors:
  background: "oklch(1 0 0)"
  surface: "oklch(0.965 0.012 110)"
  surface-strong: "oklch(0.91 0.025 110)"
  ink: "oklch(0.19 0.025 118)"
  muted: "oklch(0.43 0.025 118)"
  primary: "oklch(0.47 0.105 110)"
  primary-strong: "oklch(0.38 0.11 110)"
  primary-light: "oklch(0.88 0.075 110)"
  available: "oklch(0.46 0.13 142)"
  focus: "oklch(0.55 0.16 245)"
  border: "oklch(0.83 0.02 110)"
typography:
  body:
    fontFamily: '"Kantumruy Pro", "Khmer OS System", system-ui, sans-serif'
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  rental-heading:
    fontFamily: '"Kantumruy Pro", "Khmer OS System", system-ui, sans-serif'
    fontSize: clamp(1.75rem, 3.2vw, 2.8rem)
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: -0.025em
  rental-section:
    fontFamily: '"Kantumruy Pro", "Khmer OS System", system-ui, sans-serif'
    fontSize: 1.25rem
    fontWeight: 700
    lineHeight: 1.45
rounded:
  sm: 8px
  md: 14px
spacing:
  compact: 12px
  related: 24px
  section: 28px
components:
  contact-action:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.background}"
    rounded: "{rounded.sm}"
    padding: 10px 14px
  contact-action-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.background}"
  rental-summary:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: 24px
---

# FindMe frontend design

## Overview

Record of the existing frontend foundations and the reviewed rental-detail
surface. The application remains practical, local, trustworthy, and
student-oriented. This reference does not replace PRD or AGENTS requirements.
Evidence: `src/app/globals.css`, `src/app/layout.tsx`, and
`src/features/rentals`. Other surfaces keep their established compositions.

## Colors

Quiet white and olive-neutral surfaces support dark readable text. Olive marks
primary actions. Green accompanies an explicit availability label and check
shape; it never communicates availability by itself. Blue is reserved for
visible keyboard focus in these controls.

## Typography

Kantumruy Pro serves both Khmer and Latin text, using the loaded 400, 600, and
700 weights. Rental headings use balanced wrapping; description and rule text
wrap naturally and preserve line breaks. Body passages are limited to 72ch.
Prices and photo counters use tabular numerals. Bilingual text has explicit
language attributes rather than decorative font mixing.

## Layout

The shared content maximum is 1180px. Detail pages use unequal photo/content
and summary columns above 800px, then gallery, summary, and facts in a single
column. The summary is sticky only on desktop. At 400px and below, detail
gutters narrow and the amenity list becomes one column. Photos reserve a 4:3
frame and use containment, preserving portrait images without cropping.

## Elevation & Depth

Rental detail uses tonal separation and section dividers, not shadows on its
summary. Other established surfaces retain their existing restrained shadow.
Do not add a shadow to every panel merely to match older cards.

## Shapes

Small radii distinguish controls from the more softly rounded photo and summary
surfaces. Native links remain visibly underlined. Focus uses a 3px outline
with a 3px offset, not a low-contrast glow.

## Components

Contact actions are full-width native links, at least 48px tall. Hover changes
their background while preserving contrast. Secondary photo controls have
visible borders, 44px minimum height, and explicit disabled styling.

The gallery uses ordered real listing images, bounded previous/next controls,
a polite photo counter, and per-photo retry. Empty and failed photos have
different copy. A single-photo failure does not suggest another photo.

The summary groups rent, availability, confirmation date, deposit, and permitted
contact channels. A zero deposit is shown as zero; missing information is
labelled rather than guessed. Facts use definition lists and amenities use
semantic lists. Location and distance stay understandable without a map.

## Do's and Don'ts

- Do preserve the shared palette and Khmer-capable typography.
- Do keep explicit availability text, keyboard focus, and usable image recovery.
- Do separate listing-update time from availability-confirmation time.
- Don't turn synthetic QA photos or contact data into production content.
- Don't add decorative motion, invented trust claims, or private account fields.

## Inquiry surfaces

The inquiry form extends rental detail with the same 16px Khmer-capable type,
olive primary action, labelled textarea and explicit inline success/errors.
The inbox pages inherit the saved-rentals heading scale and neutral list
composition: sender/time and status, rental title, message, then status actions.
Small supporting text follows the existing 0.875–0.9rem product styles.
Messages preserve line breaks and wrap long text. Actions use 44px minimum touch
targets, visible focus, and no motion. On phones the navigation and action rows
wrap; status changes return focus to the affected inquiry.

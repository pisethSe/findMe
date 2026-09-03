# AGENTS.md — Engineering and Design Instructions

These instructions apply to all coding agents, AI assistants, and contributors working in this repository.

The product is a **student-first Cambodian rental discovery SaaS**. Preserve the product scope and architecture defined in `PRD.md`, `ARCHITECTURE.md`, and `ARCHITECTURE-ESSENTIALS.md`.

---

## 1. Required Reading Order

Before implementing a task, read:

1. `PRD.md`
2. `ARCHITECTURE-ESSENTIALS.md`
3. the relevant sections of `ARCHITECTURE.md`
4. this `AGENTS.md`
5. existing code/tests related to the task

If documents conflict, use this priority:

```text
explicit current user/task instruction
> PRD.md product requirements
> ARCHITECTURE-ESSENTIALS.md critical architecture rules
> ARCHITECTURE.md detailed architecture
> AGENTS.md implementation/design guidance
> existing implementation conventions
```

Do not silently change a product or architecture decision because another approach seems more fashionable.

---

## 2. Completion Gate — Mandatory

**Do not move to the next task until the current task is complete and reviewed.**

For every task:

1. Understand the requirement and affected flows.
2. Inspect the relevant existing code before editing.
3. Implement the complete requested behavior.
4. Review the implementation against the request and repository architecture.
5. Run the relevant formatter, lint, type-check, tests, and build checks that are available.
6. Manually inspect important UI states when the task changes UI.
7. Check error, loading, empty, permission, and mobile states when relevant.
8. Fix discovered issues.
9. Re-run checks after fixes.
10. Only then declare the task complete and proceed.

A task is **not complete** when:

- code is left as TODO/pseudocode for required behavior;
- TypeScript errors remain;
- tests for changed critical behavior are failing;
- ownership/authorization is implemented only in the UI;
- the happy path works but required loading/error/empty states are broken;
- the implementation contradicts the architecture;
- a feature is visually present but not connected to real data when real data was required;
- an existing working flow was broken and not repaired.

Never claim “100% complete” unless the available checks and review actually support that claim. State any unverified limitation clearly.

---

## 3. Product Focus

Prioritize the student workflow:

> Select a school/university/college -> find nearby rentals -> filter by needs -> compare on map/list -> inspect listing -> favorite or inquire.

Landlord functionality exists to create accurate, current supply for that student journey.

Do not expand the MVP into a generic real-estate marketplace unless explicitly requested.

---

## 4. Architecture Rules

- Frontend: **Next.js App Router + TypeScript**.
- Backend: **NestJS + TypeScript**, versioned REST API.
- Database: **Neon PostgreSQL + PostGIS**.
- Redis: cache, rate limits, and ephemeral/queue use only.
- Docker: local/deployment consistency.
- Google Maps: maps, places, geocoding, and optional routes.
- PostgreSQL remains the source of truth for users, institutions, properties, listings, favorites, inquiries, reports, and moderation.
- Store rental image binaries in object storage, not PostgreSQL.
- Keep `Property` separate from `Listing`.
- Geographic search happens server-side with PostGIS.
- Do not introduce microservices without an explicit architecture change.

---

## 5. Backend Engineering Rules

### Controllers

Controllers should:

- parse HTTP inputs through DTOs;
- call application/domain services;
- return response DTOs;
- stay thin.

Controllers should **not** contain:

- raw geographic SQL;
- complex ownership rules;
- listing state-machine logic;
- direct cache-key business logic;
- large transaction workflows.

### Services/domain logic

Business rules belong in services/domain functions and must be testable.

Examples:

- landlord owns listing;
- listing can transition from `PENDING_REVIEW` to `PUBLISHED` only by authorized moderation logic;
- inquiry can target only a valid published listing;
- public search cannot return paused/rejected/draft listings.

### Database

- Use migrations for schema changes.
- Use constraints for invariants when practical.
- Parameterize all SQL.
- Keep advanced PostGIS SQL in a dedicated repository/data-access layer.
- Add indexes based on actual query patterns.
- Avoid N+1 queries.
- Use transactions for multi-write operations that must be atomic.

### Redis

- Never put durable marketplace state only in Redis.
- Set explicit TTLs when cached data should expire.
- Define invalidation behavior for cached mutable data.
- Do not globally cache user-specific authenticated responses.

---

## 6. Authorization Rules

Every protected backend mutation must answer:

1. Is this user authenticated?
2. Does this role have permission?
3. Does this user own/manage this resource when ownership is required?
4. Is this operation valid for the resource’s current state?

Never accept a client-supplied `landlordId`, `studentId`, `role`, `verified`, or moderation field as authoritative when it can be derived from the authenticated session or server state.

A hidden/disabled frontend button is not security.

---

## 7. Map and Location Rules

- Rental coordinates are stored in PostgreSQL.
- Institution coordinates are stored in PostgreSQL.
- Use PostGIS for radius, distance, and map viewport filtering.
- Google Maps renders/enriches location; it is not the rental database.
- Request browser location only after a user action and browser permission.
- Do not implement continuous student tracking.
- Debounce viewport search requests.
- Keep list and map selection synchronized by listing ID.
- Do not call paid route/travel-time APIs for hundreds of raw search candidates.
- Treat Google Maps 3D as progressive enhancement. Preserve a usable 2D map and listing-card fallback for unsupported devices, disabled hardware acceleration, slow/failing networks, quota errors, and reduced-motion users.
- Keep 3D camera motion restrained, interruptible, and off when `prefers-reduced-motion` applies.
- Availability markers must include label/icon/shape state in addition to green/red color.

---

## 8. Security and Privacy Rules

- Validate every external input.
- Never log passwords, password reset tokens, access tokens, refresh tokens, secret keys, or full sensitive credentials.
- Hash passwords with an approved modern algorithm such as Argon2id.
- Treat user-generated text as untrusted.
- Do not render arbitrary landlord HTML.
- Validate image type/size/count.
- Separate/restrict browser and server Google Maps API keys.
- Keep student favorites and inquiries private.
- Collect only personal data needed for the feature.
- Do not create student location history for the MVP.
- Never trust a client-provided role, onboarding-complete flag, trial timestamp, entitlement status, or subscription state.
- Users may self-select only `STUDENT` or `LANDLORD`; `ADMIN` requires a privileged server-side process.
- Enforce the one-time seven-day landlord trial with server time and durable database state on every restricted supply action.

---

## 9. TypeScript Rules

- Prefer strict TypeScript.
- Do not introduce `any` when a reasonable type can be defined.
- Do not suppress TypeScript/ESLint errors simply to make checks pass.
- Avoid unsafe non-null assertions unless the invariant is proven nearby.
- Use enums/unions for known domain states.
- Validate network/runtime data even when TypeScript types exist.

---

## 10. API Contract Rules

- Version public API under `/api/v1`.
- Use stable machine-readable error codes.
- Do not expose ORM/database entities directly when they contain internal fields.
- Use response DTOs/serializers.
- Do not leak `password_hash`, token hashes, moderation notes, or private internal fields.
- Pagination must be explicit.
- Search query parameters must be normalized and validated.

---

## 11. Frontend Engineering Rules

- Keep App Router route/page files focused on routing/composition.
- Organize significant product code by feature/domain.
- Use client components only when browser interactivity requires them.
- Keep Google Maps code inside dedicated client components/hooks.
- Use a consistent typed API client.
- Keep search filter state in URL query parameters when practical.
- Provide loading, empty, error, disabled, and success states.
- Mobile is a primary viewport, not an afterthought.
- Map functionality must have a usable list alternative.
- Keep role onboarding routing based on typed server state, not local storage or query parameters.
- Keep the landing 3D map and phrase loop in dedicated client components; the headline and primary actions must render without waiting for those enhancements.

---

## 12. UI/Visual Direction

The interface should feel practical, local, trustworthy, clear, and student-oriented. It should not look like a generic AI-generated SaaS landing page.

Use:

- strong information hierarchy;
- readable type;
- high contrast;
- deliberate neutral surfaces;
- consistent spacing;
- useful maps and rental photography;
- familiar rental/search interaction patterns;
- restrained motion only when it improves understanding;
- clear Khmer/English localization support;
- real content patterns instead of marketing filler.

The approved landing hero is a specific product requirement, not a generic SaaS template:

- desktop: Khmer value proposition and actions on the left, bounded 3D rental-map preview on the right;
- mobile: stack the copy/action before the map and do not force a cramped split view;
- use the exact headline `ស្វែងរកបន្ទប់ជួលដែលអ្នកពេញចិត្ត​ និងនៅជិតអ្នកបំផុត.` unless the user explicitly approves a copy change;
- available preview rentals are green plus a visible available label/icon; unavailable preview rentals are red plus an unavailable label/icon;
- actual student search defaults to published, available inventory even though the landing demo may explain both states;
- a vertical supporting-phrase loop is permitted only with fixed dimensions, purposeful timing, and accessibility behavior defined below.

---

## 13. Forbidden / Avoided UI Patterns

Avoid all of the following unless an explicit task specifically overrides the rule for a justified reason:

1. Purple-to-blue gradients.
2. Gradient hero text.
3. Emojis in headings.
4. Inter font everywhere.
5. Colored-border cards used as a default visual system.
6. Glassmorphism cards.
7. Low-contrast dark mode.
8. Generic “3 icon boxes in a row” feature sections.
9. Badge/pill above the main headline as a default hero pattern.
10. Lucide icons everywhere. Use icons only when they add meaning; do not decorate every label/button.
11. Untouched/default shadcn/ui appearance. Components may be used as primitives but must fit this product’s visual system.
12. Fade-in-on-scroll effects across page sections.
13. Cursor-following beams/glows/spotlights.
14. Buttons that only communicate hover by fading opacity. Use clear state changes and preserve contrast.
15. Inconsistent spacing.
16. Em dashes everywhere. Prefer normal punctuation and sentence structure.
17. Generic buzzword copy such as “revolutionize,” “seamless ecosystem,” or “next-generation platform” without concrete meaning.
18. Serif italic accents used as decorative SaaS styling.
19. The generic Space Grotesk + Instrument Serif pairing as a shortcut to visual identity.
20. Grain/noise overlays on gradients.
21. Glassmorphism as the primary or “premium” visual direction. It is explicitly not the design strategy for this product.

When uncertain, choose clarity and usefulness over decorative trends.

---

## 14. Typography Guidance

Do not default the entire product to Inter simply because it is common.

Choose a type stack that:

- renders Khmer correctly;
- remains highly readable on mobile;
- has sufficient weights;
- loads efficiently;
- does not require decorative font mixing to create hierarchy.

Use **Kantumruy Pro from Google Fonts for all Khmer text**. Do not silently substitute another Khmer font. Load only the weights required by the implemented screens and keep a Khmer-capable system fallback.

Prefer hierarchy through size, weight, spacing, and layout rather than trendy font pairings.

---

## 15. Component Design Rules

Rental cards should prioritize:

1. photo;
2. monthly price + currency;
3. rental type/title;
4. distance from selected institution when available;
5. important amenities;
6. availability/freshness;
7. location context.

Do not overload cards with every database field.

Filters must be usable on mobile. Large filter sets should use a well-structured sheet/drawer/dialog rather than squeezing all controls into a desktop toolbar.

Map markers must have selected/unselected states that do not depend on low contrast.

---

## 16. Copywriting Rules

Write copy for real students and landlords.

Prefer:

- “Find rooms near your university”
- “Monthly rent”
- “2.1 km from RUPP”
- “Available now”
- “Last confirmed 3 days ago”

Avoid:

- “Unlock your perfect living journey”
- “Revolutionize your accommodation experience”
- “Discover the future of student living”
- vague trust claims without evidence.

Do not fabricate statistics, landlord verification, number of properties, student counts, ratings, or testimonials.

---

## 17. Accessibility Rules

- Use semantic elements before generic divs.
- Every form control needs an accessible label.
- Every interactive control must be keyboard reachable.
- Keep visible focus indication.
- Maintain adequate text/control contrast.
- Do not communicate state using color alone.
- Images need meaningful alt text where applicable.
- Icon-only buttons need accessible names.
- Maps cannot be the only way to access rental information.
- Respect reduced-motion preferences.
- The landing phrase loop must expose stable accessible copy, avoid repeated `aria-live` announcements, stop changing for reduced-motion users, and provide pause control if its duration/behavior requires one.
- Reserve stable hero/map dimensions so animation does not cause layout shift.

---

## 18. Responsive Rules

Test at minimum:

- small phone;
- common mobile width;
- tablet;
- desktop.

Critical student flows must work comfortably with touch input.

For search on mobile, prioritize rental cards and provide an obvious way to switch/open the map rather than forcing a cramped permanent split screen.

---

## 19. Loading / Empty / Error States

Every data-driven screen must define relevant states.

Examples:

### Search loading

Use a stable layout/skeleton. Avoid dramatic animation.

### No rentals found

Explain the cause and provide useful next actions such as increasing radius or budget. Do not blame the user.

### Google Maps failed

Keep rental cards usable and show a clear map error/retry state.

### Listing unavailable

Clearly show that it is no longer available and remove/disable invalid inquiry actions.

### Unauthorized

Do not leak whether private resources exist when the user has no access.

---

## 20. Testing and Verification Before Completion

For each change, run the checks that exist in the repository and apply to it. Typical checks:

```text
format
lint
type-check
unit tests
integration tests
e2e tests
production build
```

For database changes:

- review migration SQL;
- test migration on a non-production database;
- confirm indexes/constraints;
- confirm old code paths remain valid or are migrated.

For UI changes manually verify:

- mobile layout;
- keyboard/focus behavior;
- loading state;
- empty state;
- error state;
- long text;
- Khmer text where localization is involved.
- 3D map fallback and reduced-motion behavior;
- availability states remain understandable without color.

For authorization changes verify both allowed and denied cases.

For onboarding/entitlement changes verify self-service `ADMIN` rejection, established-role overwrite rejection, one-time trial activation, server-time expiry, post-expiry write denial without data loss, and unit-count invariants.

---

## 21. Do Not Hide Failures

Never “fix” a task by:

- deleting a failing test without replacing its intent;
- weakening assertions solely to get green CI;
- adding blanket `eslint-disable`/`@ts-ignore` rules;
- swallowing errors with empty `catch` blocks;
- returning fake success responses;
- hardcoding demo data in a path expected to use real backend data;
- bypassing authorization or validation;
- claiming a command passed when it was not run or failed.

If an external dependency prevents a check, report exactly what remains unverified.

---

## 22. Scope Discipline

When implementing a task:

- make the smallest coherent set of changes that fully solves it;
- refactor nearby code only when required for correctness/maintainability;
- do not redesign unrelated screens;
- do not add major dependencies without need;
- do not change architecture silently;
- do not build speculative features outside the PRD.

---

## 23. Documentation Discipline

Update documentation when a change alters:

- public API behavior;
- environment variables;
- database schema or migration expectations;
- architecture decisions;
- role/permission rules;
- development commands;
- deployment requirements.

If a critical architecture decision intentionally changes, update both `ARCHITECTURE.md` and `ARCHITECTURE-ESSENTIALS.md` in the same task.

---

## 24. Definition of Done Checklist

Before finishing any implementation task, confirm:

- [ ] The requested behavior is fully implemented.
- [ ] Product scope still matches `PRD.md`.
- [ ] Critical architecture still matches `ARCHITECTURE-ESSENTIALS.md`.
- [ ] Authorization and ownership rules are enforced server-side.
- [ ] Inputs are validated.
- [ ] Errors do not leak secrets/internal data.
- [ ] Loading/empty/error states are handled where relevant.
- [ ] Mobile behavior was considered/checked for UI work.
- [ ] Accessibility basics are preserved.
- [ ] No forbidden default/trendy UI pattern was introduced.
- [ ] Database migration/index/constraint needs are handled.
- [ ] Relevant tests were added or updated.
- [ ] Formatter/lint/type-check/tests/build were run as available.
- [ ] Failures found during review were fixed and checks re-run.
- [ ] Documentation was updated if behavior/architecture changed.
- [ ] No required TODO or fake implementation remains.

Only after this checklist is satisfied should the agent move to the next task.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Product research

Research date: 1 September 2026

## Problem statement

Students arriving in Phnom Penh from Cambodian provinces often do not know the
city well enough to judge whether a room is genuinely close to their university,
affordable after utilities, safe enough for their circumstances, or still
available. Information is fragmented across social media, classified listings,
friends and relatives, direct calls, and physical “For Rent” signs.

The job to be done is not simply “find a rental.” It is:

> Help me confidently shortlist a few affordable, available places near my
> university before I spend time and money travelling to inspect them.

## Evidence

- A World Bank consultation with students from provinces reported difficulty
  finding accommodation when first arriving in Phnom Penh. Students raised
  affordability, insecurity, distance from university, and travel cost as
  connected problems. [World Bank consultation](https://documents1.worldbank.org/curated/en/822861511362670205/pdf/SFG3807-REVISED-IPP-P162971-Box405313B-PUBLIC-Disclosed-11-27-2017.pdf)
- APS Cambodia's July 2026 market overview describes purpose-built student
  accommodation as underdeveloped and estimates only 15–20 purpose-built
  projects. It reports indicative monthly prices of USD 87–141 for private
  operators and USD 76–137 for university operators. Treat these figures as a
  directional industry estimate until the underlying methodology is reviewed.
  [APS market overview](https://www.aps.com.kh/research-center/downloads/phnom-penhs-student-accommodation-market/)
- Current Khmer24 listings show that low-cost rooms exist and already advertise
  student-relevant attributes such as proximity to RUPP, room size, kitchen,
  water and electricity pricing, and safety. The problem is discoverability,
  consistency, freshness, and comparison rather than the absence of all supply.
  [Example Khmer24 listing](https://www.khmer24.com/en/room-for-rent-adid-13465980)
- PropertyHub and other general property marketplaces support maps and property
  details but serve broad property categories and audiences.
  [Example PropertyHub listing](https://khpropertyhub.com/en/property/rental-rooms-%E1%9E%94%E1%9E%93%E1%9F%92%E1%9E%91%E1%9E%94%E1%9F%8B%E1%9E%87%E1%9E%BD%E1%9E%9B%E1%9E%85%E1%9E%B6%E1%9E%94%E1%9F%8B%E1%9E%96%E1%9E%B8-50month-10229)
- Bamnang is a direct student-housing competitor. Its application advertises
  rooms near schools, student dashboards, payments, invoices, mentorship, and
  related student services. Its public inventory appears centered on Bamnang's
  own campuses and room types, leaving room for an open marketplace that
  aggregates independent landlords. [Bamnang on Google Play](https://play.google.com/store/apps/details?id=com.bamnang.bamnangapp)

## Competitive landscape

| Alternative | Strength | Student pain left unresolved |
| --- | --- | --- |
| Facebook, TikTok and Telegram | Familiar, active, direct communication | Unstructured data, duplicates, scams, weak filtering, difficult map comparison |
| Khmer24 and broad classifieds | Large supply and recognized marketplace | Search starts from property category and district rather than university and student fit |
| General real-estate portals | Maps, photos, agents, detailed listings | Often optimized for the wider or higher-budget market rather than low-cost student rooms |
| Bamnang | Purpose-built student housing and student services | Primarily an operator ecosystem rather than a neutral comparison marketplace for independent supply |
| Friends, relatives and street search | Local trust and access to offline supply | Slow, geographically limited, and hard to use before arriving in Phnom Penh |

## Recommended position

FindMe should be the neutral student-rental comparison layer for Phnom Penh:

1. Start with a university, not an unfamiliar district.
2. Show distance and estimated travel time for every result.
3. Show the real expected monthly cost, including disclosed utilities and fees.
4. Make freshness and verification visible.
5. Let students create a shortlist before contacting owners through channels
   they already use, initially phone and Telegram.

## Highest-risk assumptions

These should be tested with interviews and a concierge pilot before heavy
engineering investment:

1. Independent landlords will create structured listings and keep availability
   current.
2. Students trust platform verification enough to change their current search
   behavior.
3. University proximity is the primary search anchor; price, safety, and
   transport may instead dominate for some segments.
4. Students will compare total monthly cost when electricity and water pricing
   are made explicit.
5. Owners will eventually pay for subscription or promotion without degrading
   result quality.

## Discovery interviews

Run 12–15 interviews before launch:

- 8–10 first- or second-year students who moved from different provinces;
- at least four women, because safety concerns can differ materially;
- 3–5 independent landlords near RUPP, ITC, NUM, UHS, or another initial campus
  cluster;
- 1–2 university student-affairs representatives.

Ask students to reconstruct their last search rather than speculate about a
hypothetical product. Record search channels, time spent, visited properties,
travel cost, scams or stale listings encountered, final rent, utilities,
distance, and who influenced the decision.

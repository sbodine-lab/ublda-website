# Consulting redesign — September 16, 2026

## Design and page map

Reference: https://www.boardofinnovation.com/ (live desktop/mobile inspection in Chrome).

- Home → homepage composition: two offset hero lines, blue stepped gradient columns, centered positioning, three metric cards, image/copy split, service hover cards, blue CTA, client feature, research cards, leadership, banded footer.
- Services → dark service-index layout with large image/text rows; three focused service-detail routes.
- Work → light case-index layout, adapted to one current client rather than an invented portfolio.
- Leadership → light introduction and profile grid. Canonical order remains Alex Forstner, then Solomon DeYoung. Monograms are used because the existing public site has no headshots of these people.
- Practice → team model and Fall 2026 recruiting timeline.
- Partners → role-labelled connections, distinguishing client, campus, and speaker affiliation.
- Contact → direct PM contacts, an email-draft form, and analyst/general-member details. The form opens the visitor's email app and does not claim to submit a message.
- Insights → three filterable summaries and individual source-linked articles.

Existing consulting URLs remain valid. `/advisory` still redirects. Main UBLDA pages, recruiting forms, authentication, and backend behavior are unchanged.

## Measured motion

Reference hero: 22 gradient bands; blue RGB(10,10,229), dark RGB(13,19,25); 6,590ms phase period; 720ms column offsets; eight columns desktop / four tablet / two mobile. Recreated in canvas to avoid hundreds of per-frame style mutations. Stops offscreen, in background tabs, and with reduced motion or the footer pause control.

Reference entrances: 30px rise over 1.25s, 250ms second-line delay, 600ms hero CTA delay. Service hover: .4s title exit, .6s description entrance after .35s, .3s exit. Metric gradient follows the reference scroll progress mapping: clamp(.6 - sectionTop / viewportHeight, 0, 1). Normal native scrolling, no pinned sections or forced wheel easing.

Typography: the reference's open-source DM Sans 400/500, self-hosted with its OFL license. Desktop hero 88px; major section titles 49.6px; body statements 33.6px; 1,440px content maximum with responsive gutters. Exact page heights differ because UBLDA has fewer clients and people and different copy. Network latency is not artificially imitated.

## Content decisions

Kept: official UBLDA Consulting name; pro bono student practice; disability-focused organizations/accessibility teams; Arc Thrift Stores as the Fall 2026 client; planned presentation to The Arc national board; four to six analysts and two PMs; Alex first; canonical contact emails; application links and shared deadline constants; free general membership.

Source boundary: Brain notes #259 and #261. No public disclosure of client-specific deliverables. No invented client outcomes, logos for prospect companies, professional certifications, or fake biographies. Replaced the old client/network-size metrics with primary-source context about disability inclusion; no unverified revenue or chapter-count claims added.

Five old service areas are grouped into three: strategy/business cases; accessible websites, documents, events and programs; hiring/workplace inclusion. These remain potential engagement areas, not claims of completed work.

Added primary-source research (checked Sept 16, 2026):

1. WHO, March 7, 2023: 1.3 billion people / 16% experience significant disability worldwide. https://www.who.int/news-room/fact-sheets/detail/disability-and-health
2. Accenture / Disability:IN / AAPD, 2023: disability-inclusion leaders in the research sample generated 1.6x revenue; about 346 unique DEI respondents, 2015–2022. Association is stated, with no causal or guaranteed-return claim. https://newsroom.accenture.com/news/2023/companies-that-lead-in-disability-inclusion-outperform-peers-financially-reveals-new-research-from-accenture
3. BLS, March 3, 2026 release / 2025 data: 38.1% employment-population ratio for disabled people ages 16–64. Article distinguishes employment ratio from unemployment and notes the 11-month sample because October data was not collected. https://www.bls.gov/news.release/disabl.nr0.htm

## Visual assets

- Logo and photo sources, responsive assets, and the September 16 follow-up polish are documented in [image-polish.md](image-polish.md).
- The initial reference imagery was replaced with relevant Pexels service photographs in the follow-up polish. These are illustrative, not UBLDA team or client photos.
- Abstract accessibility, research, and monogram graphics are CSS, not fabricated documentary photos.

## Verification

Build, 153 repository tests, and lint (four existing generated-file warnings). Chrome visual review at desktop and mobile sizes; all 14 consulting routes checked at 390px for horizontal overflow and missing images. Navigation focus, Escape handling, insight filters, contact validation, reduced motion, and production verification are recorded in the release handoff.

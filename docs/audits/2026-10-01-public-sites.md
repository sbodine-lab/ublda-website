# Main site and Consulting audit — October 1–2, 2026

Scope: all 24 public marketing routes: the seven club pages, Consulting home and application notice, program, leadership, client, connections, contact, services and three service details, insights and five articles. Operational workspaces and third-party form editing are outside this website audit.

## Corrections

- Replaced the promised December presentation to The Arc's national board with final presentation arrangements still being confirmed. Distinguished Arc Thrift Stores, the consulting client, from The Arc's national advocacy network. Kept the Arc University engagement and planned Fall 2026 timeframe.
- Changed the unconfirmed early-October kickoff to October (planned), with onboarding and date confirmation explained. Kept the closed Fall application period and Winter recruiting notice intact.
- Added visible relationship labels to the main site's logos: MBA counterpart, consulting client, past speaker's organization, and club partner.
- Gave every public page a descriptive browser title for navigation and assistive technology. Removed the stale invitation to apply from default search/social descriptions and made the main consulting program description refer to current recruiting information.
- Refreshed audit coverage for current community cards, no-upcoming-event state, external unsubscribe form, current navigation labels, application notice, five research articles, and the send-message form. Simulated contact failure/retry/success in the browser; no message was sent.

## Evidence

Club facts were checked against Brain status, document searches and original notes. September 25 planning note #620 distinguishes a possible national case review from a confirmed board presentation, and leaves scope and schedule in development. September 23 note #578 records the approved application closure page and Winter 2027 notice. Contact routing was checked against #458; current published contacts and executive-board names were compared with the Brain. Earlier website audit #434 supplies membership and relationship context, superseded where later notes differ.

The five research figures remain unchanged and were rechecked against their original sources on October 1:

- [WHO, March 2023](https://www.who.int/news-room/fact-sheets/detail/disability-and-health): worldwide significant-disability estimate.
- [Accenture, November 2023](https://newsroom.accenture.com/news/2023/companies-that-lead-in-disability-inclusion-outperform-peers-financially-reveals-new-research-from-accenture): comparison among participating companies, not a causal return from consulting.
- [BLS, March 2026 release](https://www.bls.gov/news.release/archives/disabl_03032026.htm): 2025 employed share for disabled people ages 16–64, with the eleven-month-data caveat.
- [BCG, May 2023](https://www.bcg.com/publications/2023/devising-people-strategy-for-employees-with-disabilities-in-the-workplace): self-reports from a multinational employee survey.
- [JAN, September 2025](https://askjan.org/topics/costs.cfm): employer-reported accommodation benefits; not an increase in the retention rate.

Arc Thrift's [current mission](https://arcthrift.com/) supports the chapter-funding description; [The Arc](https://thearc.org/about-us/) supports the national-network distinction. No prospective Winter client was promoted to a confirmed client. The postponed October Microsoft event remains absent.

## Verification

- Production build passed; all 168 unit/contract tests passed.
- Lint passed with four existing warnings in generated Convex files; no errors. The existing large-workspace-bundle build warning remains.
- 72 axe scans across 24 unique routes at 320/1440px, with additional 768px coverage for Consulting: no automated violations, no horizontal overflow, and no browser errors. The club/application sweep also checked one primary heading, unique page titles, and broken images.
- 57 main-site and 115 Consulting interaction checks passed, including keyboard focus, menu Escape/focus trapping, team dialogs, reduced motion, pause persistence, contact validation and simulated feedback, expanded text spacing, and 320px zoom reflow.
- Navigation inventory checked internal routes/anchors, membership and unsubscribe form availability, and working SVG/PNG downloads. Full desktop/mobile navigation exercises both ordinary and reduced motion.

Detailed machine output and screenshots are in the ignored `outputs/site-audit/` working directory. Automated scans and keyboard checks do not constitute a complete assistive-technology or WCAG certification. Contact delivery was not tested by sending mail; browser tests intercepted those requests.

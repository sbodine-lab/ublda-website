# Public content and logic audit — September 17, 2026

Scope: the eight public club routes and fourteen Consulting routes. This review covers visible explanations, factual qualifications, organization relationships, eligibility, recruiting dates, event status, and navigation. It does not assert that every future announcement or third-party form will remain current.

## Corrections

- Research cards now define each statistic beside the number, with publication/data dates and essential qualifications beneath the title. Detail-page statistics also carry their definitions. Tablet cards stack to preserve readable explanations.
- **1.3B:** estimated people worldwide experiencing significant disability, approximately one in six. [WHO, March 7, 2023](https://www.who.int/news-room/fact-sheets/detail/disability-and-health).
- **1.6×:** reported revenue among disability-inclusion leaders versus other companies in Accenture's study. The study covered 346 U.S. companies participating in the Disability Equality Index during 2015–2022. Association is not proof of causation or a promised consulting return. [Accenture, November 27, 2023](https://newsroom.accenture.com/news/2023/companies-that-lead-in-disability-inclusion-outperform-peers-financially-reveals-new-research-from-accenture).
- **38.1%:** the employed share of U.S. people with a disability aged 16–64 in 2025, not an unemployment rate. The estimate excludes October; it is not strictly comparable with other annual estimates. The link now points to the dated release so a future release cannot silently change its meaning. [BLS, March 3, 2026](https://www.bls.gov/news.release/archives/disabl_03032026.htm).
- The Insights introduction distinguishes external research from UBLDA project results.
- Visible captions distinguish Arc Thrift (Fall 2026 client), The Arc (planned national board presentation), BLDA (MBA counterpart), Nestidd/Microsoft (speaker organizations), and Wall Street Oasis (club partner). Nestidd is no longer described with an undefined business-connection label.
- Arc Thrift copy describes advocacy funding and employment without an unnecessary geographic limitation or employer ranking. [Arc Thrift mission](https://arcthrift.com/mission).
- The first client engagement and team composition are identified as Fall 2026 plans. Project-manager titles are no longer cut off.
- Club and Consulting membership explanations distinguish free general membership for all U-M students from selected analyst positions for U-M undergraduates.
- The September 22, 11:30 PM Eastern application deadline remains unchanged (Brain record 319). Interview, offer, and kickoff labels now reflect Sam's later instruction: late September interviews with confirmed times sent to invitees, decisions after interviews, and planned early October meetings (Brain record 325). No Google Forms or operational schedules were changed.
- Consulting Apply links now use the same public deadline as the contact page. While applications are open, they still go directly to the existing Google Form. Before/after the window, they point to recruiting information. An open tab updates at the deadline.
- The October 1 event automatically moves into the archive at 8 PM Eastern, removing RSVP/calendar actions. Its archived copy describes the announced program without inventing an attendance result. The home story points to the event listing rather than retaining an expired invitation.

## Verification

- Production build passes; all 156 unit tests pass, including event end/timezone and date-only boundary tests.
- Lint passes with four existing warnings in generated Convex files; the existing large DecisionCenter bundle warning remains.
- Public navigation audit: 148 checks pass, 52 unique destinations reviewed, no browser errors. Membership, Consulting, RSVP, and removal forms open successfully; nothing was submitted.
- Automated accessibility review: 52 route/viewport scans across both audit suites, covering 22 unique public routes at 320 and 1440 pixels; no reported violations, horizontal overflow, or page errors. Automated scans are not a certification of WCAG conformance.
- Targeted content checks: 21 pass, including metric-label geometry at 320/390/768/1440 pixels, visible relationship captions, direct application links while open, an already-open tab updating at the exact application cutoff, and automatic event archival with no expired RSVP actions.
- Consulting interaction review: 112 checks pass, including keyboard navigation, form validation, filters, enlarged text spacing, and zoom reflow. One initial run was interrupted by Vite restarting after build-generated server files changed; the complete rerun passed.
- Desktop and mobile screenshots inspected for the research cards and relationship captions. Browser audit outputs and screenshots are under ignored `outputs/content-context/`.

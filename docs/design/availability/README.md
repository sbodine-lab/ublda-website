# UBLDA scheduling visual spec

This workflow is a sibling to Decisions inside the existing authenticated UBLDA workspace.

- `mobile-poll-concept.png` is the participant interaction: left-aligned context, touch paint grid, autosave, and a compact results action.
- `mobile-create-concept.png` is the admin creation flow: one open column, short labels, and one final action.
- `desktop-results-concept.png` is the workspace and live result: open rows, ranked best times, and the aggregate heatmap.

## Product decisions

- One response per roster member, independent of device or approved email alias.
- Shared links use an opaque server-generated slug; the meeting topic never appears in the URL.
- Availability saves on each completed pointer gesture. A later save replaces that member's previous availability.
- Results update from Convex subscriptions. The server ranks every duration-sized window by the number of members available for the entire window.
- The default result rule is `after_submit`; administrators can always see results and named nonresponders.
- Times use 15-minute source slots so 45-minute meetings are ranked exactly. The UI labels every 30 minutes to stay readable.
- New polls default to every active roster member and `America/Detroit`, but both are explicit inputs.

## UI tokens

- background `#faf9f6`
- text/selected `#0f2b3c`
- muted `#6b6860`
- wash `#e8f6f4`
- accent `#2bbab0`
- hairline `#d8d6d0`
- three sizes: 13px utility, 16px body/control, responsive 36–52px primary heading

No gradients, green success fills, dense cards, explanatory filler, or new account surface.

# UBLDA Leadership Dashboard — UI Build Contract

**Status: binding.** Five workstreams implement this in parallel. Every number here is a decision, not a suggestion. If you think a value is wrong, implement it anyway and raise it; do not improvise a different one.

**Worktree (the only one):** `/Users/sambodine/Desktop/Ventures/UBLDA/.codex-worktrees/dashboard-local-launch`, branch `claude/leadership-dashboard-redesign`.
**Never touch** `/Users/sambodine/Desktop/Ventures/UBLDA/UBLDA Website` — different, stale checkout.
Dev server already running on :5180 with HMR. Do not start a server. Do not commit, push, or run browser tools.

---

## 0. What the user actually said

1. Sidebar/nav options feel crammed together.
2. Sizing is inconsistent across the whole app.
3. Add-calendar-event flow: text does not line up with the components; the "add event" button is not fitted.
4. The teal accent must be gone from the dashboard, completely.
5. Projects looks better than the rest — make everything that good.
6. Modern components, not outdated ones.
7. Elegant tab-switch animation and micro-animations a skilled designer would use. Not vibe-coded AI slop.
8. Proper spacing throughout.
9. Small UI bugs remain — e.g. an empty state that says "Create one".
10. Too much AI-slop writing, too much text, the flow is not simple.
11. **The Club calendar view is extremely simple and they like it. That simplicity is the model for the whole app.**

Point 11 is the tiebreaker for every judgment call. When in doubt, remove.

---

## 1. File ownership — strict, non-overlapping

| WS | Owns | Notes |
|---|---|---|
| **W1 foundation** | `src/features/leadership/**`, `src/styles/leadership-workspace.css`, **`src/features/speakers/**`** | Speakers was unassigned in the brief; it is assigned to W1 because `speaker-ops.css` hard-codes the topbar height W1 is changing and duplicates the shell's dead chrome. |
| **W2 primitives** | `src/components/ui/**` | Only. Not `src/components/*.tsx` (public site). |
| **W3 workspace** | `src/features/workspace/**` | |
| **W4 decisions** | `src/features/decisions/**` | |
| **W5 availability** | `src/features/availability/**` | |

### Files nobody may edit in this pass

`src/styles/tokens.css` · `src/styles/global.css` · `src/App.tsx` · `src/main.tsx` · `src/pages/**` · `src/components/*.css` · `src/components/Nav.tsx` · `src/components/Footer.tsx` · `server/**` · `convex/**` · `package.json`.

Everything the dashboard needs from `:root` is remapped by W1 through a `body:has(…)` block (§3.2). Nobody edits global tokens to fix a dashboard problem.

### Cross-boundary rule

If a fix requires a file you do not own, **do not edit it**. It is already written into the owning workstream's checklist in §11. If it is not, note it and stop — do not cross.

### One hard dependency

**W4 must land §9.1 (delete the type flattener) before anyone else's typography can be verified.** W4 does that first, in its own commit, and says so. Everyone else builds against the assumption that it is gone.

---

## 2. Token table

### 2.1 Palette (verbatim from baseline)

| Token | Value | Use |
|---|---|---|
| `--lx-navy` | `#142b4a` | primary actions, active nav, headings |
| `--lx-navy-strong` | `#0d203a` | hover on primary |
| `--lx-ink` | `#101828` | body text |
| `--lx-muted` | `#5b6472` | secondary text |
| `--lx-faint` | `#8792a3` | tertiary / meta |
| `--lx-canvas` | `#f6f8fb` | app background |
| `--lx-surface` | `#ffffff` | cards |
| `--lx-hairline` | `rgba(16,24,40,0.08)` | dividers |
| `--lx-border` | `rgba(16,24,40,0.14)` | control borders |
| `--lx-ring` | `#2d5682` | focus ring |

### 2.2 Status colors (verbatim from baseline)

| State | Text | Wash |
|---|---|---|
| active / confirmed / working / responded | `#175cd3` | `#eff4ff` |
| planned / tentative / todo / open | `#b54708` | `#fffaeb` |
| blocked / cancelled | `#b42318` | `#fef3f2` |
| complete / done / finalized / closed | `#475467` | `#f2f4f7` |

### 2.3 Tokens the audits prove are missing — ADD these

The audits found 54 distinct `box-shadow` strings across 79 declarations (only 4 used more than once), 17 distinct `backdrop-filter` recipes across 48 declarations, and a `--shadow-sm/md/lg/xl` ramp in `tokens.css` with zero consumers. That is the mechanical cause of "sizing is inconsistent" at the surface level.

| Token | Value | Use |
|---|---|---|
| `--lx-ring-shadow` | `0 0 0 3px rgba(45,86,130,0.18)` | the **only** focus glow in the app |
| `--lx-shadow-sm` | `0 1px 2px rgba(16,24,40,0.05)` | resting controls, list rows |
| `--lx-shadow-md` | `0 4px 12px rgba(16,24,40,0.06)` | cards, popovers, dropdowns, selects |
| `--lx-shadow-lg` | `0 16px 40px rgba(16,24,40,0.12)` | dialogs, sheets |
| `--lx-hover-wash` | `rgba(16,24,40,0.04)` | the **only** hover background |
| `--lx-active-wash` | `rgba(20,43,74,0.07)` | active nav item background |
| `--lx-radius-control` | `8px` | inputs, buttons, selects, native selects |
| `--lx-radius-surface` | `12px` | cards, dialogs, sheets, popovers |
| `--lx-radius-pill` | `999px` | status chips **only** |
| `--lx-ease` | `cubic-bezier(0.2, 0, 0, 1)` | every CSS transition |
| `--lx-dur-fast` | `120ms` | hover, color |
| `--lx-dur-base` | `180ms` | enter, layout |
| `--lx-font` | `"Plus Jakarta Sans", system-ui, -apple-system, sans-serif` | everything |

**Elevation rule:** exactly three shadows exist. Any `box-shadow` in the dashboard that is not one of `--lx-shadow-sm/md/lg` or `--lx-ring-shadow` is deleted.

**Glass rule:** exactly one recipe, and only on the sidebar and topbar:
`background: rgba(255,255,255,0.86); backdrop-filter: blur(20px) saturate(140%); -webkit-backdrop-filter: blur(20px) saturate(140%);`
Every other `backdrop-filter` in the dashboard is deleted. Cards are opaque `--lx-surface`.

**Radius rule:** exactly three radii. `999px` is for status chips only — no pill buttons anywhere (this kills `.ws-primary-action` and `.av-liquid-button`).

### 2.4 Typography (verbatim from baseline + the missing rungs)

One family: `--lx-font`. No `!important` anywhere on `font-family`. Set once on the shell, once on portals, and let it inherit.

| Role | Size | Weight | Tracking |
|---|---|---|---|
| topbar h1 (page title) | 18px | 650 | −0.01em |
| in-page section title (card title) | 15px | 640 | −0.005em |
| body | 13px | 450 | 0 |
| control / input text | 13px | 450 | 0 |
| button label | 13px | 550 | 0 |
| meta, table head, status chip | 11.5px | 560 | 0.01em, **no uppercase transform** |
| sidebar nav link | 12.5px | 550 (active 650) | 0 |
| sidebar group label (`Admin`) | 11px | 650 | 0.06em, uppercase — the single deliberate exception |
| dialog title | 16px | 650 | −0.01em |
| field label | 12px | 600 | 0 |

Line height: `1.45` for body, `1.2` for headings and control labels.

Sizes not on this table do not exist. The live app currently renders 13 different sizes across two different rem roots; that ends.

### 2.5 Spacing — 4px base (verbatim from baseline)

- page gutter `32px` (`24px` ≤1100, `16px` ≤820)
- page top padding `28px`, bottom `64px`
- gap between page sections `20px`
- card padding `20px`, card header height `52px`
- field label→control gap `6px`, gap between fields `16px`, form row gap `16px`
- dialog padding `24px`, dialog footer `16px 24px`

### 2.6 Casing

Sentence case everywhere — JSX strings, demo seed data, table headers, buttons, dialog titles, toasts, empty states, aria-labels.

Delete **every** `text-transform: lowercase` and `text-transform: uppercase` in the dashboard. Delete **every** `.toLowerCase()` applied to display strings (formatters included — see the copy table). The sidebar `Admin` group label is the one uppercase exception and it is done in CSS on that one selector.

---

## 3. The complete teal kill-list

Grouped by owning workstream. Every line here renders or declares teal inside the leadership dashboard. `LIVE` = the audits confirmed it paints on screen today.

### 3.1 W1 — `src/styles/leadership-workspace.css`, `src/features/leadership/**`, `src/features/speakers/**`

| file:line | What | Action |
|---|---|---|
| `src/styles/leadership-workspace.css:1430` | `rgba(8, 125, 121, 0.72)` radial stop in the `prefers-reduced-motion` `.dc-auth-page` fallback — **LIVE for reduced-motion users** | → `rgba(20, 43, 74, 0.72)` |
| `src/styles/leadership-workspace.css:9-28` | the `--dc-teal*` / `--av-*` remap block | keep, but move under the new scope in §3.2 |
| `src/styles/leadership-workspace.css:18` | `--color-teal: #2d5682` | keep; it becomes `var(--lx-ring)` |
| `src/features/speakers/speaker-ops.css:16-17` | `--accent` / `--accent-foreground` remap | keep, restate as `--lx-*` |

No teal literals were found in `speaker-ops.css` or `leadership-shell.css`. Do not go hunting; the work here is §3.2.

### 3.2 W1 — the portal escape (the single highest-impact fix in this document)

Every Radix surface portals to `document.body`: `ui/dialog.tsx:25`, `ui/alert-dialog.tsx:25`, `ui/sheet.tsx:29`, `ui/select.tsx:66`, `ui/dropdown-menu.tsx:17,39`, `ui/tooltip.tsx:38`. Nothing scoped to `.dc-app-shell` / `.ws-shell` / `.leadership-shell` reaches them, so they fall back to `:root` in `global.css`, which is still the public teal brand.

This is why: **every focus ring in every dialog, sheet, dropdown and select in the dashboard is teal**, every `SelectItem`/`DropdownMenuItem` highlight is teal-on-teal (including the shell's own mobile nav menu), and `Badge variant="secondary"` is teal.

`global.css` is out of scope. W1 fixes all of it with one block in `src/styles/leadership-workspace.css`. `body:has(.dc-app-shell)` has specificity (0,1,1) and beats `:root` (0,1,0):

```css
body:has(.dc-app-shell),
body:has(.dc-ballot-page),
body:has(.dc-auth-page) {
  --color-teal: #2d5682;
  --color-teal-soft: #eef3f9;
  --color-teal-muted: rgba(20, 43, 74, 0.18);   /* kills the teal ::selection */
  --ring: #2d5682;
  --accent: #eef3f9;
  --accent-foreground: #142b4a;
  --secondary: #eef3f9;
  --secondary-foreground: #142b4a;
  --chart-1: #2d5682;
  --chart-5: #142b4a;
  --font-body: var(--lx-font);
}
```

Teal sources this neutralises, none of which anyone may edit directly:
`tokens.css:6` `--color-teal` · `tokens.css:7` `--color-teal-soft` · `tokens.css:8` `--color-teal-muted` (drives `global.css:118` `::selection` — LIVE on every text selection) · `global.css:147` `:focus-visible { outline: 2px solid var(--color-teal) }` (LIVE on the skip link and every portal) · `global.css:256-257` `--secondary*` · `global.css:260-261` `--accent*` · `global.css:265` `--ring` (LIVE on every portalled control) · `global.css:266,270` `--chart-1`, `--chart-5` · `global.css:276-279` sidebar accent/ring.

### 3.3 W3 — `src/features/workspace/workspace.css`

| line | Value | Status |
|---|---|---|
| `10` | `--sidebar-accent: #eef8f7` | dead chrome — delete rule |
| `11` | `--sidebar-accent-foreground: #0b5e58` | dead chrome — delete rule |
| `40` | `box-shadow: inset 2px 0 #2bbab0` on `[data-sidebar-menu-button][data-active]` | dead (`.ws-sidebar` never renders) — delete |
| `56` | `.ws-kicker { color: #0b5e58 }` | dead — delete |
| `69` | `.ws-section-heading a { color: #0b6d67 }` | dead — delete |
| `74` | `.ws-agenda-marker { background: #2bbab0 }` | → `var(--lx-navy)` |
| `83` | `#19aaa0` progress indicator | → `var(--lx-navy)` |
| `90` | `.ws-all-clear svg { color: #0b6d67 }` | **LIVE** — teal check icon on the Dashboard "You're caught up" → `var(--lx-muted)` |
| `104` | `.ws-calendar-accent { background: #2bbab0 }` | → `var(--lx-navy)` |
| `107` | `.ws-status-active/-confirmed/-working { background:#e9f7f5; color:#0b6d67 }` | → §2.2 active wash/text |
| `108`, `110` | `.ws-status-blocked/-cancelled`, `-tentative/-planned/-todo` | not teal but off-system → §2.2 |
| `113` | `.ws-project-group > header { border-bottom: 2px #2bbab0 }` | → `1px solid var(--lx-hairline)` |
| `121` | `.ws-project-parent td:first-child { border-left: 3px #2bbab0 }` | → `2px solid var(--lx-navy)` |
| `130` | `#19aaa0` | → `var(--lx-navy)` |
| `131` | `.ws-add-task-row button { color: #0b6d67 }` | → `var(--lx-navy)` |
| `137` | tabs-trigger `color:#0b6d67` + `inset 0 -2px #2bbab0` | delete the whole rule — W2 owns the tab indicator now |
| `254` | `.dc-mobile-nav-link-active { color: #0b6d67 }` | dead markup — delete |
| `267` | `#19aaa0` | → `var(--lx-navy)` |
| `270` | `.ws-project-mobile-add { color: #0b6d67 }` | → `var(--lx-navy)` |

### 3.4 W4 — `src/features/decisions/**`

| file:line | Value | Status |
|---|---|---|
| `decision-center.css:8` | `--dc-teal: #2bbab0` | → `var(--lx-navy)` at source |
| `decision-center.css:9` | `--dc-teal-wash: #e8f6f4` | → `#eef3f9` |
| `decision-center.css:10` | `--dc-teal-ink: #0b5e58` | → `var(--lx-navy)` |
| `decision-center.css:314, 319` | `#e8f6f4` / `#0b5e58` on `.dc-sheet-link` | dead class — delete rules |
| `decision-center.css:226-227` | `.dc-nav-link*` teal | dead markup — delete |
| `decision-center.css:366-372` | `border-color: var(--dc-teal, #2bbab0) !important` + `box-shadow: 0 0 0 3px rgb(43 186 176 / 16%)` | **LIVE** — the fallback fires in portalled dialogs where `--dc-teal` is undefined. This is the teal ring the lead measured as `rgb(43,186,176)`. Delete the entire focus block; §5 focus comes from W2. |
| `decision-center.css:1172` | `.dc-outcome-alert { border-color: #b7ddd8 !important }` | **LIVE** → `var(--lx-hairline)` |
| `decision-center.css:1537` | `.dc-identity-alert, .dc-integration-boundary { … #b8ddd8 }` | **LIVE** → `var(--lx-hairline)`; both alerts are deleted anyway per §10 |
| `decision-center.css:1706` | `.dc-code-block { color: #e6f3f2 }` | **LIVE** mint-on-navy → `#e6ecf5` |
| `decision-center.css:1974-1975` | `.dc-mobile-nav-link-active` teal | dead markup — delete |
| `components/LeadershipAuthScreen.tsx:47` | `MeshGradient colors={[…,"#087d79",…]}` | **LIVE** shader stop on the sign-in gate → `#1d4d7a` |

Also delete `--dc-navy: #0f2b3c` / `--dc-navy-hover: #1a3d52` / `--dc-cream: #faf9f6` (`decision-center.css:4-16`) in favour of `--lx-*`. The cream dialog background is the third dialog tint in the app and must go (§6).

### 3.5 W5 — `src/features/availability/availability.css`

| line | Value | Action |
|---|---|---|
| `8` | `--av-wash: #e8f6f4` | → `#eef3f9` |
| `9` | `--av-teal: #2bbab0` | → `var(--lx-navy)`; then delete both variables and use `--lx-*` directly at all call sites (`:196, :235, :333, :477-480, :489, :529`) |

### 3.6 OUT OF SCOPE — teal that stays, do not touch

Teal is UBLDA's public brand. These files keep it:

`src/styles/tokens.css` (all) · `src/styles/global.css` (all) · `src/pages/Events.css` · `src/pages/Join.css` · `src/pages/Brand.css` · `src/pages/Links.css` · `src/pages/About.css` · every other `src/pages/*.css` · `src/components/Nav.css` · `src/components/Footer.css` · `src/components/EventPopup.css` · `src/App.tsx`.

If a teal you can see traces back to one of those files, it is fixed by §3.2, not by editing them.

---

## 4. Control geometry — one spec, no exceptions

Applies to `Input`, `Textarea`, `SelectTrigger`, every native `<select>`, `type="date"`, `type="time"`, `type="datetime-local"`, the search field, and every field inside a dialog, sheet or page.

| Property | Value |
|---|---|
| height | **36px** (`min-height` for textarea: 88px) |
| padding-inline | **12px** |
| padding-block | 0 (textarea: 10px) |
| radius | **8px** |
| border | `1px solid var(--lx-border)` |
| background | `#ffffff` |
| color | `var(--lx-ink)` |
| font | 13px / 450 / `--lx-font` |
| placeholder | `var(--lx-faint)` |
| hover | `border-color: rgba(16,24,40,0.22)`, 120ms |
| focus | `outline: none; border-color: var(--lx-ring); box-shadow: var(--lx-ring-shadow)` |
| disabled | `opacity: 0.55; cursor: not-allowed` |
| invalid | `border-color: #b42318; box-shadow: 0 0 0 3px rgba(180,35,24,0.16)` |
| ≤820px | height **44px**, font 15px (prevents iOS zoom); everything else unchanged |

Rules:
- `SelectTrigger` gets the same box, plus a 16px chevron at `padding-inline-end: 10px` with `transition: transform 150ms var(--lx-ease)` and `rotate(180deg)` when `data-state="open"`.
- `size="sm"` on `SelectTrigger` = 32px height, 10px padding-inline. Used only for inline status pickers inside table rows.
- **No native `<select>` survives.** Both `.ws-native-select` instances (`ClubCalendarPage.tsx:59` owner + project, `ProjectsPage.tsx:50` owner) become shadcn `Select`. W3 owns both. Delete `.ws-native-select` from `workspace.css` entirely.
- The current add-event dialog has three heights in one row (32 / 32 / 36) with 0 / 0 / 10px padding. After this, it is 36 / 36 / 36 with 12px everywhere. That is the "text doesn't line up" fix.
- Field label: 12px / 600 / `var(--lx-muted)`, `margin-bottom: 6px`, sentence case, no transform.

---

## 5. Button spec — one spec, no exceptions

| size | height | padding-inline | radius | font | icon gap | icon-only |
|---|---|---|---|---|---|---|
| `xs` | 26px | 8px | 6px | 11.5 / 560 | 4px | 26×26 |
| `sm` | 32px | 12px | 8px | 12.5 / 550 | 6px | 32×32 |
| `default` | **36px** | **14px** | 8px | 13 / 550 | 6px | 36×36 |
| `lg` | 40px | 18px | 8px | 13.5 / 550 | 8px | 40×40 |

When a leading icon is present, `padding-inline-start: 10px`; trailing icon, `padding-inline-end: 10px`. Icon glyph 16px (14px at `sm`/`xs`).

| variant | rest | hover | active |
|---|---|---|---|
| `default` | `bg var(--lx-navy)`, `#fff` | `bg var(--lx-navy-strong)` | `bg var(--lx-navy-strong)`, no transform |
| `outline` | `bg #fff`, `1px solid var(--lx-border)`, `var(--lx-ink)` | `bg var(--lx-canvas)` | same |
| `ghost` | transparent, `var(--lx-muted)` | `bg var(--lx-hover-wash)`, `var(--lx-ink)` | same |
| `destructive` | `bg #fef3f2`, `#b42318` | `bg #fee4e2` | same |
| `link` | `var(--lx-navy)`, underline on hover | — | — |
| `secondary` | **delete this variant** — zero call sites, and it is one of the teal token consumers | | |

Rules:
- **Padding must survive the portal.** `global.css:8-12` sets `*, *::before, *::after { padding: 0 }` **unlayered**, which beats every Tailwind `px-*` utility (Tailwind's are in `@layer utilities`). The shell re-adds insets, but only under `.dc-app-shell.leadership-shell` — and Radix portals mount on `<body>`, outside that scope. So **every button, input, textarea, badge and alert inside a dialog, sheet, dropdown or select currently renders with zero horizontal padding.** That is the "add event button is not fitted" bug the lead measured: `padding: 0px`, 69×44, text jammed edge to edge.

  **Mechanism (one place, one owner): W1.** The `body:has(.dc-app-shell), body:has(.dc-ballot-page), body:has(.dc-auth-page)` block from §3.2 also restores insets — specificity (0,1,1) plus a `[data-slot]` attribute beats the unlayered `*` reset (0,0,0) on specificity alone, no `!important` needed, and `body:has(…)` matches both in-shell and portalled nodes. W1 writes one rule per `data-slot` × `data-size` pair for: `button`, `input`, `textarea`, `select-trigger`, `select-item`, `dropdown-menu-item`, `badge`, `alert`, `dialog-content`, `sheet-content`, `empty`, `card-header`, `card-content`, `table-cell`, `table-head`.

  **W2 does not fight the reset.** W2 keeps expressing padding as normal Tailwind utilities so the components stay idiomatic; W1's block is what makes them land. If a `data-slot` needs padding and is not in W1's list, W2 flags it — it does not add a workaround.
- **No hover lift.** Delete `[data-slot="button"]:hover { transform: translateY(-1px) }` (`leadership-shell.css:474-476`) and its duplicate (`leadership-workspace.css:72-79`). Delete `active:not-aria-[haspopup]:translate-y-px` from `button.tsx`. Buttons change background only.
- **No pill buttons.** Delete `.ws-primary-action` (999px, 40px, declared twice at 18px and 16px padding) and `.av-liquid-button` (220×54px pill). Page actions use `variant="default" size="default"`.
- `.dc-touch` (44px floor) is deleted — the ≤820px media query in §4 handles touch targets globally.
- `icon`, `icon-xs`, `icon-sm`, `icon-lg` sizes: `icon` = 36×36, `icon-sm` = 28×28, `icon-xs` = 24×24, `icon-lg` = 40×40. Delete the `size-11` / `size-12` values.
- Focus: `outline: none; box-shadow: var(--lx-ring-shadow); border-color: var(--lx-ring)`. Same as controls. This is the **only** focus treatment in the app; the audits found five competing ones.

---

## 6. Dialog spec — one spec, no exceptions

Five dialogs currently disagree on width (520/580/760), content gap (10/16/22), footer tint (`#fafbfb` / `#f7f8fa` / warm `#F5F4F1`), background (white vs cream `#faf9f6`), close-button position (8px vs 14px), and casing (two are force-lowercased, one is not). All of that collapses to:

| Property | Value |
|---|---|
| width | `min(100vw - 32px, 520px)` — one width for every dialog |
| max-height | `min(88vh, 720px)`, body scrolls, header + footer pinned |
| background | `#ffffff` |
| border | `1px solid var(--lx-hairline)` |
| radius | **12px** |
| shadow | `var(--lx-shadow-lg)` |
| overlay | `rgba(16,24,40,0.32)`, **no blur** |
| padding | `24px` |
| `text-transform` | **`none`**, always |
| title | 16px / 650 / `var(--lx-ink)`, sentence case, states the action ("Add event", "New project", "Edit person") |
| description | optional, one line max, 13px / 450 / `var(--lx-muted)`. If it does not change what the user types, delete it. |
| header → body gap | 16px |
| field gap | 16px |
| form row | `display: grid; grid-template-columns: 1fr 1fr; gap: 16px`; collapses to `1fr` at ≤560px |
| footer | `margin: 20px -24px -24px; padding: 16px 24px; background: #fafbfc; border-top: 1px solid var(--lx-hairline); display:flex; justify-content:flex-end; gap:8px` |
| footer buttons | `size="default"`; secondary action is `variant="outline"` and comes first |
| close button | `size="icon-sm"` (28px), `variant="ghost"`, `top:14px; right:14px` |

Sheets (Speaker Ops): same tokens, `width: min(100vw, 440px)`, full height, radius `12px 0 0 12px`, same padding and footer.

---

## 7. Motion spec

`framer-motion@12.35.1` is already a dependency. Nothing pulses, bounces, staggers, shimmers, or lifts.

### 7.1 The tab indicator (W2, `src/components/ui/tabs.tsx`)

**Why this must be rebuilt:** Radix emits `data-state="active"`. The shadcn classes use Tailwind's `data-active:` variant, which compiles to the literal attribute `[data-active]`. It never matches. The built-in pill background, the shadow, and the entire animated `after:` underline are dead code in this repo — the only reason an active tab is visible is two hand-written `box-shadow: inset 0 -2px` rules in app CSS with no transition. Three tab systems exist at three heights (32 / 44 / 34px) with three indicator styles and zero animation.

W2 replaces all of it with a shared sliding indicator:

```tsx
// tabs.tsx
import { LayoutGroup, motion, useReducedMotion } from "framer-motion"

const TabsCtx = React.createContext<{ layoutId: string; value?: string }>({ layoutId: "" })

function Tabs({ value, defaultValue, onValueChange, ...props }) {
  const layoutId = React.useId()
  const [current, setCurrent] = React.useState(value ?? defaultValue)
  React.useEffect(() => { if (value !== undefined) setCurrent(value) }, [value])
  const handle = React.useCallback((next: string) => { setCurrent(next); onValueChange?.(next) }, [onValueChange])
  return (
    <TabsCtx.Provider value={{ layoutId, value: current }}>
      <LayoutGroup id={layoutId}>
        <TabsPrimitive.Root value={value} defaultValue={defaultValue} onValueChange={handle} {...props} />
      </LayoutGroup>
    </TabsCtx.Provider>
  )
}

function TabsTrigger({ value, children, className, ...props }) {
  const { layoutId, value: current } = React.useContext(TabsCtx)
  const reduce = useReducedMotion()
  const active = current === value
  return (
    <TabsPrimitive.Trigger data-slot="tabs-trigger" value={value} className={cn("lx-tab", className)} {...props}>
      <span className="lx-tab__label">{children}</span>
      {active ? (
        <motion.span
          layoutId={`${layoutId}-indicator`}
          className="lx-tab__indicator"
          transition={reduce
            ? { duration: 0 }
            : { type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
        />
      ) : null}
    </TabsPrimitive.Trigger>
  )
}
```

Indicator geometry: `position:absolute; left:0; right:0; bottom:-1px; height:2px; border-radius:2px; background: var(--lx-navy)`.
Trigger geometry (all tab bars, one height): **36px**, `padding-inline: 12px`, font 13px, rest `var(--lx-muted)` weight 550, active `var(--lx-ink)` weight 650, `transition: color 140ms var(--lx-ease)`.
`TabsList`: `variant="line"` only — delete the `default` (pill) variant, it has no call sites that survive. `gap: 4px`, `border-bottom: 1px solid var(--lx-hairline)`, transparent background.

All three tab systems adopt this: `/people` (W3), `/decisions` (W4), and Speaker Ops' fake `<nav>` of ghost buttons (W1) — which also gains `role="tablist"` semantics for free.

Delete the hand-written indicators: `workspace.css:135-137`, `leadership-workspace.css:346-349`, `leadership-workspace.css:545-549`, `speaker-ops.css:1033-1037` and its `≤820px` animated `::after` at `:1150-1172`.

### 7.2 Route transition (W1, `LeadershipShell.tsx`)

Incoming content animates. Outgoing does not — no `AnimatePresence`, no cross-fade, no `mode="wait"` delay.

```tsx
<main id="main-content" className="dc-workspace-main ws-main leadership-main">
  <motion.div
    key={location.pathname}
    initial={reduce ? false : { opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: reduce ? 0 : 0.18, ease: [0.2, 0, 0, 1] }}
  >
    {children}
  </motion.div>
</main>
```

`const reduce = useReducedMotion()`. The `key` moves off `<main>` onto the inner `motion.div` so `<main>` keeps its DOM identity as a scroll and focus container.

Also in W1, same edit:
- Delete the `requestAnimationFrame` + `window.scrollTo` effect (`LeadershipShell.tsx:65-69`). `App.tsx` already runs `<ScrollToTop enabled />`; two resets race on every navigation. `App.tsx` is out of scope, so the shell's copy is the one that goes.
- Add focus management: the topbar `<h1>` gets `tabIndex={-1}` and `.focus({ preventScroll: true })` on pathname change, and the topbar gets `aria-live="polite"`. Route changes currently drop focus to `<body>` with no announcement.

### 7.3 Radix open/close (W2)

All Radix enter/exit animation classes in `ui/**` are dead for the same reason as the tabs: `data-open:` / `data-closed:` compile to `[data-open]` / `[data-closed]`, and Radix emits `data-state="open"|"closed"`. Because Radix Presence waits on a computed animation name to defer unmount and there is none, **every dialog, sheet, dropdown, select and tooltip in the app hard-cuts in and out.**

W2 rewrites every occurrence of `data-open:` → `data-[state=open]:` and `data-closed:` → `data-[state=closed]:` and `data-active:` → `data-[state=active]:` in:
`dialog.tsx:42,64` · `alert-dialog.tsx:37,59` · `sheet.tsx:40,65` · `select.tsx:70` · `dropdown-menu.tsx:44,245` · `tooltip.tsx:43` · `tabs.tsx:64-67` (superseded by §7.1) · plus any other `data-open`/`data-closed`/`data-active` occurrence found by grep across `src/components/ui/**`.

Target durations after the rewrite:
- **Dialog / AlertDialog**: overlay `fade-in-0` 160ms; content `fade-in-0 zoom-in-[0.98]` 160ms in, 120ms out, `--lx-ease`.
- **Sheet**: `slide-in-from-right` 200ms in, 160ms out.
- **Select / DropdownMenu / Tooltip**: `fade-in-0 zoom-in-[0.98]` 120ms in, 90ms out.

### 7.4 Hover and micro-interaction rules

The app currently has four different "this is hoverable" languages (1px lift, 2px lift, left inset bar, background wash), often stacked on one element, and applies the lift to plain non-interactive `<article>` elements on the Dashboard and Calendar — advertising clickability that does nothing.

One language:
- **Hover = background only.** `background-color var(--lx-hover-wash)`, `transition: background-color 120ms var(--lx-ease)`. No transform, no scale, no shadow bloom, no border-color change on rows.
- **Only actually-interactive elements get hover.** `.ws-agenda-row` and `.ws-calendar-row` are `<article>`s — they get no hover state at all.
- **Active nav item** = `background: var(--lx-active-wash)`, `color: var(--lx-navy)`, `font-weight: 650`. No inset bar, no `::before`.
- **Chevrons** rotate 180° over 150ms on `data-state="open"`. That is the only rotation in the app.
- **Progress bars** animate `width` 320ms `--lx-ease`.
- Delete: the sidebar logo hover translate (`leadership-shell.css:100-107`), the speaker slot chevron `translateX(-2px) rotate(-5deg)` (`speaker-ops.css:573-581`), the room/calendar card `translateY(-2px)` (`speaker-ops.css:837-844, 891-897`), the textarea focus `translateY(-3px)` (`decision-center.css:697-720`), the Speaker Ops button `scale(.985)` press (`speaker-ops.css:71-77`), and `@keyframes speaker-glass-shift` with its 16s infinite loop (`speaker-ops.css:105`, applied only to `.speaker-topbar`, which never renders).

### 7.5 Reduced motion

Every workstream that owns a `prefers-reduced-motion` block rewrites it to this shape. There are currently four overlapping blocks and three of them set `animation-name: none !important`, **which freezes every `Spinner` into a static broken circle** — loading states show a motionless icon with no progress signal.

```css
@media (prefers-reduced-motion: reduce) {
  <scope> *, <scope> *::before, <scope> *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  /* Loading indicators are information, not decoration. */
  <scope> [data-slot="spinner"],
  <scope> .animate-spin {
    animation-duration: 900ms !important;
    animation-iteration-count: infinite !important;
  }
}
```

Never `animation-name: none`. Scopes: `.leadership-shell`, `.speaker-ops` (W1); `.dc-app-shell, .ws-shell, .dc-ballot-page, .dc-auth-page` (W1 in `leadership-workspace.css`); `.av-*` (W5). JS side: `useReducedMotion()` from framer-motion gates §7.1 and §7.2 as shown.

---

## 8. Page chrome

### 8.1 Sidebar (W1) — fixes "crammed together"

Current: 214px column, 34px rows at a **3px** gutter, labels rendering at 17px instead of 11.5px because of the flattener, and four different left-edge inset values (14 / 20 / 50 / 51px). Three unrelated vertical rhythms stack at the Admin divider (17px above the rule, 12px below, 6px to the link, 3px between links).

| Property | Value |
|---|---|
| grid column | **224px** |
| container padding | `12px` |
| surface | the one glass recipe (§2.3), `border-right: 1px solid var(--lx-hairline)` |
| brand block | 48px tall, `margin-bottom: 16px`, logo 32px, **no hover animation** |
| nav region | `flex: 1; min-height: 0; overflow-y: auto` — the sidebar currently cannot scroll and clips the account row on short viewports |
| link | height **36px**, `padding-inline: 10px`, radius 8px, `gap: 10px` |
| link icon box | **28×28**, glyph 16px, no background, no box-shadow |
| gap between links | **4px** |
| link label | 12.5px / 550; active 650 |
| active link | `background: var(--lx-active-wash)`, `color: var(--lx-navy)`. No inset bar. |
| hover | `background: var(--lx-hover-wash)`, 120ms, nothing else |
| Admin divider | `margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--lx-hairline)` |
| Admin group label | 28px tall, `padding-inline: 10px`, 11px / 650 / 0.06em / uppercase / `var(--lx-faint)` |
| account row | `margin-top: auto; padding-top: 12px; border-top: 1px solid var(--lx-hairline)`; grid `28px 1fr 28px`, `gap: 10px`, `padding-inline: 10px`, height 48px |
| avatar | 28px circle, 11px / 700 |
| account name | 12.5px / 600 `var(--lx-ink)`; role line 11.5px / 500 `var(--lx-faint)` |

**Alignment contract:** icons, avatar, and the Admin group label all start at **22px** from the viewport edge (12 container + 10 link). All labels start at **60px** (22 + 28 icon + 10 gap). No other left inset exists in the sidebar.

Delete `.leadership-sidebar::before` (the radial wash across `inset: -20% -40% 45%` that gives the nav's top half a different ground than its bottom half).

### 8.2 Topbar (W1) — fixes "two stacked header bands"

Current: 78px band holding 23px of left-aligned content and nothing else, then a second 40px `--action-only` page band below it holding only a button, on six routes. 148px of chrome before the first surface, plus a decorative 280×180px radial blob.

| Property | Value |
|---|---|
| height | **56px** |
| padding | `0 32px` (`0 24px` ≤1100, `0 16px` ≤820) |
| surface | the one glass recipe, `border-bottom: 1px solid var(--lx-hairline)`, `position: sticky; top: 0; z-index: 20` |
| layout | `display:flex; align-items:center; justify-content:space-between; gap:16px` |
| `h1` | 18px / 650 / −0.01em, `tabIndex={-1}` |
| right slot | **the page's primary action lives here** |
| decorative `::after` | deleted |

**The page action moves into the topbar.** W1 adds a context in `src/features/leadership/components/LeadershipPage.tsx` (`LeadershipHeaderActionContext`) that `LeadershipPage` writes its `action` prop into and `LeadershipShell` renders in the topbar's right slot. **Call sites do not change** — W3/W4/W5 keep passing `action={...}` to `LeadershipPage` exactly as today. This deletes `.leadership-page__header--action-only` (the empty 40px band) and fills the 80% of the topbar that is currently unused glass.

`LeadershipPage` after this renders: nothing but `<div className="ws-page">{children}</div>`, plus an optional `<h2>` when `title` is passed. The `eyebrow` prop and `LeadershipSection`'s `description` prop have zero call sites — delete both.

`.speaker-workflow-tabs { position: sticky; top: 78px }` (`speaker-ops.css:1009-1011`) becomes `top: 56px`, and gains the value in both the `≤820px` and `≤480px` blocks (it is currently hard-coded once and leaks a 2px strip of scrolling content on mobile).

### 8.3 Page box — one declaration (W1)

`.ws-page` is currently declared **ten times** across four files with five competing desktop boxes and five mobile ones. The winner sets `margin: 0` inside a 1480px max-width, so on a wide monitor content hugs the sidebar and leaves a large right gutter.

One declaration, in `src/features/leadership/leadership-shell.css`:

```css
.dc-app-shell.leadership-shell .ws-page {
  width: 100%;
  max-width: 1240px;
  margin-inline: auto;
  padding: 28px 32px 64px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
@media (max-width: 1100px) { … padding: 24px 24px 64px; }
@media (max-width: 820px)  { … padding: 20px 16px 96px; }
```

Everyone else deletes their copy:
- **W3** — `workspace.css:53`, `:224`, `:233`, `:255-256`
- **W1** — `leadership-workspace.css:269-272`, `:928-935`, `:1193-1198`, `:505-508` (`.dc-page`), `:864-867` (`.av-*`)
- **W5** — `availability.css:620-622` (the 22px inline outlier)
- **W1** — `speaker-ops.css:457`, `:1039-1041`

`.dc-page`, `.av-create-page`, `.av-workspace-results`, `.speaker-content` all become aliases: they add no padding. Delete `--ws-content-max`, `--ws-page-x`, `--ws-page-y` (dead variables).

### 8.4 One page wrapper for every route

These four routes bypass `LeadershipPage` and render their own header, their own `<h1>` (producing two `<h1>`s per page), and their own padding:

| Route | File | Owner |
|---|---|---|
| `/decisions/new` | `CreateDecisionPage.tsx:176-180` | W4 |
| `/decisions/:slug/results` | `DecisionResultsPage.tsx:139` | W4 |
| `/scheduling/new` | `CreateAvailabilityPollPage.tsx:92-97` | W5 |
| `/scheduling/:slug/results` | `AvailabilityResultsPage.tsx:22` | W5 |

All four adopt `<LeadershipPage>`, drop their own `<header>`, drop their `<h1>` (the topbar already renders one), and drop the bespoke close/back button (browser back + the sidebar are the escape routes; if a close affordance is genuinely needed, pass it as `action`). Delete `.dc-page-heading` (`leadership-workspace.css:937-945`, the 88px third header system) — W1.

### 8.5 Card / section

`Card size="sm"` via `LeadershipSection` / `LeadershipSurface` is the only container. 4 of 13 routes use it today; all 13 should.

| Property | Value |
|---|---|
| background | `#ffffff` (opaque, no glass) |
| border | `1px solid var(--lx-hairline)` |
| radius | `12px` |
| shadow | `var(--lx-shadow-sm)` |
| padding | `20px` |
| header | height **52px**, `padding: 0 20px`, `border-bottom: 1px solid var(--lx-hairline)`, title 15px/640, optional right action |
| header (flush content) | content gets `padding: 0`; rows supply their own 12px 20px |

All three section-header band heights unify at 52px: `.leadership-section__header` (was 56), `.dc-list-toolbar` (was 58), `.ws-people-tools` (was 64).

### 8.6 Empty states

One component (`Empty`), one shape, everywhere. Three heights (86 / 220 / 340px) and two capitalisation registers collapse to:

- `min-height: 180px`, centred, `padding: 32px 24px`
- icon 20px `var(--lx-faint)` in a 40px circle `var(--lx-canvas)`
- title 13.5px / 550 / `var(--lx-ink)` — a fact, sentence case
- optional single CTA, `variant="outline" size="sm"`, naming the object
- **no dashed border.** The dashed 340px box nested inside the finished glass card on `/decisions` goes away.
- Never nest an `Empty` inside a `LeadershipSurface` that already has a border. Render one or the other.

### 8.7 Mobile navigation (W1)

The bottom bar exposes only 4 of 9 destinations; Dashboard, Projects and People are reachable only through a hamburger dropdown that duplicates the entire nav including the four already in the bar.

- Bottom bar: **Dashboard, Questions, Calendar, Projects** (the four the exec uses daily), 5th slot = `More`.
- `More` opens the dropdown, which lists **only** what is not in the bar: Scheduling, Speaker Ops, People, Admin group, Sign out. No duplicates.
- Bottom bar item: 56px tall, icon 20px, label 10.5px/600, active `var(--lx-navy)`, inactive `var(--lx-faint)`. No background pill.
- Dropdown items get the §5 `ghost` hover, not the teal `--accent` wash (already fixed by §3.2).

---

## 9. Cascade cleanup

### 9.1 W4, FIRST AND BLOCKING — delete the type flattener

`src/features/decisions/decision-center.css:2371-2412`:

```css
:is(.dc-app-shell, .dc-ballot-page, .dc-auth-page,
    .dc-member-dialog, .dc-agent-key-dialog, .dc-finalize-dialog) :where(*) {
  font-family: inherit !important;
  font-size: var(--dc-type-body) !important;   /* 17px */
  font-weight: 400 !important;
  letter-spacing: 0.005em !important;
}
```

Specificity (0,1,0) + `!important`, loaded after `leadership-shell.css`. **Every descendant of the dashboard renders at 17px / weight 400** unless beaten by an `!important` rule of specificity ≥ (0,2,0). It was written for the old ballot design and never scoped away when `.dc-app-shell` became the leadership root. It is the mechanical cause of "sizing is inconsistent across the whole app": 11.5px nav links render at 17px, 10px eyebrows render at 17px, the active nav item's weight-650 differentiation is erased, and the only escape hatch is a substring rule that forces 14px on any class containing `eyebrow|meta|caption|hint|help|status|pill`.

Delete both the `:where(*)` block (`:2371-2383`) and the substring block (`:2385-2412`), and `--dc-type-body` / `--dc-type-small` with them. Then delete the compensating `!important`s in the same file.

### 9.2 The `!important` budget

175 `!important` declarations across eight reachable stylesheets fight four separate wars (font family, the flattener, `.ws-shell` self-defence, text-transform).

**Target: zero `!important` in the dashboard**, with one allowed exception per workstream, documented inline with a `/* why */` comment. Per-file current counts: `decision-center.css` 50 (W4) · `workspace.css` 41 (W3) · `leadership-workspace.css` 36 (W1) · `leadership-shell.css` 28 (W1) · `speaker-ops.css` 9 (W1) · `availability.css` 7 (W5).

### 9.3 Font family — set once

Delete every `font-family` `!important` in the dashboard. The winner today is `leadership-workspace.css:32/43/54` forcing `Arial, Helvetica, sans-serif`, which is why the topbar h1 and card titles are Plus Jakarta and literally everything else is Arial.

- W1 sets `font-family: var(--lx-font)` once on `.dc-app-shell.leadership-shell`, and once in the `body:has(…)` portal block from §3.2. No `!important`, no `*` selector.
- W1 deletes `leadership-shell.css:42, 53, 313, 358, 462, 620` family declarations (redundant once inheritance works) and `leadership-workspace.css:32, 43, 54`.
- W3 deletes `workspace.css:15, 20, 149, 151`.
- W4 deletes `decision-center.css:19, 41, 648, 987, 1146, 1191, 1205, 1336, 1621, 1639, 2365, 2379, 2452`. **Instrument Serif never renders in the dashboard today and must not start** — the display serif is a public-site face.
- W5 deletes `availability.css:15, 31, 51, 473`.
- W1 deletes `speaker-ops.css:40, 48, 56`.

### 9.4 Dead CSS — delete outright

Verified by grep to be rendered by zero `.tsx` in `src/`. Deleting these removes hundreds of lines of cascade noise.

- **W3** (`workspace.css`): `.ws-sidebar*` (`:31-52`), `.ws-app-header*`, `.ws-brand`, `.ws-inset`, `.ws-corner-logo`, `.ws-page-header`, `.ws-section-heading` (`:67-69`), `.ws-kicker`, `.ws-mobile-header`, `.ws-mobile-nav`, `.dc-mobile-nav*` (`:230-260`), `.ws-waiting` (`:84-90` where unrendered), `.ws-section`.
- **W1** (`leadership-workspace.css`): `:105-256` (dead sidebar chrome incl. `--sidebar-width: 236px !important`), `:258-261` (`.ws-inset`), `:878-921`, `:937-1014` (`.ws-page-header`, `.dc-page-heading`), `:1117-1191` (`.ws-app-header` re-show + `.dc-mobile-nav`).
- **W1** (`speaker-ops.css`): `.speaker-topbar` and `@keyframes speaker-glass-shift` (`:105`, `:369-386`), `.speaker-sidebar*`, `.speaker-suite-link` (`:177-235`), `.speaker-mobile-nav`, `.speaker-suite-mobile-nav`, `.speaker-access-*`, and the `grid-template-columns: 236px minmax(0,1fr)` at `:136` neutralised at `:998-1003`.
- **W4** (`decision-center.css`): `.dc-sheet-link` (`:314-319`), `.dc-nav-link*` (`:226-227`), `.dc-mobile-nav-link*` (`:1974-1975`).
- **W2**: `src/components/ui/sidebar.tsx` has zero call sites in the dashboard — delete the file if nothing else in `src/` imports it; otherwise leave and note.

### 9.5 Dead strings and dead props

- `navigation.ts` — the `description` field on `LeadershipRouteHeader` is never read (`LeadershipShell.tsx:115-119` renders only `header.title`). **Delete the field and all 15 strings.** They are the densest concentration of AI-slop in the codebase and none of them has ever been on screen. (W1)
- `navigation.ts:156-159` `fallbackHeader` — unreachable; every workspace route matches an earlier rule. Keep one minimal fallback `{ title: "Workspace" }`. (W1)
- `LeadershipPage.tsx:56` `eyebrow` prop, `:86` `LeadershipSection` `description` prop — zero call sites. Delete. (W1)
- `availability/format.ts:26-30` `durationLabel()` — unused. Delete. (W5)
- `decisions/format.ts:64-71` `formatRelativeDate()` — unused. Delete. (W4)
- `decisions/demoAdapter.ts` + `LiveDecisionCenter.tsx:291-297` — ~20 hand-written `activity` strings for a feed no page renders (`grep .activity` in `pages/` + `components/` → 0 hits). Delete the strings; keep the data shape if the server contract needs it. (W4)
- `lib/speakerOps.ts:94-101` — `SpeakerOpsWorkspace.activity` and `.members` fetched and never rendered. Leave the type; do not add UI. (out of scope — note only)

---

## 10. Copy rewrite table

**Rules:** Sentence case. Say what the thing is, not why it matters. No rule-of-three noun lists. No benefit-restating. No throat-clearing about design decisions ("This is intentionally a manual step"). No system-explaining to a club exec. One vocabulary: the object is a **question**, never a "decision", never a "ballot", never a "Decision Center". "Electorate" is not a word this app uses.

`—` in the Replacement column means **delete the string and its element**.

### 10.1 W1 — `src/features/leadership/**`, `src/features/speakers/**`

| file:line | Current | Replacement |
|---|---|---|
| `navigation.ts:60` | `Plan one or two firesides. Do not offer a date until Ross confirms a room.` | — (delete `description` field) |
| `navigation.ts:67` | `Manage the leadership roster and workspace permissions.` | — |
| `navigation.ts:74` | `Connect approved tools to leadership decisions and workflows.` | — |
| `navigation.ts:81` | `Frame the decision, set the rules, and invite the right people.` | — |
| `navigation.ts:88` | `Review participation, responses, and the recorded outcome.` | — |
| `navigation.ts:95` | `Offer working windows and find the time that fits the group.` | — |
| `navigation.ts:103` | `Compare availability and choose the strongest working window.` | — |
| `navigation.ts:109` | `Upcoming events, active work, and what needs your attention.` | — |
| `navigation.ts:116` | `Review participation, responses, and recorded decisions.` | — |
| `navigation.ts:123` | `Make decisions with context, clear deadlines, and recorded responses.` | — |
| `navigation.ts:130` | `Find time for leadership meetings and working sessions.` | — |
| `navigation.ts:137` | `Keep meetings, deadlines, and events in one shared timeline.` | — |
| `navigation.ts:144` | `Track owners, next actions, deadlines, and progress.` | — |
| `navigation.ts:151` | `Find leadership members, roles, teams, and contact context.` | — |
| `navigation.ts:158` | `Questions, scheduling, events, projects, and member coordination.` | — |
| `navigation.ts:30` | `Speaker Ops` | `Speakers` |
| `navigation.ts:31` | `Club calendar` | `Calendar` |
| `navigation.ts:37` | `Members + access` | `Members` |
| `navigation.ts:59` | header title `Speaker Ops` | `Speakers` |
| `navigation.ts:66` | header title `Members + access` | `Members` |
| `navigation.ts:86` | header title `Question results` | `Results` |
| `navigation.ts:136` | header title `Club calendar` | `Calendar` |
| `navigation.ts:157` | `Leadership Workspace` | `Workspace` |
| `LeadershipShell.tsx:58` | `displayName = "UBLDA member"` | `"Member"` |
| `LeadershipShell.tsx:97` | `<span>{role}</span>` renders raw `admin` / `member` | map: `admin → "Admin"`, `member → "Member"` |
| `LeadershipShell.tsx:132` | `Workspace` dropdown label | `Go to` |
| `SpeakerOpsEntry.tsx:59-62` | `Pipeline`, `Program slots`, `Room requests`, `Calendar` | `Pipeline`, `Slots`, `Rooms`, `Calendar` — and **delete the `Program slots` tab**: it renders `ProgramSlots` only, a strict subset of what `Pipeline` already shows |
| `SpeakerOpsEntry.tsx:92` | `'Not set'` | `'—'` |
| `SpeakerOpsEntry.tsx:107` | `'No contact'` | `'—'` |
| `SpeakerOpsEntry.tsx:110` | `.name.split(' ')[0]` (first names in the table, full names in the owner select) | render the full `name` |
| `SpeakerOpsEntry.tsx:153` | `{room?.roomName \|\| ROOM_REQUEST_STATUS_LABELS[room?.status \|\| 'draft']}` — shows `Draft` when no request exists | `{room?.roomName ?? "—"}` |
| `SpeakerOpsEntry.tsx:334` | FieldDescription | — |
| `SpeakerOpsEntry.tsx:388` | `Dates stay internal until Ross approves the room.` | keep — this one is the real rule, stated once |
| `SpeakerOpsEntry.tsx:395-396` | `Room gate` / `` `Ross request is ${room?.status \|\| 'not started'}.` `` (raw enum in a sentence) | — (delete; `:388` already says it) |
| `SpeakerOpsEntry.tsx:412` | `Only a workspace admin can confirm. The server checks Ross approval.` | — |
| `SpeakerOpsEntry.tsx:461` | advisory Alert | — |
| `SpeakerOpsEntry.tsx:506` | `Response clock starts when submitted` | — |
| `SpeakerOpsEntry.tsx:521` | `Working windows, not speaker offers.` | keep |
| `SpeakerOpsEntry.tsx:524` | advisory Alert wrapper | unwrap to plain text |
| `SpeakerOpsEntry.tsx:526` | `Calendar-safe does not mean booked` | — |
| `SpeakerOpsEntry.tsx:527` | `Check the room first, then the speaker. Keep both proposed dates internal until Ross replies.` | — |
| `SpeakerOpsEntry.tsx:684` | `try again` | `Try again` |
| `SpeakerOpsEntry.tsx:220-244` | no empty state — bare table headers with no rows | add `Empty`: title `No leads yet`, CTA `Add a lead` |
| `SpeakerOpsEntry.tsx:143-158` | empty slot list renders silently | add `Empty`: title `No slots yet` |

### 10.2 W3 — `src/features/workspace/**`

| file:line | Current | Replacement |
|---|---|---|
| `WorkspaceOverviewPage.tsx:61` | `?? "there"` → renders `Good morning, there` | drop the greeting entirely; pass no `title` (the topbar already says `Dashboard`) |
| `WorkspaceOverviewPage.tsx:68` | `` title={`Good morning, ${firstName}`} `` — hardcoded to morning at all hours, and a second `<h1>`-class heading beside the topbar's | remove the `title` prop |
| `WorkspaceOverviewPage.tsx:86` | `upcoming agenda` | `Upcoming` |
| `WorkspaceOverviewPage.tsx:89` | `calendar` | `Calendar` |
| `WorkspaceOverviewPage.tsx:102` | `nothing scheduled` / `open calendar` | `Nothing scheduled` / `Open calendar` |
| `WorkspaceOverviewPage.tsx:107` | `active work` | `Active work` |
| `WorkspaceOverviewPage.tsx:110` | `projects` | `Projects` |
| `WorkspaceOverviewPage.tsx:121` | `"no open tasks"` sitting in the next-task-title slot, so it reads as a task named that | `"—"` |
| `WorkspaceOverviewPage.tsx:126` | `no active projects` / `open projects` | `No active projects` / `Open projects` |
| `WorkspaceOverviewPage.tsx:130` | `waiting on you` | `Waiting on you` |
| `WorkspaceOverviewPage.tsx:135` | `<span>{item.type}</span>` — raw `decision` / `scheduling` / `task` | map: `Question`, `Scheduling`, `Task` |
| `WorkspaceOverviewPage.tsx:136` | `you’re caught up` | `All clear` |
| `ClubCalendarPage.tsx:44` | `event added` | `Event added` |
| `ClubCalendarPage.tsx:46` | `event could not be added` | `Event could not be added` |
| `ClubCalendarPage.tsx:51` | button `add event` | `Add event` |
| `ClubCalendarPage.tsx:53` | dialog title `add event` | `Add event` |
| `ClubCalendarPage.tsx:56` | `title` | `Title` |
| `ClubCalendarPage.tsx:57` | `type` | `Type` |
| `ClubCalendarPage.tsx:57` | `location` | `Location` |
| `ClubCalendarPage.tsx:57` | `{["meeting","event","deadline","project"]}` raw enums as options | label map: `Meeting`, `Event`, `Deadline`, `Project` |
| `ClubCalendarPage.tsx:58` | `starts` / `ends` | `Starts` / `Ends` |
| `ClubCalendarPage.tsx:59` | `owner` / `project` | `Owner` / `Project` |
| `ClubCalendarPage.tsx:59` | `unassigned` / `none` | `Unassigned` / `None` |
| `ClubCalendarPage.tsx:61` | submit `add event` | `Add event` |
| `ClubCalendarPage.tsx:70` | `aria-label="next 14 days"` on a non-interactive `<div>` (ignored by AT) | move to a `<section aria-label="Next 14 days">` or drop |
| `ClubCalendarPage.tsx:70` | `.toLowerCase()` on weekday and month | remove both |
| `ClubCalendarPage.tsx:72` | `agenda` | `Agenda` |
| `ClubCalendarPage.tsx:73` | `{event.status}` raw enum chip | label map: `Confirmed`, `Tentative`, `Cancelled` |
| `ClubCalendarPage.tsx:73` | `nothing on the calendar` | `Nothing on the calendar` |
| `ProjectsPage.tsx:31` | `Project added` / `Project could not be added` | keep |
| `ProjectsPage.tsx:34` | `window.prompt("task")` | replace with an inline row input (see W3 checklist); toast strings below |
| `ProjectsPage.tsx:35` | `task added` / `task could not be added` | `Task added` / `Task could not be added` |
| `ProjectsPage.tsx:38` | `task could not be updated` | `Task could not be updated` |
| `ProjectsPage.tsx:40` | `unassigned` | `Unassigned` |
| `ProjectsPage.tsx:61` | `no projects yet` | `No projects yet` + CTA `New project` |
| `ProjectsPage.tsx:75` | `add task` | `Add task` |
| `ProjectsPage.tsx:76` | `item`, `owner`, `status`, `due`, `progress` | `Item`, `Owner`, `Status`, `Due`, `Progress` |
| `ProjectsPage.tsx:80` | `progress` column shows a % bar on project rows and a prose sentence on task rows | task rows render `—`; move `completionSignal` into the task title cell as a `<small>` |
| `PeoplePage.tsx:39` | `profile updated` / `profile could not be updated` | `Profile updated` / `Profile could not be updated` |
| `PeoplePage.tsx:44` | `leadership` / `all members` / `search people` | `Leadership` / `All members` / `Search people` |
| `PeoplePage.tsx:48` | `no people found` | `No people found` |
| `PeoplePage.tsx:50` | `` edit {editing.displayName.toLowerCase()} `` — lowercases a real person's name | `Edit profile` |
| `PeoplePage.tsx:50` | `club role`, `team`, `school year`, `program`, `linkedin`, `leadership directory`, `save profile` | `Club role`, `Team`, `School year`, `Program`, `LinkedIn`, `Show in leadership directory`, `Save` |
| `format.ts:11-14` | `planned` / `active` / `blocked` / `complete` | `Planned` / `Active` / `Blocked` / `Complete` |
| `format.ts:18-21` | `to do` / `working` / `blocked` / `done` | `To do` / `Working` / `Blocked` / `Done` |
| `format.ts:39, 41` | `.toLowerCase()` on event times | remove |
| `format.ts:48` | `.toLowerCase()` on due dates | remove |
| `demoAdapter.ts:20-35` | all-lowercase seed: `weekly e-board`, `michigan union`, `speaker pipeline check-in`, `fall kickoff`, `tbd`, `accessibility advisory pilot`, `turn discovery into a scoped pilot`, `fall speaker series`, `confirm the first two fall speakers`, `member onboarding`, `make the first month repeatable`, `write the one-page pilot scope`, `scope is ready for board review`, `confirm first speaker date`, `date appears on the master calendar`, `finish member intake checklist` | rewrite every string in sentence case: `Weekly e-board`, `Michigan Union`, `Speaker pipeline check-in`, `Fall kickoff`, `TBD`, `Accessibility advisory pilot`, `Turn discovery into a scoped pilot`, `Fall speaker series`, `Confirm the first two fall speakers`, `Member onboarding`, `Make the first month repeatable`, `Write the one-page pilot scope`, `Ready for board review`, `Confirm first speaker date`, `On the master calendar`, `Finish member intake checklist` |

### 10.3 W4 — `src/features/decisions/**`

| file:line | Current | Replacement |
|---|---|---|
| `DecisionsPage.tsx:47` | `new question` | `New question` |
| `DecisionsPage.tsx:70` | `No decisions here` | `No open questions` (and per-filter: `No drafts`, `No closed questions`, `No questions yet`) |
| `DecisionsPage.tsx:73` | **`Create one`** — the bug the user named | `New question`, and **only render the CTA on the `All` / `Open` filters**; an empty `Drafts` or `Closed` filter gets no CTA |
| `format.ts:18` | `"after-submit": "After someone responds"` — factually wrong; `DecisionResultsPage.tsx:67` unlocks on the viewer's own response | `After you respond` |
| `format.ts:30-34` | `Advisory · record outcome manually`, `Plurality · most responses wins`, `Majority · more than half`, `Approval threshold · set a percent`, `Borda count · ranked points` | `Advisory`, `Most responses wins`, `More than half`, `Approval threshold`, `Ranked points` |
| `CreateDecisionPage.tsx:143` | `decision` vocabulary | `question` throughout the file |
| `CreateDecisionPage.tsx:155` | second `<h1>` | — (adopt `LeadershipPage`) |
| `CreateDecisionPage.tsx:156` | `Drop it in the group chat. Results update live after each member submits.` | — |
| `CreateDecisionPage.tsx:179` | `<h1>Ask once. Get the whole board’s input.</h1>` | — |
| `CreateDecisionPage.tsx:180` | `Everything members need appears on one link. Drafts stay private until you open responses.` | — |
| `CreateDecisionPage.tsx:190` | `Write this so someone can respond without scrolling through the group chat.` | — |
| `CreateDecisionPage.tsx:212` | `Use the lightest format that fits the decision.` | — |
| `CreateDecisionPage.tsx:233` | `Options` select with no accessible name | add `aria-label="Options"` |
| `CreateDecisionPage.tsx:250` | switch-row explanation | — |
| `CreateDecisionPage.tsx:260` | `Who can respond?` + `This roster snapshot stays attached to the decision even if membership changes later.` | keep the heading `Who can respond`; delete the paragraph |
| `CreateDecisionPage.tsx:292` | `Off by default. A deadline can simply be a reminder.` | — |
| `CreateDecisionPage.tsx:293` | switch stays visually checked but disabled when the deadline is cleared, while the preview reads `Auto-close · Off` | set `autoClose` to `false` when `deadline` clears; dim the `<Label>` with the control |
| `CreateDecisionPage.tsx:297, 308, 309` | selects with no accessible name | add `aria-label` |
| `CreateDecisionPage.tsx:302` | `First-choice plurality` (shadows the `format.ts` label for the same value) | use `outcomeRuleLabels.plurality` |
| `CreateDecisionPage.tsx:312` | `Each update replaces the member’s previous response and is audited.` | — |
| `CreateDecisionPage.tsx:315` | `Counting is explicit.` + `Advisory is the default. Borda gives an option N points…` | — (delete the whole `Alert`) |
| `CreateDecisionPage.tsx:337` | `Question details remain hidden until the member signs in.` | — |
| `DecisionResultsPage.tsx:58` | `Results not found` (orphaned route) | `Question not found` + a `Back to questions` link |
| `DecisionResultsPage.tsx:74-76` | `Everyone gets space to answer independently.` on a *locked* state | `Results unlock after you respond.` |
| `DecisionResultsPage.tsx:178` | `electorate` as user-facing jargon | `who can respond` |
| `DecisionResultsPage.tsx:206, 212, 221, 230` | `decision` vocabulary | `question` |
| `DecisionResultsPage.tsx:212` | `Members will no longer be able to submit or edit. You can reopen this decision later, and the action will be logged.` | `Members can no longer respond. You can reopen it later.` |
| `DecisionResultsPage.tsx:221` | `Members will be able to submit or edit again. The previous deadline will be cleared, and the action will be logged.` | `Members can respond again. The old deadline is cleared.` |
| `DecisionResultsPage.tsx:230` | `Write the actual decision in plain language. This is intentionally a manual step.` | `Write the outcome in plain language.` |
| `DecisionMembersPage.tsx:72` | `A person may have multiple approved email addresses, but always gets one ballot.` | — |
| `DecisionMembersPage.tsx:77` | `Inactive members remain in historical decision snapshots.` | `Past questions keep their original roster.` |
| `DecisionMembersPage.tsx:91` | `Admin access required` / `Only Decision Center administrators can change the member roster.` | `Admin access required` / `Only admins can change the roster.` |
| `DecisionMembersPage.tsx:96` | `{activeCount} active members. Electorates are selected per question, so the system never assumes a fixed board size.` | `{activeCount} active members` |
| `DecisionMembersPage.tsx:98` | `One person, one response` + `Approved email aliases resolve to the same roster member…` | — (delete the `Alert`) |
| `DecisionMembersPage.tsx:100` | `aria-label="Decision Center members"` | `aria-label="Members"` |
| `DecisionMembersPage.tsx:114` | `Historical rosters stay intact` + `Deactivating a member does not rewrite old decisions…` | — (delete the section; `:77` covers it) |
| `DecisionIntegrationsPage.tsx:118` | `Your key, your access` + `Keys belong to the member who created them… private Brain data.` (**"Brain" appears nowhere else in the UI**) | — (delete the `Alert`) |
| `DecisionIntegrationsPage.tsx:122` | `Copy this now` / `Your key will not be shown again.` | `Copy this key` / `It will not be shown again.` |
| `DecisionIntegrationsPage.tsx:125` | `This is a non-working preview key. Live keys must be generated and hashed on the server.` | `Preview key. Not usable.` |
| `DecisionIntegrationsPage.tsx:134, 136` | guide paragraphs + 40-word sample prompt | — |
| `DecisionIntegrationsPage.tsx:142` | `Use the same endpoint directly` | `API` |
| `DecisionIntegrationsPage.tsx:143` | `Send scoped, idempotent requests from an approved script or internal tool. The server audits every mutation.` | — |
| `DecisionIntegrationsPage.tsx:145, 151` | capability bullets | — |
| `DecisionIntegrationsPage.tsx:151` | `No keys yet. Create one when you are ready to connect an agent.` | `No keys yet` + CTA `New key` (use the `Empty` component, not a bespoke `<div>`) |
| `DecisionAuthGate.tsx:70` | `Leadership Sign In` | `Sign in` |
| `DecisionAuthGate.tsx:79` | `Continue to Secure Leadership Sign In` | — (it restates the button below it) |
| `DecisionAuthGate.tsx:84` | `sign-in could not be verified` | `Sign-in could not be verified` |
| `DecisionAuthGate.tsx:90` | `try sign in again` | `Try again` |
| `DecisionAuthGate.tsx:95` | `this account is not approved` | `This account is not approved` |
| `DecisionAuthGate.tsx:101` | `try another account` | `Use another account` |
| `DecisionAuthGate.tsx:113` | `Continue to Sign In` | `Sign in` |
| `DecisionBallotPage.tsx:209` | `submitted` | `Submitted` |
| `DecisionBallotPage.tsx:211` | `view live results` | `View results` |
| `DecisionBallotPage.tsx:217` | `edit` | `Edit` |
| `DecisionBallotPage.tsx:224` | `your response` | `Your response` |
| `DecisionBallotPage.tsx:245-246` | `submit` / `submitting…` | `Submit` / `Submitting…` |
| `DecisionBallotPage.tsx:237, 286, 288, 290` | `decision` vocabulary | `question` |
| `demoAdapter.ts:129` | `This is a draft. Options can still change before anyone responds.` (breaks the fourth wall) | `Options may still change.` |
| `demoAdapter.ts:156` | `This closed preview demonstrates exact turnout and ranked first-choice results.` | `Ranked vote on the fall speaker slate.` |
| `demoAdapter.ts:262` | `Opened voting with seven eligible members.` — dead **and** wrong (the demo electorate is 9) | — (delete with the activity strings) |
| `demoAdapter.ts:262, 269, 277, 416, 418, 431, 441, 456, 479, 499, 513` | activity strings, no renderer | — |
| `LiveDecisionCenter.tsx:291-297` | activity strings, no renderer | — |

### 10.4 W5 — `src/features/availability/**`

| file:line | Current | Replacement |
|---|---|---|
| `CreateAvailabilityPollPage.tsx:51` | bare `<h1>admin access required</h1>` with no escape route | `Alert`: title `Admin access required`, description `Only admins can create polls.`, plus a `Back to scheduling` link |
| `CreateAvailabilityPollPage.tsx:94` | `<h1>new scheduling poll</h1>` — duplicates the topbar title verbatim | — (adopt `LeadershipPage`) |
| `CreateAvailabilityPollPage.tsx:95` | `aria-label="close"` X button | — |
| `CreateAvailabilityPollPage.tsx:103` | `what are we scheduling?` | `What are we scheduling` |
| `CreateAvailabilityPollPage.tsx:108` | `how long?` | `Length` (+ `aria-label="Length"` on the trigger) |
| `CreateAvailabilityPollPage.tsx:116` | `possible dates` | `Possible dates` (+ `aria-label`) |
| `CreateAvailabilityPollPage.tsx:120` | `.toLowerCase()` on date chips | remove |
| `CreateAvailabilityPollPage.tsx:126` | `add date` | `Add date` |
| `CreateAvailabilityPollPage.tsx:131` | `time window` | `Time window` (+ `aria-label`) |
| `CreateAvailabilityPollPage.tsx:140` | `who should respond?` / `all {n} members` | `Who responds` / `All {n} members` (+ `aria-label`) |
| `CreateAvailabilityPollPage.tsx:145` | `reply by` | `Reply by` |
| `CreateAvailabilityPollPage.tsx:152` | `let people see results` | `Show results to members` |
| `CreateAvailabilityPollPage.tsx:161` | `create & copy link` | `Create poll` |
| `SchedulingDashboardPage.tsx:26` | `New poll` (third name for `/scheduling/new`, whose topbar says `New scheduling poll` and whose h1 says `new scheduling poll`) | `New poll` — and change `navigation.ts:94` to `New poll` so all three match (W1 owns that line; listed in W1's table) |
| `SchedulingDashboardPage.tsx:32` | `<h2>Scheduling polls</h2>` duplicating the topbar `Scheduling` | — |
| `SchedulingDashboardPage.tsx:36` | `Loading…` as a bare `<p>` | `Skeleton` rows |
| `SchedulingDashboardPage.tsx:59` | `<p>No scheduling polls yet.</p>` — the only list in the app not using `Empty` | `Empty`: title `No polls yet`, CTA `New poll` |
| `AvailabilityPollPage.tsx:23` | `opening poll…` | `Loading…` |
| `AvailabilityPollPage.tsx:28-29` | `poll not found` / `back to scheduling` | `Poll not found` / `Back to scheduling` |
| `AvailabilityPollPage.tsx:190` | `saving…` / `try again` / `saved` / `drag across every time that works` | `Saving…` / `Try again` / `Saved` / `Drag across the times that work` |
| `AvailabilityPollPage.tsx:202` | `see best times` | `See best times` |
| `AvailabilityResultsPage.tsx:19` | `loading…` / `results not found` | `Loading…` / `Results not found` |
| `AvailabilityResultsPanel.tsx:22` | `results unlock after you reply` | `Results unlock after you reply` |
| `AvailabilityResultsPanel.tsx:39, 41` | `time chosen` / `time could not be chosen` | `Time chosen` / `Time could not be chosen` |
| `AvailabilityResultsPanel.tsx:56` | `best times` | `Best times` |
| `AvailabilityResultsPanel.tsx:60` | `.toLowerCase()` on member display names | remove |
| `AvailabilityResultsPanel.tsx:65` | `chosen · {label}` | `Chosen · {label}` |
| `AvailabilityResultsPanel.tsx:75` | `no complete times yet` | `No complete times yet` |
| `AvailabilityResultsPanel.tsx:80` | `copy link` | `Copy link` |
| `AvailabilityResultsPanel.tsx:84` | `chosen` / `choose time` | `Chosen` / `Choose time` |
| `AvailabilityResultsPanel.tsx:97` | `.toLowerCase()` on date headers | remove |
| `format.ts:21` | `.toLowerCase()` in `dayParts` | remove |
| `format.ts:26-30` | `durationLabel()` unused | delete |
| `format.ts:33-34` | `detroit time` / `.toLowerCase()` fallback | `Detroit time`; remove `.toLowerCase()` |
| `format.ts:38` | `.toLowerCase()` in `candidateLabel` | remove |
| `demoAdapter.ts:44` | `missing: [{ memberId: "member-9", displayName: "Alexa" }]` — first-name-only, and `member-9` matches no member in any other feature | use a full name and a `member-*` slug consistent with `decisions/demoAdapter.ts:23-87` |
| `demoAdapter.ts:51-52, 78` | `fall kickoff`, `find 45 minutes for the full board.`, `weekly e-board meeting` | `Fall kickoff`, `Find 45 minutes for the full board`, `Weekly e-board meeting` |

---

## 11. Per-workstream checklists

Every workstream is done when: `npm run lint` and `npx tsc -b` pass, zero `!important` remain in files it owns (bar one documented exception), zero teal literals remain in files it owns, and the routes it touches render at :5180 with no console errors.

### W1 — Foundation
Owns `src/features/leadership/**`, `src/styles/leadership-workspace.css`, `src/features/speakers/**`.

- [ ] Add the `--lx-*` token block (§2.1–2.3) to `leadership-shell.css` on `.dc-app-shell.leadership-shell`.
- [ ] Add the `body:has(.dc-app-shell), body:has(.dc-ballot-page), body:has(.dc-auth-page)` block (§3.2) to `leadership-workspace.css` — token remap **and** the padding restore for every `[data-slot]` listed in §5, keyed off `data-size`. This is the single fix for teal-in-portals *and* the unpadded "add event" button.
- [ ] Rebuild the sidebar to §8.1 exactly. Verify the 22px / 60px alignment contract in devtools.
- [ ] Rebuild the topbar to §8.2: 56px, sticky, `h1` 18px/650, delete `::after`, add the `LeadershipHeaderActionContext` action slot.
- [ ] Delete `.leadership-page__header--action-only` and the whole second header band.
- [ ] `LeadershipPage`: delete `eyebrow`; `LeadershipSection`: delete `description`; write `action` into the header context.
- [ ] `navigation.ts`: delete the `description` field and all 15 strings; apply the label changes in §10.1; set `/scheduling/new` title to `New poll`.
- [ ] `LeadershipShell.tsx`: route transition per §7.2; delete the duplicate scroll reset; move `key` off `<main>`; add `h1` focus + `aria-live`; role label map.
- [ ] Mobile nav per §8.7 — bottom bar of 5, dropdown with no duplicates.
- [ ] Single `.ws-page` declaration per §8.3; delete `--ws-content-max` / `--ws-page-x` / `--ws-page-y`; delete the `.dc-page` / `.av-*` / `.speaker-content` padding blocks in the files W1 owns.
- [ ] Delete every dead CSS block listed for W1 in §9.4 (this is several hundred lines).
- [ ] Delete the `Arial !important` family war (`leadership-workspace.css:32,43,54`) and every redundant family declaration in `leadership-shell.css` and `speaker-ops.css` (§9.3).
- [ ] Delete the hand-written tab indicators in `leadership-workspace.css:346-349, 545-549` and `speaker-ops.css:1033-1037, 1150-1172`.
- [ ] Speaker Ops: replace the `<nav>` of ghost buttons with W2's `Tabs`; drop the `Program slots` tab; fix `speaker-workflow-tabs` sticky `top: 56px` in all three breakpoints; add the two missing empty states; apply §10.1 copy; delete the motion listed in §7.4.
- [ ] Elevation and glass: three shadows, one glass recipe, three radii (§2.3). Delete every other `box-shadow` and `backdrop-filter` in W1 files.
- [ ] Reduced-motion blocks rewritten per §7.5 — spinners must still spin.
- [ ] `leadership-workspace.css:1430` teal → navy.

**Done means:** the sidebar has one rhythm and one left edge; the topbar holds the title and the action and nothing else; no route shows two header bands; a page's content starts within 84px of the viewport top on desktop; the dashboard renders in one typeface.

### W2 — Primitives
Owns `src/components/ui/**` only. Adds no color literals — colors come from tokens.

- [ ] `tabs.tsx`: rebuild per §7.1 with the framer-motion `layoutId` indicator, `useReducedMotion` gate, `line` variant only, 36px triggers. Delete the `default` (pill) variant and the dead `after:` underline.
- [ ] Grep `src/components/ui/**` for `data-open:`, `data-closed:`, `data-active:` and rewrite each to the `data-[state=…]:` bracket form (§7.3). Set the durations listed there.
- [ ] `button.tsx`: the §5 size and variant tables. Delete `secondary`. Delete `active:not-aria-[haspopup]:translate-y-px`. Resize `icon*` to 36/28/24/40.
- [ ] `input.tsx`, `textarea.tsx`, `select.tsx`: the §4 geometry — 36px, 12px inline, 8px radius, `--lx-ring-shadow` focus. Add the `SelectTrigger` chevron rotation.
- [ ] `dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`: the §6 spec — one width, 12px radius, `--lx-shadow-lg`, 24px padding, footer band, 28px close at 14px inset, `text-transform: none`.
- [ ] `empty.tsx`: the §8.6 shape. No dashed border.
- [ ] `card.tsx`: the §8.5 shape. 52px header, opaque surface.
- [ ] `label.tsx` / `field.tsx`: 12px/600 label, 6px label→control gap, 16px between fields.
- [ ] `table.tsx`: header row 11.5px/560 no uppercase, cell padding `10px 12px`, row hover `--lx-hover-wash` only.
- [ ] `badge.tsx`: status chip — `--lx-radius-pill`, 20px tall, `padding-inline: 8px`, 11.5px/560, colors from §2.2.
- [ ] `sidebar.tsx`: delete if unimported anywhere in `src/`.
- [ ] Every focus state in every component is exactly `outline: none; border-color: var(--lx-ring); box-shadow: var(--lx-ring-shadow)`.

**Done means:** every dialog, sheet, dropdown and select animates in and out; the tab indicator slides; no component references `--ring`, `--accent`, or `--secondary` teal defaults for anything visible; a `<Button>` in a portal has 14px of horizontal padding.

### W3 — Workspace
Owns `src/features/workspace/**`. This is the quality bar the user named — Projects already reads well because `.ws-project-dialog` is a 66-line private design system. That system is now global, so **delete it** rather than spreading it.

- [ ] Delete every teal literal in §3.3.
- [ ] Delete `.ws-dialog { text-transform: lowercase }` (`workspace.css:148`) and `.ws-project-dialog { text-transform: none }` (`:162`). Casing comes from strings only.
- [ ] Delete the entire `.ws-project-dialog` local system (`workspace.css:156-221`) — width, padding, label style, control unification, submit padding, focus ring. All of it is now in W2's `dialog.tsx` / `button.tsx` / `input.tsx`.
- [ ] Delete `.ws-native-select` and convert both call sites (`ClubCalendarPage.tsx:59` owner + project, `ProjectsPage.tsx:50` owner) to shadcn `Select`. This is the "text doesn't line up" fix.
- [ ] Delete `.ws-primary-action` (pill) — page actions use plain `<Button>`.
- [ ] Replace `window.prompt("task")` (`ProjectsPage.tsx:34`) with an inline `Input` in the `.ws-add-task-row` cell: enter commits, Escape cancels, blur-with-value commits. No dialog, no native prompt.
- [ ] `PeoplePage.tsx:47`: rows that are not editable render as a non-interactive `<div>`, not an `aria-disabled` `<button>` that keeps tab focus, pointer cursor and hover state while doing nothing. For a non-admin viewer that is currently all 66 rows.
- [ ] Adopt W2's `Tabs` on `/people`; delete `workspace.css:135-137`.
- [ ] All empty states use §8.6; add the missing CTA to `no projects yet`.
- [ ] Remove the redundant duplicate affordances on `/workspace`: the section action `Calendar →` and the empty-state button `Open calendar` both go to `/calendar` (same for Projects). Keep the section action; the empty state keeps its CTA only when the section action is not visible.
- [ ] `.ws-agenda-row` / `.ws-calendar-row` are `<article>`s — remove their hover states entirely (§7.4).
- [ ] Apply every §10.2 copy change, including the demo seed rewrite and the three `.toLowerCase()` removals in `format.ts`.
- [ ] Delete the dead CSS listed for W3 in §9.4.
- [ ] Delete the `.ws-page` padding declarations at `workspace.css:53, 224, 233, 255-256`.

**Done means:** the add-event dialog has one control height, one padding, sentence-case labels, and a submit button with 14px of padding; Projects has no private styling left; nothing on Calendar or Dashboard pretends to be clickable.

### W4 — Decisions
Owns `src/features/decisions/**`.

- [ ] **FIRST, in its own commit:** delete the type flattener and the substring rule (`decision-center.css:2371-2412`) and `--dc-type-body` / `--dc-type-small` (§9.1). Announce it — the other four workstreams are blocked on it.
- [ ] Delete every teal literal in §3.4, including the `#2bbab0` focus fallback at `:366-372` and the `LeadershipAuthScreen.tsx:47` shader stop.
- [ ] Replace `--dc-cream` / `--dc-navy` / `--dc-teal*` with `--lx-*`. Dialogs are white, not cream.
- [ ] Delete `.dc-touch` (44px floor) — §4's ≤820px query covers touch.
- [ ] Delete `.dc-desktop-create-button`, `.dc-field-block`'s bespoke geometry, `.dc-select-trigger`, and every other local control style — W2 owns controls now.
- [ ] Adopt W2's `Tabs` on `/decisions`. Add `TabsContent` or drop `Tabs` for a plain filter group — Radix currently emits `aria-controls` pointing at panels that do not exist.
- [ ] `/decisions/new` and `/decisions/:slug/results` adopt `LeadershipPage`; delete their `<h1>`s and their own headers (§8.4).
- [ ] `/decisions` list: the column-header strip is `aria-hidden` over `<article>` rows — convert to a real `<Table>` or drop the header strip. Do not ship a headerless pseudo-table.
- [ ] `DecisionsPage.tsx:93-95` and every "waiting on you" target send the user to `/d/:slug`, which renders **outside** the shell — no sidebar, no topbar. Add a `Back to questions` affordance on the ballot page.
- [ ] `MemberDialog` (`DecisionMembersPage.tsx:29-34`): state initialises once and Cancel does not reset it. Key the dialog on the member id or reset on close.
- [ ] Delete the dead activity strings and `formatRelativeDate()` (§9.5).
- [ ] Delete the dead CSS listed for W4 in §9.4.
- [ ] Delete the `Instrument Serif` display-face declarations (§9.3).
- [ ] Apply every §10.3 copy change. `DecisionMembersPage` loses two of its three explanations of the same rule; `DecisionIntegrationsPage` loses both alerts, both guide paragraphs, the sample prompt and the bullet list, leaving the key table.
- [ ] Every `Select` listed in §10.3 gets an accessible name.

**Done means:** the dashboard renders at 13px body with a real type scale; `/decisions/settings` is a roster table with one line of context above it; `/decisions/integrations` is a key table; no page says "decision", "ballot", "electorate", "Decision Center" or "Brain".

### W5 — Availability
Owns `src/features/availability/**`.

- [ ] `--av-wash` / `--av-teal` → `--lx-*`, then delete the variables (§3.5).
- [ ] `/scheduling/new` and `/scheduling/:slug/results` adopt `LeadershipPage`; delete the bespoke `<header>`, the `<h1>`, and the X close button (§8.4).
- [ ] Delete `.av-liquid-button` (220×54 pill) — submit is a plain `<Button>` in a footer.
- [ ] Delete the local control geometry at `availability.css:463-480` (44px, zero padding, no border, radius 0, teal underline focus) — W2 owns controls.
- [ ] Delete the `.av-create-page` / `.av-workspace-results` padding at `availability.css:620-622`.
- [ ] `/scheduling` list uses `Empty` and `Skeleton`, not bare `<p>`s.
- [ ] `AvailabilityPollPage.tsx:152` `role="grid"` has `<span>`/`<button>` children with no `role="row"` / `gridcell`; `AvailabilityResultsPanel.tsx:93` `role="table"` has `role="cell"` children and no rows. Fix both or drop the roles.
- [ ] Every `Select` in `CreateAvailabilityPollPage` gets an accessible name (§10.4).
- [ ] Reduced-motion block rewritten per §7.5.
- [ ] Apply every §10.4 copy change, including the five `.toLowerCase()` removals in `format.ts` and the demo seed fix.

**Done means:** `/scheduling/new` looks like every other page in the app; one control geometry; the three names for the same destination collapse to `New poll`.

---

## 12. Acceptance — the whole thing

1. **Teal:** `grep -riE "2bbab0|19aaa0|0b6d67|0b5e58|e9f7f5|eef8f7|e8f6f4|b7ddd8|b8ddd8|e6f3f2|087d79|0b5e58" src/features src/components/ui src/styles/leadership-workspace.css` returns nothing. A DOM audit at :5180 finds no computed color with a hue between 150° and 200°.
2. **Type:** every rendered `font-family` in the dashboard is Plus Jakarta Sans. Every rendered `font-size` is on the §2.4 table.
3. **Controls:** every input, select trigger and button in every dialog measures 36px tall with ≥12px horizontal padding.
4. **Motion:** tabs slide, dialogs fade+scale, routes fade up, nothing lifts on hover, spinners spin under `prefers-reduced-motion`.
5. **Copy:** every string in §10 is changed. Nothing in the app is force-lowercased by CSS or `.toLowerCase()`.
6. **Chrome:** one header band per route. One page padding declaration. One card. One empty state.
7. **Simplicity:** every page reads like the Club calendar — a title, an action, a list.

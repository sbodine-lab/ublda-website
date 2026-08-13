/**
 * Shared class fragments for the leadership primitives.
 *
 * Every value here comes from `docs/leadership-ui-spec.md`. The `--lx-*` custom
 * properties are declared by the foundation workstream on
 * `.dc-app-shell.leadership-shell` and — so that portalled surfaces resolve the
 * same values — on `body:has(.dc-app-shell)` in
 * `src/styles/leadership-workspace.css`. These components render only inside
 * the dashboard, so the tokens always resolve; no fallbacks are needed.
 *
 * Padding stays expressed as ordinary Tailwind utilities even though the site's
 * unlayered `* { padding: 0 }` reset outranks them. The padding restore in
 * `leadership-workspace.css` is what makes them land. Keep the values here
 * identical to the values there.
 */
import "./primitives.css"

/** The only focus treatment in the app (spec §4, §5). */
export const lxFocus =
  "outline-none focus-visible:[border-color:var(--lx-ring)] focus-visible:[box-shadow:var(--lx-ring-shadow)]"

/** Invalid control (spec §4). */
export const lxInvalid =
  "aria-invalid:[border-color:#b42318] aria-invalid:[box-shadow:0_0_0_3px_rgba(180,35,24,0.16)]"

/** The only hover language: colour, 120ms, one easing curve (spec §7.4). */
export const lxTransition =
  "transition-[background-color,border-color,box-shadow,color] duration-[120ms] ease-[var(--lx-ease)]"

/**
 * The control box shared by Input, Textarea and SelectTrigger (spec §4).
 * Height and inline padding are set per component; everything else is here.
 * The ≤820px touch bump (44px, 15px text) is one rule in
 * `leadership-workspace.css` rather than a variant on each component.
 */
export const lxControlBox = [
  "w-full min-w-0 rounded-[var(--lx-radius-control)] border [border-color:var(--lx-border)]",
  "[background-color:var(--lx-surface)] [color:var(--lx-ink)]",
  "[font-family:inherit] text-[13px] [font-weight:450]",
  "placeholder:[color:var(--lx-faint)]",
  "hover:[border-color:rgba(16,24,40,0.22)]",
  "disabled:cursor-not-allowed disabled:opacity-[0.55]",
  lxTransition,
  lxFocus,
  lxInvalid,
].join(" ")

/** Popover-class surfaces: Select, DropdownMenu (spec §2.3, §6). */
export const lxPopoverSurface = [
  "rounded-[var(--lx-radius-surface)] border [border-color:var(--lx-hairline)]",
  "[background-color:var(--lx-surface)] [color:var(--lx-ink)]",
  "[box-shadow:var(--lx-shadow-md)] [font-family:inherit] text-[13px]",
].join(" ")

/** A row inside a popover surface. Hover and keyboard highlight are the same. */
export const lxPopoverItem = [
  "relative flex w-full cursor-default items-center gap-[8px] rounded-[6px]",
  "text-[13px] leading-[1.45] [font-weight:450] [color:var(--lx-ink)] outline-hidden select-none",
  "focus:[background-color:var(--lx-hover-wash)] focus:[color:var(--lx-ink)]",
  "data-disabled:pointer-events-none data-disabled:opacity-[0.55]",
  lxTransition,
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[16px]",
].join(" ")

/**
 * Radix enter/exit (spec §7.3). Radix emits `data-state="open"|"closed"`; the
 * shadcn defaults used `data-open:`/`data-closed:`, which compile to the
 * literal attributes `[data-open]`/`[data-closed]` and never match — so every
 * surface in the app hard-cut in and out.
 */
export const lxPopoverMotion = [
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]",
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98]",
  "duration-[120ms] data-[state=closed]:duration-[90ms] ease-[var(--lx-ease)]",
].join(" ")

/** Dialog and alert-dialog content: fade + scale, 160ms in, 120ms out. */
export const lxDialogMotion = [
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]",
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98]",
  "duration-[160ms] data-[state=closed]:duration-[120ms] ease-[var(--lx-ease)]",
].join(" ")

/** Dialog, alert-dialog and sheet scrim: a flat wash, no blur (spec §6). */
export const lxOverlay = [
  "fixed inset-0 z-50 [background-color:rgba(16,24,40,0.32)]",
  "data-[state=open]:animate-in data-[state=open]:fade-in-0",
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
  "duration-[160ms] data-[state=closed]:duration-[120ms] ease-[var(--lx-ease)]",
].join(" ")

/** Dialog and sheet body: one width, one radius, one shadow (spec §6). */
export const lxDialogSurface = [
  "z-50 flex flex-col [background-color:var(--lx-surface)]",
  "border [border-color:var(--lx-hairline)] [box-shadow:var(--lx-shadow-lg)]",
  "p-[24px] [font-family:inherit] text-[13px] [color:var(--lx-ink)] [text-transform:none]",
].join(" ")

/**
 * Dialog and alert-dialog footer band (spec §6). The band bleeds past the
 * 24px dialog padding so it sits flush with the dialog's inner edge.
 *
 * It is deliberately NOT sticky. A sticky footer inside the padded, scrollable
 * dialog box pins itself 24px above the scrollport whether or not the body is
 * actually scrolling, which parked it on top of the last two fields of the
 * add-event form. The dialog scrolls as one piece instead.
 */
export const lxDialogFooter = [
  "mt-[20px] -mx-[24px] -mb-[24px] px-[24px] py-[16px]",
  "flex items-center justify-end gap-[8px]",
  "[background-color:#fafbfc] border-t [border-color:var(--lx-hairline)]",
].join(" ")

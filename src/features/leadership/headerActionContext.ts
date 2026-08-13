import { createContext } from "react"

/**
 * The topbar owns the page's primary action.
 *
 * `LeadershipShell` publishes the DOM node of the topbar's right slot here;
 * `LeadershipPage` portals its `action` into it. Call sites keep passing
 * `action={…}` to `LeadershipPage` exactly as before — nothing above this file
 * changes — but the second header band the action used to sit in is gone.
 */
export const LeadershipHeaderActionContext = createContext<HTMLElement | null>(null)

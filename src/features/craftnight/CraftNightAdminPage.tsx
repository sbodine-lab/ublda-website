import { Check, Copy, Lock, LockOpen, Trash2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useLeadershipIdentity } from "@/features/decisions/leadershipIdentityContext"
import { withLeadershipRequestTimeout } from "@/features/decisions/logtoConvexAuth"
import { LeadershipPage, LeadershipSection } from "@/features/leadership/components/LeadershipPage"
import {
  CRAFT_NIGHT,
  CRAFT_NIGHT_GROUPS,
  CRAFT_NIGHT_ROSTER,
  type CraftNightPollState,
} from "@/lib/craftNight"
import "./craftnight-admin.css"

const PUBLIC_URL = "https://ublda.org/craft-night"

const allOptions = CRAFT_NIGHT_GROUPS.flatMap((group) => group.options)

const shortLabel = (optionId: string) => {
  const option = allOptions.find((entry) => entry.id === optionId)
  return option ? `${option.weekday.slice(0, 3)} ${option.month} ${option.day}` : optionId
}

export function CraftNightAdminPage() {
  const identity = useLeadershipIdentity()
  const [poll, setPoll] = useState<CraftNightPollState | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/craft-night?ts=${Date.now()}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load failed"))))
      .then((data) => {
        if (!cancelled && data?.poll) setPoll(data.poll as CraftNightPollState)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const act = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true)
    setActionError("")
    try {
      let idToken = await withLeadershipRequestTimeout(() => identity.getIdToken())
      if (!idToken) throw new Error("Your leadership session could not be verified.")
      const send = async (token: string) => {
        const res = await withLeadershipRequestTimeout((signal) => fetch("/api/craft-night", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, idToken: token, website: "" }),
          signal,
        }))
        const data = await res.json().catch(() => null)
        return { res, data }
      }
      let { res, data } = await send(idToken)
      if (res.status === 401) {
        idToken = await withLeadershipRequestTimeout(() => identity.getIdToken(true))
        if (idToken) ({ res, data } = await send(idToken))
      }
      if (!res.ok) {
        setActionError(data?.error || "That action failed.")
        return
      }
      if (data?.poll) setPoll(data.poll as CraftNightPollState)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "That action failed.")
    } finally {
      setBusy(false)
    }
  }, [identity])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(PUBLIC_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setActionError("Copy failed. The link is ublda.org/craft-night.")
    }
  }

  const responses = useMemo(() => poll?.responses ?? [], [poll])
  const responseByEmail = useMemo(
    () => new Map(responses.map((response) => [response.email, response])),
    [responses],
  )
  const closed = poll?.status === "closed"

  return (
    <LeadershipPage
      className="craftadmin"
      action={(
        <div className="craftadmin__actions">
          <Button variant="outline" size="sm" onClick={copyLink}>
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          {poll ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => act({ action: "set-status", status: closed ? "open" : "closed" })}
            >
              {closed ? <LockOpen data-icon="inline-start" /> : <Lock data-icon="inline-start" />}
              {closed ? "Reopen" : "Close"}
            </Button>
          ) : null}
        </div>
      )}
    >
      {actionError ? <p className="craftadmin__error" role="alert">{actionError}</p> : null}
      {loadError ? <p className="craftadmin__error" role="alert">The poll data did not load. Refresh to try again.</p> : null}

      {!poll && !loadError ? (
        <LeadershipSection title="Times">
          <Skeleton />
          <Skeleton />
        </LeadershipSection>
      ) : null}

      {poll ? (
        <>
          <LeadershipSection
            title="Times"
            action={<span className="sched-chip" data-tone={closed ? "closed" : "open"}>{closed ? (poll.finalOptionId ? "Finalized" : "Closed") : "Open"}</span>}
            flush
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Option</TableHead>
                  <TableHead>Can make it</TableHead>
                  <TableHead>Favorites</TableHead>
                  <TableHead>Missing</TableHead>
                  <TableHead><span className="sched-sr">Finalize</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allOptions.map((option) => {
                  const canMake = responses.filter((response) => response.available.includes(option.id))
                  const missing = CRAFT_NIGHT_ROSTER.filter((member) => {
                    const response = responseByEmail.get(member.email)
                    return !response || !response.available.includes(option.id)
                  })
                  const isFinal = poll.finalOptionId === option.id
                  return (
                    <TableRow key={option.id} data-final={isFinal || undefined}>
                      <TableCell>
                        {option.weekday}, {option.month} {option.day}
                        <span className="craftadmin__time">{option.time}</span>
                      </TableCell>
                      <TableCell>{canMake.length} of {CRAFT_NIGHT_ROSTER.length}</TableCell>
                      <TableCell>
                        {responses.filter((response) => response.favorite === option.id).length || "0"}
                      </TableCell>
                      <TableCell className="craftadmin__missing">
                        {missing.length === 0 ? "Nobody" : missing.map((member) => member.name.split(" ")[0]).join(", ")}
                      </TableCell>
                      <TableCell className="craftadmin__cell-action">
                        {isFinal ? (
                          <span className="sched-chip" data-tone="responded">Locked in</span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => act({ action: "set-final", optionId: option.id })}
                          >
                            Lock in
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </LeadershipSection>

          <LeadershipSection
            title="Responses"
            action={<span className="craftadmin__count">{responses.length} of {CRAFT_NIGHT_ROSTER.length}</span>}
            flush
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Times</TableHead>
                  <TableHead><span className="sched-sr">Clear</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CRAFT_NIGHT_ROSTER.map((member) => {
                  const response = responseByEmail.get(member.email)
                  return (
                    <TableRow key={member.email}>
                      <TableCell>{member.name}</TableCell>
                      <TableCell className="craftadmin__times">
                        {!response ? (
                          <span className="sched-chip" data-tone="open">Waiting</span>
                        ) : response.available.length === 0 ? (
                          "None of the options"
                        ) : (
                          response.available
                            .map((id) => (id === response.favorite ? `★ ${shortLabel(id)}` : shortLabel(id)))
                            .join(", ")
                        )}
                        {response?.note ? (
                          <span className="craftadmin__note">{response.note}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="craftadmin__cell-action">
                        {response ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={busy}
                            aria-label={`Clear ${member.name}'s response`}
                            onClick={() => act({ action: "clear-response", email: member.email })}
                          >
                            <Trash2 />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </LeadershipSection>

          <p className="craftadmin__footnote">
            The public link needs no sign in: {PUBLIC_URL}. {CRAFT_NIGHT.description}
          </p>
        </>
      ) : null}
    </LeadershipPage>
  )
}

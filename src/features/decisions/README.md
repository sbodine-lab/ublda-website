# Decision Center frontend

`DecisionCenterRoutes` owns the standalone `/decisions/*` workspace and `/d/:slug` ballot routes. It expects to run inside the app's existing `BrowserRouter` and a `DecisionDataProvider`:

```tsx
<DecisionDataProvider adapter={decisionAdapter}>
  <DecisionCenterRoutes />
</DecisionDataProvider>
```

The default adapter is an in-memory, fictional preview. It is intentionally signed out on first load so the generic private gate can be tested without Clerk or Convex credentials. Production integration should explicitly pass a live adapter; if live configuration is incomplete, use `createUnavailableLiveDecisionAdapter(...)` so the feature fails closed instead of loading demo data.

## Live adapter requirements

- Do not fetch a decision title, overview, electorate, or responses until the viewer is authenticated and authorized.
- Map all approved verified-email identities to one roster member before accepting a ballot. Enforce one response per `(decisionId, memberId)` on the server.
- Return named missing responders, individual answers, and rationale only to the decision creator or an admin. Non-managers receive aggregate counts only when the decision's result-visibility rule allows it.
- Return roster-management data only to admins. Agent keys are member-owned: list and revoke only the current member's keys.
- Enforce the decision state machine on the server: Draft → Open → Closed → Finalized. Reopen is Closed → Open. Finalization is never inferred from counts.
- Lock options, electorate, and counting rules once the first ballot is accepted. Material revisions require voter reconfirmation.
- Issue agent secrets server-side, store only a hash and displayable prefix, and show the raw token exactly once.

The UI uses one explicit counting rule per decision: advisory, plurality, majority, approval threshold, or Borda. Borda awards `N` points for first place through `1` point for last place. Minimum turnout remains a separate rule.

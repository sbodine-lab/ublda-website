import assert from "node:assert/strict";
import test from "node:test";
import {
  stableJson,
  timingSafeSecretEqual,
  tokenPrefix,
  validGatewaySecret,
} from "../convex/lib/crypto.ts";
import { tallyOptions } from "../convex/lib/tally.ts";
import { decisionUpdateViolation } from "../convex/lib/updatePolicy.ts";
import { planIdentityAliasSync } from "../convex/lib/identityPolicy.ts";
import { decisionPublicSlug } from "../convex/lib/publicIds.ts";
import { availabilityPublicSlug } from "../convex/lib/publicIds.ts";
import {
  availabilityResults,
  normalizeAvailabilitySlots,
  slotKey,
} from "../convex/lib/availability.ts";
import {
  canonicalDecisionTimeZone,
  DEFAULT_DECISION_TIME_ZONE,
  MAX_DECISION_TIME_ZONE_LENGTH,
} from "../convex/lib/timezones.ts";

test("new decision links use only the opaque server-generated document ID", () => {
  const documentId = "j57d3f1mqb8k0vp2rc6sz4tn9xwyhae";
  const slug = decisionPublicSlug(documentId);
  assert.equal(slug, `d_${documentId}`);
  assert.match(slug, /^d_[a-z0-9]+$/);
  assert.equal(slug.includes("private-board-topic"), false);
});

test("scheduling links are opaque and never expose the poll title", () => {
  const documentId = "j57d3f1mqb8k0vp2rc6sz4tn9xwyhae";
  const slug = availabilityPublicSlug(documentId);
  assert.equal(slug, `s_${documentId}`);
  assert.equal(slug.includes("fall-kickoff"), false);
});

test("availability slots are bounded, deduplicated, and sorted", () => {
  const shape = {
    dateKeys: ["2026-08-18", "2026-08-19"],
    startMinutes: 17 * 60,
    endMinutes: 19 * 60,
    durationMinutes: 45,
  };
  assert.deepEqual(
    normalizeAvailabilitySlots(shape, [
      slotKey("2026-08-19", 17 * 60 + 15),
      slotKey("2026-08-18", 17 * 60),
      slotKey("2026-08-18", 17 * 60),
      slotKey("2026-08-20", 17 * 60),
      slotKey("2026-08-18", 16 * 60),
    ]),
    ["2026-08-18@1020", "2026-08-19@1035"],
  );
});

test("best times require every 15-minute slot in the meeting duration", () => {
  const shape = {
    dateKeys: ["2026-08-18"],
    startMinutes: 17 * 60,
    endMinutes: 18 * 60 + 15,
    durationMinutes: 45,
  };
  const result = availabilityResults(shape, [
    {
      memberId: "member-a",
      availableSlotKeys: [1020, 1035, 1050, 1065].map((minute) => slotKey("2026-08-18", minute)),
    },
    {
      memberId: "member-b",
      availableSlotKeys: [1035, 1050, 1065].map((minute) => slotKey("2026-08-18", minute)),
    },
  ]);
  assert.deepEqual(result.candidates.slice(0, 2), [
    {
      dateKey: "2026-08-18",
      startMinutes: 1035,
      endMinutes: 1080,
      availableCount: 2,
      availableMemberIds: ["member-a", "member-b"],
    },
    {
      dateKey: "2026-08-18",
      startMinutes: 1020,
      endMinutes: 1065,
      availableCount: 1,
      availableMemberIds: ["member-a"],
    },
  ]);
});

test("decision time zones default and normalize to canonical IANA identifiers", () => {
  assert.equal(canonicalDecisionTimeZone(undefined), DEFAULT_DECISION_TIME_ZONE);
  assert.equal(
    canonicalDecisionTimeZone("  America/Detroit  "),
    "America/Detroit",
  );
  assert.equal(canonicalDecisionTimeZone("UTC"), "UTC");
});

test("decision time zones reject aliases, case variants, misspellings, and overflow", () => {
  assert.equal(canonicalDecisionTimeZone("US/Eastern"), null);
  assert.equal(canonicalDecisionTimeZone("america/detroit"), null);
  assert.equal(canonicalDecisionTimeZone("Mars/Olympus"), null);
  assert.equal(canonicalDecisionTimeZone("x".repeat(MAX_DECISION_TIME_ZONE_LENGTH + 1)), null);
});

test("member alias sync is exact and re-enables disabled aliases as pending", () => {
  assert.deepEqual(
    planIdentityAliasSync(
      [
        { email: "keep@example.com", status: "verified" },
        { email: "remove@example.com", status: "pending" },
        { email: "restore@example.com", status: "disabled" },
      ],
      ["keep@example.com", "restore@example.com", "new@example.com"],
      false,
    ),
    {
      add: ["new@example.com"],
      reenable: ["restore@example.com"],
      disable: ["remove@example.com"],
      selfLockout: false,
    },
  );
});

test("member alias sync blocks removal of the actor's last verified identity", () => {
  const plan = planIdentityAliasSync(
    [
      { email: "current@example.com", status: "verified" },
      { email: "future@example.com", status: "pending" },
    ],
    ["future@example.com"],
    true,
  );
  assert.equal(plan.selfLockout, true);
  assert.deepEqual(plan.disable, ["current@example.com"]);
});

test("aggregate-only ballots cannot be deanonymized after voting starts", () => {
  assert.match(
    decisionUpdateViolation({
      status: "open",
      hasBallots: true,
      hasContentChange: false,
      currentResponsePrivacy: "aggregate_only",
      nextResponsePrivacy: "admins_can_view_individual",
    }) ?? "",
    /cannot expose named responses/i,
  );
  assert.equal(
    decisionUpdateViolation({
      status: "open",
      hasBallots: true,
      hasContentChange: false,
      currentResponsePrivacy: "admins_can_view_individual",
      nextResponsePrivacy: "aggregate_only",
    }),
    null,
  );
});

test("results visibility can tighten but cannot loosen after voting starts", () => {
  assert.match(
    decisionUpdateViolation({
      status: "open",
      hasBallots: true,
      hasContentChange: false,
      currentResponsePrivacy: "admins_can_view_individual",
      currentResultsVisibility: "after_close",
      nextResultsVisibility: "after_submit",
    }) ?? "",
    /cannot be loosened/i,
  );
  assert.equal(
    decisionUpdateViolation({
      status: "open",
      hasBallots: true,
      hasContentChange: false,
      currentResponsePrivacy: "admins_can_view_individual",
      currentResultsVisibility: "after_close",
      nextResultsVisibility: "admins_only",
    }),
    null,
  );
});

test("closed decisions must reopen before material edits", () => {
  assert.match(
    decisionUpdateViolation({
      status: "closed",
      hasBallots: true,
      hasContentChange: true,
      currentResponsePrivacy: "admins_can_view_individual",
    }) ?? "",
    /reopen/i,
  );
});

test("ranked tallies count first choices without manufacturing a tie", () => {
  const options = ["a", "b", "c"].map((optionId) => ({ optionId }));
  const result = tallyOptions("ranked_choice", options, [
    {
      selections: [
        { optionId: "a", rank: 1 },
        { optionId: "b", rank: 2 },
        { optionId: "c", rank: 3 },
      ],
    },
    {
      selections: [
        { optionId: "a", rank: 1 },
        { optionId: "c", rank: 2 },
        { optionId: "b", rank: 3 },
      ],
    },
    {
      selections: [
        { optionId: "b", rank: 1 },
        { optionId: "c", rank: 2 },
        { optionId: "a", rank: 3 },
      ],
    },
  ]);
  assert.deepEqual(result, [
    { optionId: "a", count: 2, score: 7 },
    { optionId: "b", count: 1, score: 6 },
    { optionId: "c", count: 0, score: 5 },
  ]);
});

test("single-choice tallies count only selected options", () => {
  assert.deepEqual(
    tallyOptions(
      "single_choice",
      [{ optionId: "yes" }, { optionId: "no" }],
      [
        { selections: [{ optionId: "yes" }] },
        { selections: [{ optionId: "yes" }] },
        { selections: [{ optionId: "no" }] },
      ],
    ),
    [
      { optionId: "yes", count: 2, score: 0 },
      { optionId: "no", count: 1, score: 0 },
    ],
  );
});

test("agent token parsing and idempotency serialization are stable", () => {
  const token = "ublda_dc_abcdefghijkl_abcdefghijklmnopqrstuvwxyz123456";
  assert.equal(tokenPrefix(token), "abcdefghijkl");
  assert.equal(tokenPrefix("not-a-token"), null);
  assert.equal(
    stableJson({ z: 1, nested: { b: 2, a: 1 }, a: [2, 1] }),
    stableJson({ a: [2, 1], nested: { a: 1, b: 2 }, z: 1 }),
  );
});

test("gateway secret comparison fails closed and accepts only an exact secret", async () => {
  const secret = "a-high-entropy-gateway-secret-value-123456";
  assert.equal(await timingSafeSecretEqual(undefined, secret), false);
  assert.equal(await timingSafeSecretEqual("wrong-secret", secret), false);
  assert.equal(await timingSafeSecretEqual(secret, secret), true);
  assert.equal(validGatewaySecret(secret), true);
  assert.equal(validGatewaySecret(" short secret "), false);
  assert.equal(validGatewaySecret(`${secret}\n`), false);
});

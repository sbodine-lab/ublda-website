import { v } from "convex/values";
import { mutation, query } from "./lib/server";
import { applicationRoleInterest } from "./schema";
import { requireAdmin, requireMember } from "./lib/auth";
import { fail } from "./lib/errors";

/* Consulting-program applications. Submissions arrive from the public
   /apply page through api/apply.ts, which runs the honeypot and first-pass
   validation; the caps below are re-checked here so a direct client call
   cannot bypass them. Keep the limits in sync with src/lib/applyForm.ts. */

const CURRENT_TERM = "fall-2026";

// Same window as src/lib/applyForm.ts; re-checked here so a direct client
// call cannot submit outside it. Open Sep 9 12:00 AM ET, grace to Sep 21 4 AM ET.
const OPENS_AT_MS = Date.UTC(2026, 8, 2, 16, 0, 0); // Sep 2, 12:00 PM ET
const CLOSES_AT_MS = Date.UTC(2026, 8, 21, 3, 59, 0); // Sep 20, 11:59 PM ET (grace past the 11:30 label)

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_SCHOOL_MAJOR = 160;
const MAX_ESSAY = 2000;
const MAX_RESUME_URL = 600;
const MAX_ACCOMMODATIONS = 2000;
const MAX_SUBMISSIONS_PER_EMAIL = 5;

const YEARS = new Set(["Freshman", "Sophomore", "Junior", "Senior"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (value: string) => value.replace(/[<>]/g, "").trim();

export const submit = mutation({
  args: {
    fullName: v.string(),
    email: v.string(),
    year: v.string(),
    schoolMajor: v.string(),
    roleInterest: applicationRoleInterest,
    whyJoin: v.string(),
    experience: v.string(),
    resumeUrl: v.optional(v.string()),
    availabilityConfirmed: v.boolean(),
    accommodations: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    if (now < OPENS_AT_MS) {
      fail("VALIDATION_ERROR", "Applications open September 2 at noon.");
    }
    if (now >= CLOSES_AT_MS) {
      fail("VALIDATION_ERROR", "Applications closed September 20.");
    }

    const fullName = clean(args.fullName);
    const email = clean(args.email).toLowerCase();
    const year = clean(args.year);
    const schoolMajor = clean(args.schoolMajor);
    const whyJoin = clean(args.whyJoin);
    const experience = clean(args.experience);
    const resumeUrl = args.resumeUrl ? args.resumeUrl.trim() : undefined;
    const accommodations = args.accommodations
      ? clean(args.accommodations)
      : undefined;

    if (!fullName || fullName.length > MAX_NAME) {
      fail("VALIDATION_ERROR", "Please provide your full name.");
    }
    if (
      !email ||
      email.length > MAX_EMAIL ||
      !emailPattern.test(email)
    ) {
      fail("VALIDATION_ERROR", "Please provide a valid email address.");
    }
    if (!YEARS.has(year)) {
      fail("VALIDATION_ERROR", "Please choose your year.");
    }
    if (!schoolMajor || schoolMajor.length > MAX_SCHOOL_MAJOR) {
      fail("VALIDATION_ERROR", "Please tell us your school and major.");
    }
    if (!whyJoin || whyJoin.length > MAX_ESSAY) {
      fail("VALIDATION_ERROR", "Please tell us why you want to join (about 150 words).");
    }
    if (!experience || experience.length > MAX_ESSAY) {
      fail("VALIDATION_ERROR", "Please tell us about your experience (about 150 words).");
    }
    if (resumeUrl) {
      if (resumeUrl.length > MAX_RESUME_URL || !/^https?:\/\/\S+$/i.test(resumeUrl)) {
        fail("VALIDATION_ERROR", "The resume link should be a full http(s) URL.");
      }
    }
    if (!args.availabilityConfirmed) {
      fail(
        "VALIDATION_ERROR",
        "Please confirm your interview and weekly availability.",
      );
    }
    if (accommodations && accommodations.length > MAX_ACCOMMODATIONS) {
      fail("VALIDATION_ERROR", "The accommodations note is too long.");
    }

    const previous = await ctx.db
      .query("consultingApplications")
      .withIndex("by_term_and_email", (q) =>
        q.eq("term", CURRENT_TERM).eq("email", email),
      )
      .collect();
    if (previous.length >= MAX_SUBMISSIONS_PER_EMAIL) {
      fail(
        "RATE_LIMITED",
        "We already have several submissions from this email. Email sbodine@umich.edu to update your application.",
      );
    }

    await ctx.db.insert("consultingApplications", {
      term: CURRENT_TERM,
      fullName,
      email,
      year,
      schoolMajor,
      roleInterest: args.roleInterest,
      whyJoin,
      experience,
      resumeUrl,
      availabilityConfirmed: true,
      accommodations,
      submittedAt: Date.now(),
    });

    return { ok: true, resubmission: previous.length > 0 };
  },
});

/* Admin-only readback so leadership can review applications from the
   workspace or a script without opening the Convex dashboard. */
export const listForTerm = query({
  args: { term: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    requireAdmin(actor);
    const term = args.term ?? CURRENT_TERM;
    return await ctx.db
      .query("consultingApplications")
      .withIndex("by_term", (q) => q.eq("term", term))
      .order("desc")
      .collect();
  },
});

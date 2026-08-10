import { cronJobs, makeFunctionReference } from "convex/server";

const crons = cronJobs();
const autoCloseDue = makeFunctionReference<"mutation", Record<string, never>, { closed: number }>(
  "maintenance:autoCloseDue",
);

// 8,640 checks in a 30-day month, comfortably within Convex Free for this club.
crons.interval("close due decisions", { minutes: 5 }, autoCloseDue, {});

export default crons;

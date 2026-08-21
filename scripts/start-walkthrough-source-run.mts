/**
 * Starts one research-only Capital run after current session conditions and
 * paper-account context are refreshed. It never reaches proposal, approval,
 * submission, or broker-order code. Capture remains a separate, explicit step.
 */
import { startScheduledCapitalResearch } from "../server/apertureRouter";

const targetAt = Date.now();
const result = await startScheduledCapitalResearch({
  userId: 1,
  canonicalThesisId: 420001,
  targetAt,
});
console.log(JSON.stringify({ kind: "research_only", targetAt, ...result }, null, 2));

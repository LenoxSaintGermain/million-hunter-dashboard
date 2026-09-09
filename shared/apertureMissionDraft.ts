import { z } from "zod";

const id = z.number().int().positive().nullable();
const horizon = z.enum(["intraday", "overnight", "swing", "catalyst_window", "position"]);
const text = z.string().max(30_000);

/** An unfinished form, not a qualified Mission or permission to run analysis. */
export const missionDraftValuesSchema = z.object({
  schemaVersion: z.literal(1),
  canonicalThesisId: id,
  accountId: id,
  baseDecisionRunId: id,
  baseDecisionRevisionId: id,
  activeSection: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  capital: z.string().max(80),
  maxLoss: z.string().max(80),
  targetProfit: z.string().max(80),
  targetPeriod: z.enum(["session", "week", "month"]),
  holdingPeriod: horizon,
  holdingPeriods: z.array(horizon).max(5),
  objective: z.enum(["best_qualified_play", "deploy_today", "verify_catalyst", "portfolio_gap", "preserve_optionality"]),
  instrument: z.enum(["shares", "options", "either"]),
  includeHeld: z.boolean(),
  mission: text,
  missionDirty: z.boolean(),
  editingMission: z.boolean(),
  showTune: z.boolean(),
  branch: z.enum(["research", "conditional", "cash"]),
  reason: text,
  blocker: text,
  reopen: text,
  gateLabel: z.string().max(500),
  newTitle: z.string().max(500),
  newBelief: text,
  declaredCatalystAt: z.number().int().nonnegative().nullable(),
  declaredCatalystLabel: z.string().max(2000).nullable(),
  eligibilityReviewAt: z.string().max(80),
  outcomeReviewAtInput: z.string().max(80),
  revisingReceipt: z.boolean(),
  underwritingDirty: z.boolean(),
}).strict().refine((value) => (value.baseDecisionRunId == null) === (value.baseDecisionRevisionId == null), {
  message: "A draft must retain both base Mission identities or neither.",
  path: ["baseDecisionRevisionId"],
});

export type MissionDraftValues = z.infer<typeof missionDraftValuesSchema>;
export type MissionSection = 1 | 2 | 3;
export function replacePrimaryMissionHorizon(previous: MissionDraftValues["holdingPeriod"], next: MissionDraftValues["holdingPeriod"], underwriting: readonly MissionDraftValues["holdingPeriod"][]) {
  return Array.from(new Set([next, ...underwriting.filter((period) => period !== previous)]));
}
export function validMissionHorizonCollection(value: unknown): value is MissionDraftValues["holdingPeriods"] {
  return Array.isArray(value) && value.length > 0 && value.length <= 5 && value.every((item) => horizon.safeParse(item).success);
}
export function validReceiptHorizonShape(value: { holdingPeriod?: unknown; holdingPeriods?: unknown }) {
  return horizon.safeParse(value.holdingPeriod).success
    && (value.holdingPeriods == null || validMissionHorizonCollection(value.holdingPeriods));
}
export function initialMissionSection(input: { hasThesis: boolean; capitalCents: number; maxLossCents: number }): MissionSection {
  return !input.hasThesis ? 1 : input.capitalCents <= 0 || input.maxLossCents <= 0 ? 2 : 3;
}
export function missionSectionReducer(current: MissionSection, event: { type: "input_changed" } | { type: "hydrate" | "choose"; section: MissionSection }): MissionSection {
  return event.type === "input_changed" ? current : event.section;
}
export type MissionDraftRecord = {
  id: number;
  version: number;
  values: MissionDraftValues;
  updatedAt: number;
  completedAt: number | null;
};

export function emptyMissionDraftValues(): MissionDraftValues {
  return {
    schemaVersion: 1, canonicalThesisId: null, accountId: null,
    baseDecisionRunId: null, baseDecisionRevisionId: null, activeSection: 1,
    capital: "", maxLoss: "", targetProfit: "", targetPeriod: "week",
    holdingPeriod: "intraday", holdingPeriods: ["intraday"], objective: "deploy_today",
    instrument: "shares", includeHeld: false, mission: "", missionDirty: false,
    editingMission: false, showTune: false, branch: "research", reason: "", blocker: "",
    reopen: "", gateLabel: "", newTitle: "", newBelief: "", declaredCatalystAt: null,
    declaredCatalystLabel: null, eligibilityReviewAt: "", outcomeReviewAtInput: "",
    revisingReceipt: false, underwritingDirty: false,
  };
}

/** Schema ordering makes equality independent of JSON object insertion order. */
export function missionDraftFingerprint(values: MissionDraftValues) {
  // Equality also runs while the user is typing. Validate at the save boundary,
  // not during rendering (an oversized unfinished field must not crash the UI).
  return JSON.stringify(Object.fromEntries((Object.keys(emptyMissionDraftValues()) as (keyof MissionDraftValues)[]).map((key) => [key, values[key]])));
}

export function missionDraftSaveState(input: {
  initialized: boolean;
  values: MissionDraftValues;
  saved: MissionDraftRecord | null;
  saving: boolean;
  error: string | null;
}): "loading" | "saving" | "saved" | "unsaved" | "failed" {
  if (!input.initialized) return "loading";
  if (input.error) return "failed";
  if (input.saving) return "saving";
  return input.saved?.completedAt == null && input.saved != null
    && missionDraftFingerprint(input.values) === missionDraftFingerprint(input.saved.values)
    ? "saved" : "unsaved";
}

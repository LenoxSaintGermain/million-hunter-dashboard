import type { MonitoringReviewDecision } from "./monitoringFinding";

/** Draft language only: these are operator assessments, never generated evidence. */
export const monitoringReviewPresets: Record<MonitoringReviewDecision, readonly { label: string; note: string }[]> = {
  resolved: [
    { label: "No further follow-up", note: "I reviewed this version and need no further follow-up." },
    { label: "Not relevant to my play", note: "In my assessment, this finding does not change my reason for this play." },
  ],
  reviewed_unresolved: [
    { label: "Keep watching", note: "Keep this open. I will reassess when the recorded condition changes." },
    { label: "Need more context", note: "I need more context to judge the impact on my play. Keep this open." },
  ],
  needs_fresh_evidence: [
    { label: "Evidence is too old", note: "The evidence is too old to rely on. Keep this open pending updated checks." },
    { label: "Need a source", note: "I need current, source-backed evidence to assess this. Keep it open." },
  ],
};

export function isPresetReviewNote(note: string): boolean {
  return Object.values(monitoringReviewPresets).some(presets => presets.some(preset => preset.note === note));
}

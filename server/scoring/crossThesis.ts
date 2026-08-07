/**
 * Cross-thesis matching.
 *
 * The single most useful thing to come out of the Wingate call: a building that
 * FAILS one client's thesis is often exactly right for another's. Chad's own
 * criteria are narrow — pre-1945, four storeys, tripling path — but he has
 * clients who want the six-storey building, or the 1952 one, or a different
 * geography. Archiving those assets throws away his best cross-sell.
 *
 * So every asset is scored against the primary thesis AND every active variant.
 * The result says: which theses it fits, which it fails, and why. An asset that
 * fails primary but fits a variant is a MATCH, not a rejection.
 */
import { scoreHistoricAsset, type ThesisOverrides, type HistoricScore } from "./historicScore";
import { scoreAssetByClass } from "./index";
import { getAssetClass } from "../../shared/assetClasses";

export interface ThesisDef {
  id: number | null;              // null = the class's primary/default thesis
  name: string;
  clientLabel?: string | null;
  assetClass: string;
  overrides: ThesisOverrides;
  isPrimary: boolean;
  assignedUserId?: number | null;
}

export interface ThesisFit {
  thesisId: number | null;
  thesisName: string;
  clientLabel?: string | null;
  fits: boolean;
  tier: HistoricScore["assetTier"];
  compositeScore: number;
  rankScore: number;
  /** Why it failed, when it did. */
  reason: string | null;
  assignedUserId?: number | null;
}

/** A thesis "fits" when the asset isn't hard-stopped or archived by it. */
function fitFromScore(score: { hardStopFailed: string | null; assetTier: string; compositeScore: number }): { fits: boolean; reason: string | null } {
  if (score.hardStopFailed) return { fits: false, reason: score.hardStopFailed };
  if (score.assetTier === "archive") {
    return { fits: false, reason: `Composite ${score.compositeScore} below this thesis's floor` };
  }
  return { fits: true, reason: null };
}

/**
 * Score one asset against a set of theses.
 * Only the historic scorer is parameterised today; other classes fall back to
 * their own scorer and report a single primary fit rather than pretending to
 * support variants they cannot yet express.
 */
export function evaluateAcrossTheses(asset: Record<string, any>, theses: ThesisDef[]): ThesisFit[] {
  const cls = getAssetClass(asset.assetClass);
  const relevant = theses.filter((t) => t.assetClass === cls.id);

  if (cls.scorer !== "historic") {
    const score = scoreAssetByClass(asset as any) as unknown as HistoricScore;
    const { fits, reason } = fitFromScore(score);
    return [{
      thesisId: null,
      thesisName: `${cls.label} (default)`,
      clientLabel: null,
      assignedUserId: null,
      fits, reason,
      tier: score.assetTier,
      compositeScore: score.compositeScore,
      rankScore: score.rankScore,
    }];
  }

  return relevant.map((t) => {
    const score = scoreHistoricAsset(asset as any, t.overrides);
    const { fits, reason } = fitFromScore(score);
    return {
      thesisId: t.id,
      thesisName: t.name,
      clientLabel: t.clientLabel ?? null,
      assignedUserId: t.assignedUserId ?? null,
      fits,
      reason,
      tier: score.assetTier,
      compositeScore: score.compositeScore,
      rankScore: score.rankScore,
    };
  });
}

/**
 * The headline the UI needs: does this asset fail the thesis you're looking at
 * but fit another one? That's the cross-sell signal.
 */
export function crossThesisSummary(fits: ThesisFit[], activeThesisId: number | null) {
  const active = fits.find((f) => f.thesisId === activeThesisId) ?? fits.find((f) => f.thesisId === null);
  const others = fits.filter((f) => f !== active);
  const alternateFits = others.filter((f) => f.fits);
  return {
    activeFits: active?.fits ?? false,
    activeReason: active?.reason ?? null,
    /** Non-empty when the asset is a variant-thesis match. */
    alternateFits,
    isVariantMatch: !(active?.fits ?? false) && alternateFits.length > 0,
  };
}

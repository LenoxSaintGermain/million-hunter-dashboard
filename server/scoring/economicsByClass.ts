/**
 * Economics dispatcher — the registry gap that blocked a second asset class.
 *
 * `computeEconomics` was called only when assetClass === "historic", so any new
 * class silently got no economics module at all. Now each class names its model
 * here, exactly as `scoreAssetByClass` does for scoring.
 */
import type { DealEconomics } from "./economics";
import { computeEconomics } from "./economics";
import { computeStorageEconomics } from "./storageEconomics";
import { getAssetClass } from "../../shared/assetClasses";

export function computeEconomicsByClass(asset: Record<string, any>): DealEconomics | null {
  const cls = getAssetClass(asset.assetClass);
  // A class only gets economics if it declares the module.
  if (!cls.analysisModules.includes("economics")) return null;

  switch (cls.id) {
    case "historic":     return computeEconomics(asset as any);
    case "self_storage": return computeStorageEconomics(asset);
    default:             return null;
  }
}

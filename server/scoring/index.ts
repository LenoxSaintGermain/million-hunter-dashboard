/** Score-dispatch: route an asset to its class's scorer (historic = bespoke A–G,
 *  everything else = the config-driven generic engine). Both return the same shape. */
import { getAssetClass } from "../../shared/assetClasses";
import { scoreHistoricAsset } from "./historicScore";
import { scoreGenericAsset } from "./genericScore";

export function scoreAssetByClass(asset: any) {
  const cls = getAssetClass(asset?.assetClass);
  if (cls.scorer === "historic") return scoreHistoricAsset(asset);
  return scoreGenericAsset(cls, asset);
}

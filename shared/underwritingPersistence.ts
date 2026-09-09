import { z } from "zod";
import { parsePersistedJson } from "./persistedJson";

const periods = z.array(z.enum(["intraday", "overnight", "swing", "catalyst_window", "position"])).min(1).max(5);
export function decodeHoldingPeriods(value: unknown) {
  return periods.parse(parsePersistedJson(value));
}

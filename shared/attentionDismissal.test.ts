import { describe, expect, it } from "vitest";
import { isDismissed, partitionDismissed, recordDismissal, restoreDismissal, parseDismissals, MAX_DISMISSALS } from "./attentionDismissal";

const at = Date.UTC(2026, 8, 11, 14);
const d = (key: string, fingerprint: string) => ({ key, fingerprint, dismissedAt: at });

describe("a dismissal quiets a handled item and nothing more", () => {
  it("hides the exact item at the exact state it was handled in", () => {
    expect(isDismissed({ key: "review:17" }, "fp-a", [d("review:17", "fp-a")])).toBe(true);
  });

  it("brings the item back the moment its state changes", () => {
    // New evidence, a new check, a changed deadline — all change the fingerprint.
    expect(isDismissed({ key: "review:17" }, "fp-b", [d("review:17", "fp-a")])).toBe(false);
  });

  it("never hides an item that has no fingerprint to match on", () => {
    expect(isDismissed({ key: "review:17" }, undefined, [d("review:17", "fp-a")])).toBe(false);
  });

  it("does not hide a different item that was handled", () => {
    expect(isDismissed({ key: "finding:2" }, "fp-a", [d("review:17", "fp-a")])).toBe(false);
  });
});

describe("partitioning keeps the dismissed set recoverable", () => {
  const fps = new Map([["a", "fp1"], ["b", "fp2"], ["c", "fp3"]]);
  const items = [{ key: "a" }, { key: "b" }, { key: "c" }];

  it("splits rather than drops, so nothing is lost from the view", () => {
    const r = partitionDismissed(items, fps, [d("b", "fp2")]);
    expect(r.visible.map(i => i.key)).toEqual(["a", "c"]);
    expect(r.dismissed.map(i => i.key)).toEqual(["b"]);
  });

  it("keeps everything visible when nothing is dismissed", () => {
    expect(partitionDismissed(items, fps, []).visible).toHaveLength(3);
  });
});

describe("the dismissal store is bounded and defensive", () => {
  it("replaces an earlier dismissal of the same key rather than stacking", () => {
    const next = recordDismissal([d("a", "old")], d("a", "new"));
    expect(next).toHaveLength(1);
    expect(next[0].fingerprint).toBe("new");
  });

  it("caps growth on a shared device", () => {
    let list = Array.from({ length: MAX_DISMISSALS }, (_, i) => d(`k${i}`, "f"));
    list = recordDismissal(list, d("newest", "f"));
    expect(list).toHaveLength(MAX_DISMISSALS);
    expect(list[0].key).toBe("newest");
  });

  it("restores a single item by key", () => {
    expect(restoreDismissal([d("a", "f"), d("b", "f")], "a").map(e => e.key)).toEqual(["b"]);
  });

  it("survives corrupt or hand-edited storage without breaking Today", () => {
    expect(parseDismissals(null)).toEqual([]);
    expect(parseDismissals("not json")).toEqual([]);
    expect(parseDismissals('{"key":"a"}')).toEqual([]);
    expect(parseDismissals('[{"key":"a"},{"key":"b","fingerprint":"f","dismissedAt":1}]')).toHaveLength(1);
  });
});

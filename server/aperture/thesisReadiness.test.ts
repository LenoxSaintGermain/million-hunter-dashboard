import { describe, expect, it, vi } from "vitest";
import { ensureThesisReady } from "./thesisReadiness";

const graph = { beliefs: ["AI demand persists"], confidenceNotes: ["Evidence quality reviewed"] };

describe("ensureThesisReady", () => {
  it("keeps an already-ready thesis immediate without recompiling it", async () => {
    const compile = vi.fn();
    const persist = vi.fn();
    const thesis = { id: 1, rawText: "AI infrastructure remains a multi-year capital cycle.", graph, confidenceNotes: graph.confidenceNotes };

    await expect(ensureThesisReady(thesis, { compile, persist })).resolves.toEqual(thesis);
    expect(compile).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("prepares and persists an uncompiled saved belief when it is used for a brief", async () => {
    const compile = vi.fn().mockResolvedValue(graph);
    const persist = vi.fn().mockResolvedValue(undefined);
    const thesis = { id: 2, rawText: "AI infrastructure remains a multi-year capital cycle.", graph: null, confidenceNotes: null };

    const result = await ensureThesisReady(thesis, { compile, persist });

    expect(compile).toHaveBeenCalledWith(thesis.rawText);
    expect(persist).toHaveBeenCalledWith({ graph, confidenceNotes: graph.confidenceNotes });
    expect(result.graph).toEqual(graph);
  });

  it("preserves the compiler error so the caller can give the operator a plain-language repair", async () => {
    const compile = vi.fn().mockRejectedValue(new Error("Describe the belief and horizon."));
    const persist = vi.fn();
    const thesis = { id: 3, rawText: "Too short", graph: null, confidenceNotes: null };

    await expect(ensureThesisReady(thesis, { compile, persist })).rejects.toThrow("Describe the belief and horizon.");
    expect(persist).not.toHaveBeenCalled();
  });
});

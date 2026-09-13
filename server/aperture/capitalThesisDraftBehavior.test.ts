import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapitalThesisWorkspace, thesisDraftValidation } from "../../client/src/components/aperture/CapitalThesisWorkspace";

// A hook-state harness exercises the actual component handlers without a browser,
// providers, or a database. It does not claim DOM focus/accessibility coverage.
const fixture = vi.hoisted(() => ({
  states: [] as any[], cursor: 0, effectCursor: 0, deps: [] as any[], effects: [] as Array<() => void>,
  search: "", theses: [] as any[], create: vi.fn(), activate: vi.fn(), project: vi.fn(), navigate: vi.fn(), invalidate: vi.fn(),
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return { ...actual,
    useState: (initial: any) => {
      const index = fixture.cursor++;
      if (!(index in fixture.states)) fixture.states[index] = typeof initial === "function" ? initial() : initial;
      return [fixture.states[index], (next: any) => { fixture.states[index] = typeof next === "function" ? next(fixture.states[index]) : next; }];
    },
    useMemo: (compute: () => unknown) => compute(),
    useEffect: (effect: () => void, deps: any[]) => {
      const index = fixture.effectCursor++;
      if (!fixture.deps[index] || deps.some((value, i) => value !== fixture.deps[index][i])) { fixture.deps[index] = deps; fixture.effects.push(effect); }
    },
  };
});
vi.mock("wouter", () => ({ useLocation: () => ["/thesis", fixture.navigate], useSearch: () => fixture.search }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ thesis: { list: { invalidate: fixture.invalidate }, activeCapital: { invalidate: fixture.invalidate } }, aperture: { thesis: { list: { invalidate: fixture.invalidate } }, runway: { latest: { invalidate: fixture.invalidate } } } }),
  thesis: { list: { useQuery: () => ({ data: fixture.theses, isLoading: false }) },
    createCapital: { useMutation: () => ({ mutateAsync: fixture.create, isPending: false }) },
    setActiveCapital: { useMutation: () => ({ mutateAsync: fixture.activate, isPending: false }) },
    useInAperture: { useMutation: () => ({ mutateAsync: fixture.project, isPending: false }) },
  },
} }));

function elements(node: React.ReactNode): React.ReactElement<any>[] {
  return React.Children.toArray(node).flatMap((child) => React.isValidElement<{ children?: React.ReactNode }>(child) ? [child, ...elements(child.props.children)] : []);
}
function text(node: React.ReactNode): string {
  return React.Children.toArray(node).map((child) => React.isValidElement<{ children?: React.ReactNode }>(child) ? text(child.props.children) : String(child)).join("");
}
function render() {
  fixture.cursor = 0; fixture.effectCursor = 0;
  const tree = CapitalThesisWorkspace();
  if (fixture.effects.length) { const effects = fixture.effects.splice(0); effects.forEach((effect) => effect()); return render(); }
  return tree;
}
function input(tree: React.ReactNode, label: string) { return elements(tree).find((element) => element.props["aria-label"] === label)!; }
function button(tree: React.ReactNode, label: string) { return elements(tree).find((element) => element.props.onClick && text(element.props.children) === label)!; }
const saved = { id: 720001, name: "Saved illustrative belief", thesisText: "Operator-authored belief with evidence and invalidation, preserved verbatim.", templateUsed: "capital_trade", compiledFilters: { capitalTradeDetails: { belief: "Saved detail" } }, isActiveCapital: true };

describe("new thesis defaults and preserved drafts", () => {
  beforeEach(() => {
    vi.stubGlobal("React", React);
    fixture.states = []; fixture.cursor = 0; fixture.effectCursor = 0; fixture.deps = []; fixture.effects = []; fixture.theses = []; fixture.search = "";
    vi.clearAllMocks(); fixture.create.mockResolvedValue({ compilationId: 1, persistedName: "Draft", nameMatchesRequest: true });
    fixture.project.mockResolvedValue({ sourceCompilationId: 1, apertureThesisId: 42, compilerStatus: "ready", missingFields: [], incompatibilities: [] });
  });
  it("opens the new composer directly even when another thesis is active", () => {
    fixture.search = "new=1"; fixture.theses = [saved];
    const tree = render();
    expect(input(tree, "Thesis statement")?.props.value).toBe("");
    expect(input(tree, "Thesis name")?.props.value).toBe("");
    expect(fixture.create).not.toHaveBeenCalled();
    expect(fixture.activate).not.toHaveBeenCalled();
  });
  it("hands the saved source and projection to Mission rather than resuming Today", async () => {
    let tree = render();
    input(tree, "Thesis statement").props.onChange({ target: { value: saved.thesisText } }); tree = render();
    button(tree, "Save and use in Capital Mission").props.onClick();
    for (let i = 0; i < 12; i++) await Promise.resolve();
    expect(fixture.navigate).toHaveBeenCalledWith("/aperture/mission?canonicalThesisId=1&capitalThesisId=42&newMission=1");
  });
  it("does not hand off an unrelated projection", async () => {
    fixture.project.mockResolvedValue({ sourceCompilationId: 999, apertureThesisId: 42, compilerStatus: "ready", missingFields: [], incompatibilities: [] });
    let tree = render();
    input(tree, "Thesis statement").props.onChange({ target: { value: saved.thesisText } }); tree = render();
    button(tree, "Save and use in Capital Mission").props.onClick();
    for (let i = 0; i < 12; i++) await Promise.resolve();
    expect(fixture.navigate).not.toHaveBeenCalled();
  });
  it("blocks missing research scope even when provider compilation completed", async () => {
    fixture.project.mockResolvedValue({ sourceCompilationId: 1, apertureThesisId: 42, compilerStatus: "compiled", missingFields: ["Recover the research universe in a new thesis version"], incompatibilities: [] });
    let tree = render();
    input(tree, "Thesis statement").props.onChange({ target: { value: saved.thesisText } }); tree = render();
    button(tree, "Save and use in Capital Mission").props.onClick();
    for (let i = 0; i < 12; i++) await Promise.resolve();
    expect(fixture.navigate).not.toHaveBeenCalled();
  });
  it("cannot save an empty or whitespace-only statement even when invoking the disabled handler", async () => {
    let tree = render();
    expect(input(tree, "Thesis statement").props.value).toBe("");
    input(tree, "Thesis statement").props.onChange({ target: { value: "   " } }); tree = render();
    button(tree, "Save without starting a run").props.onClick();
    button(tree, "Save and use in Capital Mission").props.onClick();
    await Promise.resolve();
    expect(fixture.create).not.toHaveBeenCalled(); expect(fixture.activate).not.toHaveBeenCalled(); expect(fixture.project).not.toHaveBeenCalled();
  });
  it("loads a saved thesis verbatim and does not overwrite edits on a query refresh", () => {
    fixture.theses = [saved]; let tree = render();
    button(tree, "Change thesis").props.onClick(); tree = render();
    button(tree, "Edit as new version").props.onClick(); tree = render();
    expect(input(tree, "Thesis statement").props.value).toBe(saved.thesisText);
    const edited = `${saved.thesisText} A new operator assumption.`;
    input(tree, "Thesis statement").props.onChange({ target: { value: edited } });
    fixture.theses = [{ ...saved }]; tree = render();
    expect(input(tree, "Thesis statement").props.value).toBe(edited);
    expect(saved.thesisText).not.toContain("A new operator assumption");
    expect(fixture.create).not.toHaveBeenCalled();
  });
  it("starts a deliberate new thesis blank even with an existing active source", () => {
    fixture.theses = [saved]; let tree = render();
    button(tree, "Create new Capital thesis").props.onClick(); tree = render();
    expect(input(tree, "Thesis statement").props.value).toBe("");
    expect(input(tree, "Thesis name").props.value).toBe("");
    expect(fixture.theses).toEqual([saved]);
    expect(fixture.create).not.toHaveBeenCalled();
  });
  it("submits only operator text and leaves mission actions untouched on Save alone", async () => {
    let tree = render();
    input(tree, "Thesis statement").props.onChange({ target: { value: saved.thesisText } });
    input(tree, "Thesis name").props.onChange({ target: { value: "My full thesis version" } }); tree = render();
    button(tree, "Save without starting a run").props.onClick(); await Promise.resolve();
    expect(fixture.create).toHaveBeenCalledWith(expect.objectContaining({ thesisText: saved.thesisText, name: "My full thesis version" }));
    expect(fixture.activate).not.toHaveBeenCalled(); expect(fixture.project).not.toHaveBeenCalled(); expect(fixture.navigate).not.toHaveBeenCalled();
  });
  it("retains the draft after a failed save and shows failure instead of Saved", async () => {
    fixture.create.mockRejectedValue(new Error("Fixture save unavailable"));
    let tree = render(); input(tree, "Thesis statement").props.onChange({ target: { value: saved.thesisText } }); tree = render();
    button(tree, "Save without starting a run").props.onClick(); await Promise.resolve(); tree = render();
    expect(input(tree, "Thesis statement").props.value).toBe(saved.thesisText);
    expect(text(tree)).toContain("Save not confirmed: Fixture save unavailable");
    expect(button(tree, "Check saved theses")).toBeDefined();
    button(tree, "Check saved theses").props.onClick();
    fixture.theses = [saved]; tree = render();
    expect(fixture.invalidate).toHaveBeenCalledOnce();
    expect(text(tree)).toContain("Last loaded saved theses");
    expect(input(tree, "Thesis statement").props.value).toBe(saved.thesisText);
    expect(text(tree)).not.toContain("Saved exactly as");
    expect(fixture.project).not.toHaveBeenCalled();
  });
  it("checks the actual save limits, including serialized detail and full name", () => {
    expect(thesisDraftValidation(" ", "x".repeat(25), "")).toContain("at least 20");
    expect(thesisDraftValidation("x".repeat(20), "x".repeat(4001), "")).toContain("4,000");
    expect(thesisDraftValidation("x".repeat(20), "x".repeat(20), "n".repeat(121))).toContain("120");
    expect(thesisDraftValidation("x".repeat(20), "x".repeat(4000), "n".repeat(120))).toBeNull();
  });
  it("keeps descriptive research scope separate from declared tickers", async () => {
    let tree = render();
    input(tree, "Thesis statement").props.onChange({ target: { value: saved.thesisText } });
    button(tree, "Add thesis detail").props.onClick(); tree = render();
    const scope = "Liquid U.S.-listed refiners and diesel-sensitive transport businesses; verify mappings first.";
    input(tree, "Research scope (optional)").props.onChange({ target: { value: scope } }); tree = render();
    button(tree, "Save without starting a run").props.onClick(); await Promise.resolve();
    expect(fixture.create).toHaveBeenCalledWith(expect.objectContaining({ details: expect.objectContaining({ researchUniverse: scope, symbols: "" }) }));
  });
  it("asks for correction rather than saving prose as ticker declarations", async () => {
    let tree = render();
    input(tree, "Thesis statement").props.onChange({ target: { value: saved.thesisText } });
    button(tree, "Add thesis detail").props.onClick(); tree = render();
    input(tree, "Ticker symbols (optional)").props.onChange({ target: { value: "Liquid U.S.-listed refiners and diesel-sensitive transport businesses" } }); tree = render();
    button(tree, "Save without starting a run").props.onClick(); await Promise.resolve();
    expect(fixture.create).not.toHaveBeenCalled();
    expect(text(tree)).toContain("Put company descriptions in Research scope instead");
  });
});

/**
 * Exposure Map — the thesis decomposition tree with coverage overlay.
 * Shows which nodes the portfolio covers and which are underexposed.
 */
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

interface TreeNode {
  label: string;
  path: string;
  depth: number;
  children: TreeNode[];
  covered: boolean;
  coveringSymbols: string[];
  source: "holding" | "intended" | "candidate" | null;
}

function buildTree(
  nodes: Array<{ label: string; path: string; depth: number }>,
  coverage: Array<{ nodePath: string; symbol: string; source: string }>,
): TreeNode[] {
  const coverageMap = new Map<string, Array<{ symbol: string; source: string }>>();
  for (const c of coverage) {
    if (!coverageMap.has(c.nodePath)) coverageMap.set(c.nodePath, []);
    coverageMap.get(c.nodePath)!.push(c);
  }

  const roots: TreeNode[] = [];
  const byPath = new Map<string, TreeNode>();

  for (const n of nodes.sort((a, b) => a.depth - b.depth)) {
    const covs = coverageMap.get(n.path) ?? [];
    const node: TreeNode = {
      label: n.label,
      path: n.path,
      depth: n.depth,
      children: [],
      covered: covs.length > 0,
      coveringSymbols: covs.map((c) => c.symbol),
      source: covs[0]?.source as any ?? null,
    };
    byPath.set(n.path, node);

    const parentPath = n.path.split(" > ").slice(0, -1).join(" > ");
    const parent = byPath.get(parentPath);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function NodeRow({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const indent = depth * 20;
  return (
    <>
      <div
        className="flex items-center gap-2 py-1.5 px-3 rounded hover:bg-muted/30 transition-colors"
        style={{ paddingLeft: `${12 + indent}px` }}
      >
        {node.covered ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "oklch(0.55 0.15 145)" }} />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />
        )}
        <span className="text-sm flex-1" style={{ color: "var(--sh-text-primary)" }}>{node.label}</span>
        {node.coveringSymbols.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {node.coveringSymbols.slice(0, 4).map((s) => (
              <Badge
                key={s}
                variant="outline"
                className="text-xs px-1.5 py-0"
                style={{
                  borderColor: node.source === "holding" ? "oklch(0.55 0.15 145)" :
                    node.source === "intended" ? "var(--sh-signal)" : "var(--sh-border-1)",
                }}
              >
                {s}
              </Badge>
            ))}
            {node.coveringSymbols.length > 4 && (
              <span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>+{node.coveringSymbols.length - 4}</span>
            )}
          </div>
        )}
      </div>
      {node.children.map((child) => (
        <NodeRow key={child.path} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export default function ExposureMap() {
  const [, params] = useRoute("/aperture/run/:id/exposure");
  const runId = Number(params?.id);

  const { data, isLoading } = trpc.aperture.run.get.useQuery({ id: runId }, { enabled: !!runId });

  if (isLoading) return <DashboardLayout><div className="p-8 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Loading…</div></DashboardLayout>;
  if (!data) return <DashboardLayout><div className="p-8 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Run not found.</div></DashboardLayout>;

  const { run, coverageDetail, thesisNodes, brief } = data;
  const tree = buildTree(thesisNodes, coverageDetail);
  const coveredPaths = new Set(coverageDetail.map((item) => item.nodePath));
  const coveredCount = thesisNodes.filter((node) => coveredPaths.has(node.path)).length;
  const uncoveredCount = brief.portfolioContext.uncoveredNodes.length;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium"
          style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", border: "1px solid var(--sh-border-1)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />
          Internal research tool — not investment advice.
        </div>

        <div>
          <h1 className="font-serif text-2xl mb-1" style={{ color: "var(--sh-text-primary)" }}>Portfolio gap map</h1>
          <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>Run #{runId} · which thesis nodes are represented, and which require research before a paper decision.</p>
        </div>

        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" style={{ color: "oklch(0.55 0.15 145)" }} />
            <span style={{ color: "var(--sh-text-primary)" }}>{coveredCount} covered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" style={{ color: "var(--sh-signal)" }} />
            <span style={{ color: "var(--sh-text-primary)" }}>{uncoveredCount} underexposed</span>
          </div>
        </div>

        <div className="flex gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-1"><Circle className="h-2.5 w-2.5" style={{ color: "oklch(0.55 0.15 145)" }} /> Current holding</div>
          <div className="flex items-center gap-1"><Circle className="h-2.5 w-2.5" style={{ color: "var(--sh-signal)" }} /> Intended trade</div>
          <div className="flex items-center gap-1"><Circle className="h-2.5 w-2.5" style={{ color: "var(--sh-border-1)" }} /> Candidate</div>
        </div>

        {brief.portfolioContext.uncoveredNodes.length > 0 && (
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Research question</p>
            <p className="mt-1 text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>Do these uncovered thesis nodes deserve evidence review before they receive paper capital?</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{brief.portfolioContext.uncoveredNodes.slice(0, 6).map((node) => <Badge key={node} variant="outline" className="text-xs">{node}</Badge>)}</div>
          </div>
        )}

        <Card>
          <CardContent className="pt-4 divide-y divide-border">
            {tree.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: "var(--sh-fg-muted)" }}>No exposure nodes recorded for this run.</p>
            ) : (
              tree.map((node) => <NodeRow key={node.path} node={node} />)
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

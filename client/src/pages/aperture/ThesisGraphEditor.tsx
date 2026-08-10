/**
 * Thesis Graph Editor — create or edit a capital thesis.
 *
 * INTERNAL RESEARCH TOOL — NOT INVESTMENT ADVICE.
 */
import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, Sparkles, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

const PLACEHOLDER = `Example thesis:

I believe AI infrastructure buildout is the dominant capital cycle of the next 5 years. The constraint is not compute — it's power delivery, cooling, and the physical layer that supports it.

I'm seeking: companies that earn from data center power infrastructure, industrial cooling, grid modernisation, and uranium/nuclear as the only scalable zero-carbon baseload.

I'm avoiding: pure-play software, consumer AI, and anything with >60% revenue from a single hyperscaler customer.

Horizon: 3–5 years. I want concentrated positions, max 8 names, no single name above 20%.`;

export default function ThesisGraphEditor() {
  const [, params] = useRoute("/aperture/thesis/:id");
  const [, navigate] = useLocation();
  const isNew = !params?.id || params.id === "new";
  const thesisId = isNew ? null : Number(params!.id);

  const [name, setName] = useState("");
  const [rawText, setRawText] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: thesis } = trpc.aperture.thesis.get.useQuery(
    { id: thesisId! },
    { enabled: !isNew && !!thesisId },
  );

  const createThesis = trpc.aperture.thesis.create.useMutation({
    onSuccess: ({ id }) => {
      toast.success("Thesis saved");
      navigate(`/aperture/thesis/${id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const compileThesis = trpc.aperture.thesis.compile.useMutation({
    onSuccess: ({ confidenceNotes }) => {
      toast.success("Compiled successfully");
      if (confidenceNotes?.length) {
        toast.warning(`${confidenceNotes.length} compiler note(s) — review the graph`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const activateThesis = trpc.aperture.thesis.activate.useMutation({
    onSuccess: () => toast.success("Thesis set as primary"),
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (thesis) {
      setName(thesis.name ?? "");
      setRawText(thesis.rawText);
    }
  }, [thesis]);

  const handleSave = async () => {
    if (!rawText.trim()) return toast.error("Write your thesis first");
    setSaving(true);
    try {
      await createThesis.mutateAsync({ name: name || undefined, rawText });
    } finally {
      setSaving(false);
    }
  };

  const graph = thesis?.graph;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium"
          style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", border: "1px solid var(--sh-border-1)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />
          Internal research tool — not investment advice. Modeled figures are labeled as such.
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/aperture")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--sh-text-primary)" }}>
              {isNew ? "New Thesis" : (thesis?.name ?? `Thesis #${thesisId}`)}
            </h1>
            <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>
              Write your investment thesis in plain language. The compiler extracts the structured graph.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Name <span className="opacity-50">(optional)</span></Label>
                  <Input
                    placeholder="e.g. AI Infrastructure Cycle"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Thesis Text</Label>
                  <Textarea
                    className="min-h-[320px] text-sm font-mono resize-none"
                    placeholder={PLACEHOLDER}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                  />
                  <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>
                    {rawText.length} chars · Write naturally — beliefs, what you seek, what you avoid, position sizing rules.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={saving || createThesis.isPending}
                    onClick={handleSave}
                  >
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {isNew ? "Save Thesis" : "Update"}
                  </Button>
                  {!isNew && (
                    <Button
                      variant="outline"
                      disabled={compileThesis.isPending}
                      onClick={() => compileThesis.mutate({ id: thesisId! })}
                    >
                      {compileThesis.isPending
                        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        : <Sparkles className="h-4 w-4 mr-2" />}
                      Compile
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Compiled graph preview */}
          <div className="space-y-4">
            {graph ? (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" style={{ color: "oklch(0.55 0.15 145)" }} />
                      <CardTitle className="text-sm">Compiled Graph</CardTitle>
                      <Badge variant="outline" className="text-xs">{thesis?.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    {(graph as any).beliefs?.length > 0 && (
                      <div>
                        <p className="font-medium mb-1" style={{ color: "var(--sh-text-primary)" }}>Beliefs</p>
                        <ul className="space-y-0.5" style={{ color: "var(--sh-fg-muted)" }}>
                          {(graph as any).beliefs.map((b: string, i: number) => <li key={i}>· {b}</li>)}
                        </ul>
                      </div>
                    )}
                    {(graph as any).seek?.length > 0 && (
                      <div>
                        <p className="font-medium mb-1" style={{ color: "var(--sh-text-primary)" }}>Seeking</p>
                        <ul className="space-y-0.5" style={{ color: "oklch(0.55 0.15 145)" }}>
                          {(graph as any).seek.map((s: string, i: number) => <li key={i}>✓ {s}</li>)}
                        </ul>
                      </div>
                    )}
                    {(graph as any).avoid?.length > 0 && (
                      <div>
                        <p className="font-medium mb-1" style={{ color: "var(--sh-text-primary)" }}>Avoiding</p>
                        <ul className="space-y-0.5" style={{ color: "var(--sh-red)" }}>
                          {(graph as any).avoid.map((a: string, i: number) => <li key={i}>✗ {a}</li>)}
                        </ul>
                      </div>
                    )}
                    {(graph as any).portfolioRules && (
                      <div>
                        <p className="font-medium mb-1" style={{ color: "var(--sh-text-primary)" }}>Portfolio Rules</p>
                        <div className="space-y-0.5" style={{ color: "var(--sh-fg-muted)" }}>
                          {(graph as any).portfolioRules.maxSingleNamePct != null && (
                            <p>Max single name: {(graph as any).portfolioRules.maxSingleNamePct}%</p>
                          )}
                          {(graph as any).portfolioRules.reservePct != null && (
                            <p>Reserve: {(graph as any).portfolioRules.reservePct}%</p>
                          )}
                        </div>
                      </div>
                    )}
                    {thesis?.confidenceNotes?.length ? (
                      <div className="p-2 rounded" style={{ background: "var(--sh-surface-2)" }}>
                        <p className="font-medium mb-1" style={{ color: "var(--sh-signal)" }}>Compiler Notes</p>
                        {thesis.confidenceNotes.map((n, i) => (
                          <p key={i} className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>· {n}</p>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
                {thesis?.status !== "active" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => activateThesis.mutate({ id: thesisId! })}
                    disabled={activateThesis.isPending}
                  >
                    Set as Primary Thesis
                  </Button>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>
                    {isNew ? "Save the thesis, then compile to see the structured graph." : "Click Compile to extract the structured graph."}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

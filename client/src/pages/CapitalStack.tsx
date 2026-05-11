/**
 * STACK Module — Capital Stack Modeler
 * TSL-SCI-BRIEF-001-A2
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Layers,
  ChevronRight,
  Star,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Percent,
  Clock,
  Building2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface StackTemplate {
  id: number;
  template_id: string;
  name: string;
  description: string;
  thesis_alignment: string;
  total_layers: number;
  target_ltv: number;
  target_equity_pct: number;
  target_seller_note_pct: number;
  is_principal_default: number;
  disclaimer: string;
}

interface CapitalStack {
  id: number;
  name: string;
  template_id: string | null;
  purchase_price: number | null;
  status: string;
  created_at: number;
  updated_at: number;
}

interface StackLayer {
  id: number;
  stack_id: number;
  layer_order: number;
  layer_type: string;
  label: string;
  amount: number;
  pct_of_total: number | null;
  interest_rate: number | null;
  term_months: number | null;
  lender: string | null;
  notes: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const LAYER_COLORS: Record<string, string> = {
  sba_7a: "var(--amber)",
  sba_504: "oklch(0.72 0.15 200)",
  senior_debt: "oklch(0.68 0.12 250)",
  seller_note: "var(--sage)",
  equity: "oklch(0.72 0.18 30)",
  mezzanine: "oklch(0.65 0.18 290)",
  grant: "oklch(0.72 0.15 150)",
  reap: "oklch(0.72 0.15 150)",
  earnout: "oklch(0.72 0.12 60)",
  rollover_equity: "oklch(0.68 0.12 20)",
  other: "oklch(0.65 0.05 260)",
};

const LAYER_TYPE_LABELS: Record<string, string> = {
  sba_7a: "SBA 7(a)",
  sba_504: "SBA 504",
  senior_debt: "Senior Debt",
  seller_note: "Seller Note",
  equity: "Equity",
  mezzanine: "Mezzanine",
  grant: "Grant",
  reap: "REAP Grant",
  earnout: "Earnout",
  rollover_equity: "Rollover Equity",
  other: "Other",
};

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

// ─── Waterfall Chart ──────────────────────────────────────────────────────────
function WaterfallChart({ layers, totalCapital }: { layers: StackLayer[]; totalCapital: number }) {
  if (!layers.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
      {layers.map((layer) => {
        const pct = totalCapital > 0 ? (layer.amount / totalCapital) * 100 : 0;
        const color = LAYER_COLORS[layer.layer_type] ?? LAYER_COLORS.other;
        return (
          <div key={layer.id} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "140px", fontSize: "11px", color: "var(--sh-fg-3)", textAlign: "right", flexShrink: 0, fontFamily: "var(--font-mono)", letterSpacing: "0.02em" }}>
              {fmtMoney(layer.amount)}
            </div>
            <div style={{ flex: 1, height: "28px", background: "var(--sh-surface-2)", borderRadius: "4px", overflow: "hidden", position: "relative" }}>
              <div
                style={{
                  width: `${Math.min(100, pct)}%`,
                  height: "100%",
                  background: color,
                  opacity: 0.85,
                  transition: "width 0.4s ease",
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: "8px",
                }}
              >
                {pct > 8 && (
                  <span style={{ fontSize: "10px", color: "oklch(0.1 0.01 260)", fontWeight: 600, whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>
                    {pct.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            <div style={{ width: "160px", fontSize: "11px", color: "var(--sh-fg-2)", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {layer.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Layer Row ────────────────────────────────────────────────────────────────
function LayerRow({ layer, totalCapital, onUpdate }: {
  layer: StackLayer;
  totalCapital: number;
  onUpdate: (layerId: number, amount: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = totalCapital > 0 ? (layer.amount / totalCapital) * 100 : 0;
  const color = LAYER_COLORS[layer.layer_type] ?? LAYER_COLORS.other;

  return (
    <div style={{
      border: "1px solid var(--sh-rule)",
      borderRadius: "8px",
      overflow: "hidden",
      background: "var(--sh-surface)",
      transition: "border-color 0.2s",
    }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 16px",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--sh-fg-1)" }}>{layer.label}</div>
          <div style={{ fontSize: "11px", color: "var(--sh-fg-3)", fontFamily: "var(--font-mono)" }}>
            {LAYER_TYPE_LABELS[layer.layer_type] ?? layer.layer_type}
            {layer.interest_rate ? ` · ${layer.interest_rate}%` : ""}
            {layer.term_months ? ` · ${layer.term_months}mo` : ""}
            {layer.lender ? ` · ${layer.lender}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--sh-fg-1)", fontFamily: "var(--font-mono)" }}>{fmtMoney(layer.amount)}</div>
          <div style={{ fontSize: "11px", color: "var(--sh-fg-3)", fontFamily: "var(--font-mono)" }}>{pct.toFixed(1)}%</div>
        </div>
        {expanded ? <ChevronUp size={14} style={{ color: "var(--sh-fg-3)", flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: "var(--sh-fg-3)", flexShrink: 0 }} />}
      </div>
      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--sh-rule)" }}>
          {layer.notes && (
            <p style={{ fontSize: "12px", color: "var(--sh-fg-3)", marginTop: "12px", lineHeight: 1.5 }}>{layer.notes}</p>
          )}
          <div style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <Label style={{ fontSize: "11px", color: "var(--sh-fg-3)" }}>Amount ($)</Label>
              <Input
                type="number"
                defaultValue={layer.amount}
                style={{ marginTop: "4px", fontFamily: "var(--font-mono)", fontSize: "13px" }}
                onBlur={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val !== layer.amount) {
                    onUpdate(layer.id, val);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────
function TemplateCard({ template, onSelect }: { template: StackTemplate; onSelect: () => void }) {
  const isPrincipal = template.is_principal_default === 1;
  return (
    <div
      onClick={onSelect}
      style={{
        border: isPrincipal ? "1.5px solid var(--amber)" : "1px solid var(--sh-rule)",
        borderRadius: "10px",
        padding: "16px",
        background: isPrincipal ? "oklch(0.97 0.03 85 / 0.08)" : "var(--sh-surface)",
        cursor: "pointer",
        transition: "all 0.2s",
        position: "relative",
      }}
    >
      {isPrincipal && (
        <div style={{ position: "absolute", top: "10px", right: "10px" }}>
          <Badge style={{ background: "var(--amber)", color: "oklch(0.15 0.02 85)", fontSize: "10px", padding: "2px 6px" }}>
            <Star size={9} style={{ marginRight: "3px" }} />
            PRINCIPAL DEFAULT
          </Badge>
        </div>
      )}
      <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--sh-fg-1)", paddingRight: isPrincipal ? "120px" : "0" }}>{template.name}</div>
      <div style={{ fontSize: "11px", color: "var(--sh-fg-3)", marginTop: "4px", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {template.thesis_alignment.replace(/_/g, " ")}
      </div>
      <p style={{ fontSize: "12px", color: "var(--sh-fg-2)", marginTop: "8px", lineHeight: 1.5 }}>{template.description.slice(0, 140)}...</p>
      <div style={{ display: "flex", gap: "16px", marginTop: "12px" }}>
        <div style={{ fontSize: "11px", color: "var(--sh-fg-3)" }}>
          <span style={{ color: "var(--amber)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{template.target_ltv}%</span> LTV
        </div>
        <div style={{ fontSize: "11px", color: "var(--sh-fg-3)" }}>
          <span style={{ color: "var(--sh-fg-1)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{template.target_equity_pct}%</span> Equity
        </div>
        <div style={{ fontSize: "11px", color: "var(--sh-fg-3)" }}>
          <span style={{ color: "var(--sage)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{template.target_seller_note_pct}%</span> Seller Note
        </div>
        <div style={{ fontSize: "11px", color: "var(--sh-fg-3)" }}>
          <span style={{ color: "var(--sh-fg-2)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{template.total_layers}</span> Layers
        </div>
      </div>
    </div>
  );
}

// ─── Stack Modeler ────────────────────────────────────────────────────────────
function StackModeler({ stackId, onClose }: { stackId: number; onClose: () => void }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.stack.getStack.useQuery({ stackId });

  const updateLayer = trpc.stack.updateLayer.useMutation({
    onSuccess: () => utils.stack.getStack.invalidate({ stackId }),
    onError: (e) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteStack = trpc.stack.deleteStack.useMutation({
    onSuccess: () => {
      utils.stack.listStacks.invalidate();
      onClose();
      toast({ title: "Stack deleted" });
    },
  });

  if (isLoading) return (
    <div style={{ padding: "40px", textAlign: "center", color: "var(--sh-fg-3)" }}>
      <RefreshCw size={20} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} />
      Loading stack...
    </div>
  );

  if (!data) return null;
  const { stack, layers } = data as { stack: CapitalStack; layers: StackLayer[] };
  const totalCapital = stack.purchase_price ?? 0;

  const totalAllocated = layers.reduce((sum, l) => sum + l.amount, 0);
  const gap = totalCapital - totalAllocated;

  // Compute DSCR estimate (rough)
  const annualDebtService = layers.reduce((sum, l) => {
    if (!l.interest_rate || !l.term_months || l.layer_type === "equity" || l.layer_type === "reap" || l.layer_type === "earnout") return sum;
    const r = l.interest_rate / 100 / 12;
    const n = l.term_months;
    const pmt = r > 0 ? l.amount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : l.amount / n;
    return sum + pmt * 12;
  }, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "11px", color: "var(--sh-fg-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Capital Stack</div>
          <h2 style={{ fontSize: "20px", fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--sh-fg-1)" }}>{stack.name}</h2>
          <div style={{ fontSize: "13px", color: "var(--sh-fg-3)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
            Purchase Price: <span style={{ color: "var(--amber)", fontWeight: 700 }}>{fmtMoney(totalCapital)}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button variant="outline" size="sm" onClick={onClose}>Back</Button>
          <Button
            variant="outline"
            size="sm"
            style={{ color: "oklch(0.55 0.18 25)", borderColor: "oklch(0.55 0.18 25 / 0.4)" }}
            onClick={() => deleteStack.mutate({ stackId })}
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        {[
          { icon: DollarSign, label: "Purchase Price", value: fmtMoney(totalCapital), color: "var(--amber)" },
          { icon: Percent, label: "Equity Required", value: fmtPct(layers.find(l => l.layer_type === "equity")?.pct_of_total), color: "oklch(0.72 0.18 30)" },
          { icon: TrendingUp, label: "Est. Annual Debt Svc", value: fmtMoney(annualDebtService), color: "var(--sage)" },
          { icon: AlertCircle, label: "Unallocated", value: fmtMoney(Math.abs(gap)), color: gap !== 0 ? "oklch(0.65 0.18 25)" : "var(--sage)" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{ background: "var(--sh-surface)", border: "1px solid var(--sh-rule)", borderRadius: "8px", padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <Icon size={12} style={{ color: "var(--sh-fg-3)" }} />
              <span style={{ fontSize: "10px", color: "var(--sh-fg-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>{label}</span>
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, color, fontFamily: "var(--font-mono)" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Waterfall */}
      <div style={{ background: "var(--sh-surface)", border: "1px solid var(--sh-rule)", borderRadius: "10px", padding: "20px" }}>
        <div style={{ fontSize: "11px", color: "var(--sh-fg-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: "16px" }}>
          Capital Structure Waterfall
        </div>
        <WaterfallChart layers={layers} totalCapital={totalCapital} />
      </div>

      {/* Layer Editor */}
      <div>
        <div style={{ fontSize: "11px", color: "var(--sh-fg-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: "12px" }}>
          Layer Detail — Click to Expand & Edit
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {layers.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              totalCapital={totalCapital}
              onUpdate={(layerId, amount) => updateLayer.mutate({ stackId, layerId, amount })}
            />
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ fontSize: "11px", color: "var(--sh-fg-4)", lineHeight: 1.5, borderTop: "1px solid var(--sh-rule)", paddingTop: "16px" }}>
        Capital stack models are for analytical and illustrative purposes only. Consult qualified legal, tax, and financial advisors before executing any transaction. Signal Hunter and Third Signal Labs do not provide legal, tax, or investment advice.
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CapitalStackPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [view, setView] = useState<"gallery" | "new" | "modeler">("gallery");
  const [activeStackId, setActiveStackId] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [purchasePrice, setPurchasePrice] = useState<string>("");
  const [dealName, setDealName] = useState<string>("");

  const { data: templates = [], isLoading: templatesLoading } = trpc.stack.listTemplates.useQuery();
  const { data: stacks = [], isLoading: stacksLoading } = trpc.stack.listStacks.useQuery();

  const createStack = trpc.stack.createFromTemplate.useMutation({
    onSuccess: (data) => {
      utils.stack.listStacks.invalidate();
      setActiveStackId(data.stackId);
      setView("modeler");
      toast({ title: "Stack created", description: "Capital stack modeled from template." });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const principalDefault = useMemo(() => (templates as StackTemplate[]).find(t => t.is_principal_default === 1), [templates]);

  const handleCreate = () => {
    if (!selectedTemplate || !purchasePrice) {
      toast({ title: "Required fields missing", description: "Select a template and enter a purchase price.", variant: "destructive" });
      return;
    }
    const price = parseFloat(purchasePrice.replace(/[,$]/g, ""));
    if (isNaN(price) || price <= 0) {
      toast({ title: "Invalid price", description: "Enter a valid purchase price.", variant: "destructive" });
      return;
    }
    createStack.mutate({ templateId: selectedTemplate, purchasePrice: price, dealName: dealName || undefined });
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 0 40px" }}>
        {/* Page Header */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ fontSize: "11px", color: "var(--sh-fg-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
            STACK MODULE · TSL-SCI-BRIEF-001-A2
          </div>
          <h1 style={{ fontSize: "28px", fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--sh-fg-1)", lineHeight: 1.2 }}>
            Capital Stack Modeler
          </h1>
          <p style={{ fontSize: "14px", color: "var(--sh-fg-3)", marginTop: "8px", lineHeight: 1.6, maxWidth: "600px" }}>
            Model acquisition capital structures from proven templates. Project Raleigh Keystone is the principal default — near-zero equity via SBA 7(a) + REAP grant + seller note stacking.
          </p>
        </div>

        {/* Principal Default Banner */}
        {principalDefault && view === "gallery" && (
          <div style={{
            background: "oklch(0.97 0.03 85 / 0.08)",
            border: "1.5px solid var(--amber)",
            borderRadius: "10px",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Star size={16} style={{ color: "var(--amber)", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "12px", color: "var(--amber)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2px" }}>
                  Principal Default Template
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--sh-fg-1)" }}>{principalDefault.name}</div>
                <div style={{ fontSize: "12px", color: "var(--sh-fg-3)", marginTop: "2px" }}>
                  {principalDefault.target_equity_pct}% equity · {principalDefault.target_ltv}% LTV · SBA 7(a) + REAP + Seller Note
                </div>
              </div>
            </div>
            <Button
              size="sm"
              style={{ background: "var(--amber)", color: "oklch(0.15 0.02 85)", flexShrink: 0 }}
              onClick={() => { setSelectedTemplate(principalDefault.template_id); setView("new"); }}
            >
              <Plus size={13} style={{ marginRight: "6px" }} />
              Model This Stack
            </Button>
          </div>
        )}

        {/* Navigation Tabs */}
        {view !== "modeler" && (
          <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderBottom: "1px solid var(--sh-rule)", paddingBottom: "0" }}>
            {[
              { key: "gallery", label: "Templates" },
              { key: "new", label: "New Stack" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setView(key as any)}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: view === key ? 600 : 400,
                  color: view === key ? "var(--sh-fg-1)" : "var(--sh-fg-3)",
                  background: "none",
                  border: "none",
                  borderBottom: view === key ? "2px solid var(--amber)" : "2px solid transparent",
                  cursor: "pointer",
                  marginBottom: "-1px",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            ))}
            {stacks.length > 0 && (
              <button
                onClick={() => setView("gallery")}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 400,
                  color: "var(--sh-fg-3)",
                  background: "none",
                  border: "none",
                  borderBottom: "2px solid transparent",
                  cursor: "pointer",
                  marginBottom: "-1px",
                  marginLeft: "auto",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {stacks.length} saved stack{stacks.length !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}

        {/* Template Gallery */}
        {view === "gallery" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {templatesLoading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--sh-fg-3)" }}>Loading templates...</div>
            ) : (
              (templates as StackTemplate[]).map((template) => (
                <TemplateCard
                  key={template.template_id}
                  template={template}
                  onSelect={() => { setSelectedTemplate(template.template_id); setView("new"); }}
                />
              ))
            )}

            {/* Saved Stacks */}
            {stacks.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <div style={{ fontSize: "11px", color: "var(--sh-fg-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: "12px" }}>
                  Saved Stacks
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(stacks as CapitalStack[]).map((stack) => (
                    <div
                      key={stack.id}
                      onClick={() => { setActiveStackId(stack.id); setView("modeler"); }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        background: "var(--sh-surface)",
                        border: "1px solid var(--sh-rule)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "border-color 0.2s",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--sh-fg-1)" }}>{stack.name}</div>
                        <div style={{ fontSize: "11px", color: "var(--sh-fg-3)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                          {stack.purchase_price ? fmtMoney(stack.purchase_price) : "—"} · {stack.status.toUpperCase()}
                        </div>
                      </div>
                      <ChevronRight size={14} style={{ color: "var(--sh-fg-3)" }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* New Stack Form */}
        {view === "new" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "560px" }}>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--sh-fg-1)", fontFamily: "var(--font-display)" }}>
              Configure Stack
            </div>

            {/* Template Selector */}
            <div>
              <Label style={{ fontSize: "12px", color: "var(--sh-fg-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Template</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
                {(templates as StackTemplate[]).map((t) => (
                  <div
                    key={t.template_id}
                    onClick={() => setSelectedTemplate(t.template_id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 14px",
                      border: selectedTemplate === t.template_id ? "1.5px solid var(--amber)" : "1px solid var(--sh-rule)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      background: selectedTemplate === t.template_id ? "oklch(0.97 0.03 85 / 0.08)" : "var(--sh-surface)",
                      transition: "all 0.15s",
                    }}
                  >
                    {t.is_principal_default === 1 && <Star size={12} style={{ color: "var(--amber)", flexShrink: 0 }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--sh-fg-1)" }}>{t.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--sh-fg-3)", fontFamily: "var(--font-mono)" }}>
                        {t.target_equity_pct}% equity · {t.target_ltv}% LTV
                      </div>
                    </div>
                    {selectedTemplate === t.template_id && (
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--amber)", flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Purchase Price */}
            <div>
              <Label style={{ fontSize: "12px", color: "var(--sh-fg-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Purchase Price</Label>
              <div style={{ position: "relative", marginTop: "8px" }}>
                <DollarSign size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--sh-fg-3)" }} />
                <Input
                  type="text"
                  placeholder="2,500,000"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  style={{ paddingLeft: "32px", fontFamily: "var(--font-mono)", fontSize: "14px" }}
                />
              </div>
            </div>

            {/* Deal Name (optional) */}
            <div>
              <Label style={{ fontSize: "12px", color: "var(--sh-fg-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Deal Name <span style={{ opacity: 0.5 }}>(optional)</span></Label>
              <div style={{ position: "relative", marginTop: "8px" }}>
                <Building2 size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--sh-fg-3)" }} />
                <Input
                  type="text"
                  placeholder="Metro HVAC — Atlanta"
                  value={dealName}
                  onChange={(e) => setDealName(e.target.value)}
                  style={{ paddingLeft: "32px", fontSize: "13px" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <Button variant="outline" onClick={() => setView("gallery")}>Cancel</Button>
              <Button
                style={{ background: "var(--amber)", color: "oklch(0.15 0.02 85)", flex: 1 }}
                onClick={handleCreate}
                disabled={createStack.isPending}
              >
                {createStack.isPending ? (
                  <><RefreshCw size={13} style={{ marginRight: "6px", animation: "spin 1s linear infinite" }} />Building Stack...</>
                ) : (
                  <><Layers size={13} style={{ marginRight: "6px" }} />Build Stack</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Stack Modeler */}
        {view === "modeler" && activeStackId && (
          <StackModeler stackId={activeStackId} onClose={() => { setView("gallery"); setActiveStackId(null); }} />
        )}
      </div>
    </DashboardLayout>
  );
}

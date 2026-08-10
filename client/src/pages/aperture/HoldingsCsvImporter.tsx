/**
 * Holdings CSV Importer — import positions from a CSV file into a portfolio account.
 *
 * Expected CSV columns (case-insensitive, flexible order):
 *   symbol, qty (or quantity or shares), avg_cost (or cost or price), market_value (or value)
 *
 * INTERNAL RESEARCH TOOL — NOT INVESTMENT ADVICE.
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Upload, CheckCircle2, XCircle, FileText } from "lucide-react";
import { toast } from "sonner";

interface ParsedRow {
  symbol: string;
  qty: number;
  avgCostCents?: number;
  marketValueCents?: number;
  error?: string;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(normalizeHeader);

  const col = (names: string[]) => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };

  const symIdx = col(["symbol", "ticker", "sym"]);
  const qtyIdx = col(["qty", "quantity", "shares", "amount"]);
  const costIdx = col(["avg_cost", "cost", "price", "avg_price", "average_cost"]);
  const valIdx = col(["market_value", "value", "mkt_value", "current_value"]);

  if (symIdx < 0 || qtyIdx < 0) {
    return [{ symbol: "", qty: 0, error: "CSV must have 'symbol' and 'qty' columns" }];
  }

  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const symbol = cells[symIdx]?.toUpperCase() ?? "";
    const qty = parseFloat(cells[qtyIdx] ?? "0");
    const cost = costIdx >= 0 ? parseFloat(cells[costIdx] ?? "") : NaN;
    const val = valIdx >= 0 ? parseFloat(cells[valIdx] ?? "") : NaN;

    if (!symbol || isNaN(qty)) return { symbol, qty: 0, error: "Invalid row" };
    return {
      symbol,
      qty,
      avgCostCents: isNaN(cost) ? undefined : Math.round(cost * 100),
      marketValueCents: isNaN(val) ? undefined : Math.round(val * 100),
    };
  }).filter((r) => r.symbol);
}

interface Props {
  onImported?: () => void;
}

export default function HoldingsCsvImporter({ onImported }: Props) {
  const [accountId, setAccountId] = useState<number | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: accounts } = trpc.aperture.account.list.useQuery();
  const importCsv = trpc.aperture.account.importCsv.useMutation({
    onSuccess: ({ imported }) => {
      toast.success(`Imported ${imported} positions`);
      setRows([]);
      setFileName("");
      onImported?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRows(parseCsv(text));
    };
    reader.readAsText(file);
  };

  const validRows = rows.filter((r) => !r.error);
  const errorRows = rows.filter((r) => r.error);

  const handleImport = () => {
    if (!accountId) return toast.error("Select an account first");
    if (!validRows.length) return toast.error("No valid rows to import");
    importCsv.mutate({ accountId, rows: validRows });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="h-3.5 w-3.5" style={{ color: "var(--sh-signal)" }} />
          <span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>
            Internal research tool — not investment advice.
          </span>
        </div>
        <CardTitle className="text-base">Import Holdings from CSV</CardTitle>
        <CardDescription>
          Required columns: <code className="text-xs">symbol</code>, <code className="text-xs">qty</code>.
          Optional: <code className="text-xs">avg_cost</code>, <code className="text-xs">market_value</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Target Account</Label>
          <Select
            value={accountId?.toString() ?? ""}
            onValueChange={(v) => setAccountId(Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select account…" />
            </SelectTrigger>
            <SelectContent>
              {accounts?.map((a) => (
                <SelectItem key={a.id} value={a.id.toString()}>
                  {a.label} · {a.brokerId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          style={{ borderColor: "var(--sh-border-1)" }}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
          {fileName ? (
            <div className="flex items-center justify-center gap-2">
              <FileText className="h-5 w-5" style={{ color: "var(--sh-signal)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>{fileName}</span>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>Click to upload CSV</p>
            </>
          )}
        </div>

        {rows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1" style={{ color: "oklch(0.55 0.15 145)" }}>
                <CheckCircle2 className="h-3.5 w-3.5" /> {validRows.length} valid
              </div>
              {errorRows.length > 0 && (
                <div className="flex items-center gap-1" style={{ color: "var(--sh-red)" }}>
                  <XCircle className="h-3.5 w-3.5" /> {errorRows.length} errors
                </div>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {validRows.slice(0, 20).map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded" style={{ background: "var(--sh-surface-2)" }}>
                  <span className="font-mono w-16" style={{ color: "var(--sh-text-primary)" }}>{r.symbol}</span>
                  <span style={{ color: "var(--sh-fg-muted)" }}>{r.qty} shares</span>
                  {r.marketValueCents != null && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      ${(r.marketValueCents / 100).toLocaleString()}
                    </Badge>
                  )}
                </div>
              ))}
              {validRows.length > 20 && (
                <p className="text-xs text-center" style={{ color: "var(--sh-fg-muted)" }}>+{validRows.length - 20} more</p>
              )}
            </div>
          </div>
        )}

        <Button
          className="w-full"
          disabled={!accountId || !validRows.length || importCsv.isPending}
          onClick={handleImport}
        >
          {importCsv.isPending ? "Importing…" : `Import ${validRows.length} Positions`}
        </Button>
      </CardContent>
    </Card>
  );
}


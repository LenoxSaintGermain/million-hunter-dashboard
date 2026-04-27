import { useState } from "react";
import { trpc } from "@/lib/trpc";
import InvestorLayout from "@/components/InvestorLayout";
import { Link } from "wouter";
import { Streamdown } from "streamdown";
import { FileText, ChevronRight, Calendar, Building2, X } from "lucide-react";

export default function MemoVault() {
  const [selectedMemoId, setSelectedMemoId] = useState<number | null>(null);
  const { data: memos, isLoading } = trpc.memos.list.useQuery();

  const selectedMemo = memos?.find((m) => m.id === selectedMemoId);

  return (
    <InvestorLayout>
      {/* Header */}
      <div>
        <h1 className="sh-h2" style={{ color: "var(--sh-fg-1)" }}>Memo Vault</h1>
        <p className="sh-body mt-1" style={{ color: "var(--sh-fg-3)" }}>
          Investment analysis and thesis documents — {memos?.length ?? 0} memo{memos?.length !== 1 ? "s" : ""} available
        </p>
      </div>

      {selectedMemo ? (
        /* ── Memo reader ── */
        <div
          className="rounded-2xl border border-border overflow-hidden"
          style={{ background: "var(--sh-surface-1)" }}
        >
          {/* Reader header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b border-border"
            style={{ background: "var(--sh-surface-2)" }}
          >
            <div className="flex-1 min-w-0">
              <h2 className="text-[15px] font-bold truncate" style={{ color: "var(--sh-fg-1)" }}>
                {selectedMemo.title ?? "Investment Memo"}
              </h2>
              <p className="sh-label mt-0.5">
                {new Date(selectedMemo.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <button
              className="w-8 h-8 flex items-center justify-center rounded-full ml-3 shrink-0"
              style={{ background: "var(--sh-surface-3)", color: "var(--sh-fg-3)" }}
              onClick={() => setSelectedMemoId(null)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Memo content */}
          <div className="p-6 lg:p-8">
            {/* Executive summary callout */}
            {selectedMemo.executiveSummary && (
              <div
                className="p-4 rounded-xl border mb-6"
                style={{ background: "var(--sh-primary-10)", borderColor: "var(--sh-primary-20)" }}
              >
                <p className="sh-label mb-1.5" style={{ color: "var(--sh-primary)" }}>Executive Summary</p>
                <p className="sh-body leading-relaxed" style={{ color: "var(--sh-fg-2)" }}>
                  {selectedMemo.executiveSummary}
                </p>
              </div>
            )}

            {/* Full memo */}
            <div
              className="prose prose-invert max-w-none text-[14px] leading-relaxed"
              style={{ color: "var(--sh-fg-2)" }}
            >
              <Streamdown>{selectedMemo.content ?? ""}</Streamdown>
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--sh-surface-2)" }} />
          ))}
        </div>
      ) : !memos || memos.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-border"
          style={{ background: "var(--sh-surface-1)" }}
        >
          <FileText className="w-10 h-10 mb-3" style={{ color: "var(--sh-fg-4)" }} />
          <p className="sh-body font-semibold" style={{ color: "var(--sh-fg-2)" }}>No memos available yet</p>
          <p className="sh-small mt-1" style={{ color: "var(--sh-fg-4)" }}>
            Investment memos will appear here as deals advance through diligence.
          </p>
        </div>
      ) : (
        /* ── Memo list ── */
        <div className="space-y-3">
          {memos.map((memo) => (
            <button
              key={memo.id}
              className="w-full text-left group"
              onClick={() => setSelectedMemoId(memo.id)}
            >
              <div
                className="flex items-center gap-4 p-5 rounded-2xl border cursor-pointer transition-all duration-200 hover:border-[var(--sh-primary-20)]"
                style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}
              >
                {/* Icon */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "var(--sh-primary-15)" }}
                >
                  <FileText className="w-5 h-5" style={{ color: "var(--sh-primary)" }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-bold truncate" style={{ color: "var(--sh-fg-1)" }}>
                    {memo.title ?? "Investment Memo"}
                  </h3>
                  {memo.executiveSummary && (
                    <p className="sh-small mt-0.5 line-clamp-2" style={{ color: "var(--sh-fg-3)" }}>
                      {memo.executiveSummary}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" style={{ color: "var(--sh-fg-4)" }} />
                      <span className="sh-label">
                        {new Date(memo.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {memo.generatedBy && (
                      <span
                        className="text-[10px] font-bold px-1.5 h-[16px] inline-flex items-center rounded-[4px]"
                        style={{ background: "var(--sh-surface-3)", color: "var(--sh-fg-4)" }}
                      >
                        {memo.generatedBy}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight
                  className="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--sh-primary)" }}
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </InvestorLayout>
  );
}

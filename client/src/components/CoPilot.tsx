/**
 * AI Co-Pilot — The Strategist, The Quant, and The Skeptic, always in context
 *
 * A persistent, context-aware strategic advisor that lives in the corner
 * of every page. Knows Lenox's full pipeline, recent activity, and deal
 * context. Challenges assumptions, surfaces leverage, executes fast.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";
import {
  Sparkles,
  X,
  Send,
  Minimize2,
  Maximize2,
  Loader2,
  ChevronDown,
  RotateCcw,
  Zap,
} from "lucide-react";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

interface CoPilotProps {
  /** Optional deal ID to inject deal-specific context */
  dealId?: number;
  /** Optional deal name for display */
  dealName?: string;
  /** When true, suppresses the floating FAB — open state is controlled externally */
  embedded?: boolean;
  /** External open state (used when embedded=true) */
  externalOpen?: boolean;
  /** Callback to close the panel (used when embedded=true) */
  onClose?: () => void;
}

const SUGGESTED_PROMPTS = [
  "Where is the highest-leverage move in my pipeline right now?",
  "Which deal should go to LOI first — and why?",
  "What is The Skeptic's strongest objection to my current thesis?",
  "What is the fastest path to $1M annual cash flow from what I have?",
  "Which deal in my pipeline has the most hidden downside risk?",
  "What would The Behaviorist say about my weakest seller relationship?",
];

export default function CoPilot({ dealId, dealName, embedded, externalOpen, onClose }: CoPilotProps) {
  const [isOpen, setIsOpen] = useState(false);
  // When embedded, sync with external open state
  const effectiveOpen = embedded ? (externalOpen ?? false) : isOpen;
  const handleClose = () => {
    if (embedded && onClose) onClose();
    else setIsOpen(false);
  };
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = trpc.copilot.chat.useMutation();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: content.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const result = await chatMutation.mutateAsync({
        messages: updatedMessages,
        dealId,
      });
      setMessages(prev => [...prev, { role: "assistant", content: result.content }]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Co-Pilot unavailable. Check your Poe API key.";
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `⚠️ **Error:** ${errorMsg}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, chatMutation, dealId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setInput("");
  };

  const panelWidth = isExpanded ? "w-[680px]" : "w-[400px]";
  const panelHeight = isExpanded ? "h-[680px]" : "h-[520px]";

  return (
    <>
      {/* ── Floating Trigger Button (only in non-embedded mode) ───────────────── */}
      {!embedded && !effectiveOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "fixed bottom-6 right-6 z-50",
            "w-14 h-14 rounded-full",
            "bg-gradient-to-br from-violet-600 to-indigo-600",
            "shadow-2xl shadow-violet-500/30",
            "flex items-center justify-center",
            "transition-all duration-300 hover:scale-110 hover:shadow-violet-500/50",
            "group"
          )}
          aria-label="Open AI Co-Pilot"
        >
          <Sparkles className="w-6 h-6 text-white group-hover:animate-pulse" />
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full bg-violet-500/30 animate-ping" />
        </button>
      )}

      {/* ── Co-Pilot Panel ─────────────────────────────────────────────────────────────── */}
      {effectiveOpen && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50",
            "flex flex-col",
            panelWidth,
            panelHeight,
            "bg-background/95 backdrop-blur-xl",
            "border border-border/60",
            "rounded-2xl shadow-2xl shadow-black/40",
            "transition-all duration-300",
            "overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-gradient-to-r from-violet-950/40 to-indigo-950/40 shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground tracking-tight">Co-Pilot</span>
                <Badge
                  variant="secondary"
                  className="text-[9px] px-1.5 py-0 h-4 bg-violet-500/20 text-violet-300 border-violet-500/30 font-mono"
                >
                  The Strategist
                </Badge>
              </div>
              {dealName ? (
                <p className="text-[10px] text-muted-foreground truncate">
                  Context: <span className="text-violet-400">{dealName}</span>
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground">All agents in context</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button
                  onClick={clearConversation}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  title="Clear conversation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 overflow-hidden">
            <div ref={scrollRef} className="p-4 space-y-4 overflow-y-auto h-full">
              {messages.length === 0 ? (
                <div className="space-y-4">
                  {/* Welcome state */}
                  <div className="text-center pt-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center mx-auto mb-3">
                      <Zap className="w-6 h-6 text-violet-400" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">Signal Hunter Intelligence</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[280px] mx-auto leading-relaxed">
                      The Strategist, The Skeptic, and The Scout — in context, always. I know your pipeline, your thesis, and where the risk lives.
                    </p>
                  </div>

                  {/* Suggested prompts */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">
                      Quick prompts
                    </p>
                    {SUGGESTED_PROMPTS.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(prompt)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-xl text-xs",
                          "bg-muted/40 hover:bg-muted/70 border border-border/40 hover:border-violet-500/30",
                          "text-muted-foreground hover:text-foreground",
                          "transition-all duration-150",
                          "leading-relaxed"
                        )}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2.5",
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {/* Avatar */}
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                        msg.role === "user"
                          ? "bg-primary/20 text-primary"
                          : "bg-gradient-to-br from-violet-600 to-indigo-600"
                      )}
                    >
                      {msg.role === "user" ? (
                        <span className="text-[9px] font-bold">L</span>
                      ) : (
                        <Sparkles className="w-3 h-3 text-white" />
                      )}
                    </div>

                    {/* Bubble */}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted/60 text-foreground rounded-tl-sm border border-border/40"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs [&_table]:text-xs">
                          <Streamdown>{msg.content}</Streamdown>
                        </div>
                      ) : (
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                  <div className="bg-muted/60 border border-border/40 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                      <span className="text-xs text-muted-foreground">Analyzing...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t border-border/60 bg-background/60 shrink-0">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your pipeline..."
                className={cn(
                  "flex-1 min-h-[40px] max-h-[120px] resize-none text-sm",
                  "bg-muted/40 border-border/60 focus:border-violet-500/50",
                  "placeholder:text-muted-foreground/50",
                  "rounded-xl"
                )}
                disabled={isLoading}
                rows={1}
              />
              <Button
                size="icon"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className={cn(
                  "h-10 w-10 shrink-0 rounded-xl",
                  "bg-gradient-to-br from-violet-600 to-indigo-600",
                  "hover:from-violet-500 hover:to-indigo-500",
                  "disabled:opacity-40"
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/50 mt-1.5 px-1">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}

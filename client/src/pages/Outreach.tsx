import { useState } from "react";
import { trpc } from "@/lib/trpc";
import EditorialTopNav from "@/components/EditorialTopNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Mail, Phone, MessageSquare, Calendar, Plus,
  Building2, User, ChevronDown, ChevronUp, Send,
  CheckCircle2, Clock, AlertCircle,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-muted/60 text-muted-foreground", icon: <Clock className="w-3 h-3" /> },
  sent: { label: "Sent", color: "bg-blue-500/20 text-blue-400", icon: <Send className="w-3 h-3" /> },
  opened: { label: "Opened", color: "bg-amber-500/20 text-[var(--amber)]", icon: <Mail className="w-3 h-3" /> },
  replied: { label: "Replied", color: "bg-emerald-500/20 text-[var(--sage)]", icon: <MessageSquare className="w-3 h-3" /> },
  meeting_scheduled: { label: "Meeting", color: "bg-purple-500/20 text-purple-400", icon: <Calendar className="w-3 h-3" /> },
  no_response: { label: "No Response", color: "bg-muted/30 text-muted-foreground/60", icon: <AlertCircle className="w-3 h-3" /> },
  not_interested: { label: "Not Interested", color: "bg-destructive/20 text-destructive", icon: <AlertCircle className="w-3 h-3" /> },
  closed: { label: "Closed", color: "bg-emerald-600/30 text-emerald-300", icon: <CheckCircle2 className="w-3 h-3" /> },
};

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  email: <Mail className="w-3.5 h-3.5" />,
  phone: <Phone className="w-3.5 h-3.5" />,
  linkedin: <User className="w-3.5 h-3.5" />,
  sms: <MessageSquare className="w-3.5 h-3.5" />,
};

function AddOutreachDialog({ deals, onSuccess }: { deals: { id: number; name: string }[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    dealId: "", contactName: "", contactEmail: "",
    contactPhone: "", contactRole: "", channel: "email",
    subject: "", body: "",
  });

  const createOutreach = trpc.outreach.create.useMutation({
    onSuccess: () => { toast.success("Outreach logged"); setOpen(false); onSuccess(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.dealId) return;
    createOutreach.mutate({
      dealId: Number(form.dealId),
      contactName: form.contactName || undefined,
      contactEmail: form.contactEmail || undefined,
      contactPhone: form.contactPhone || undefined,
      contactRole: form.contactRole || undefined,
      channel: form.channel,
      subject: form.subject || undefined,
      body: form.body || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 text-xs">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Log Outreach
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-md"
        style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold" style={{ color: "var(--sh-fg-1)" }}>
            Log Outreach Contact
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: "var(--sh-fg-3)" }}>Deal *</Label>
            <Select value={form.dealId} onValueChange={(v) => setForm({ ...form, dealId: v })}>
              <SelectTrigger className="h-8 text-xs" style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border)" }}>
                <SelectValue placeholder="Select deal..." />
              </SelectTrigger>
              <SelectContent>
                {deals.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)} className="text-xs">{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: "var(--sh-fg-3)" }}>Contact Name</Label>
              <Input className="h-8 text-xs" style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border)" }} placeholder="John Smith" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: "var(--sh-fg-3)" }}>Role</Label>
              <Input className="h-8 text-xs" style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border)" }} placeholder="Broker / Owner" value={form.contactRole} onChange={(e) => setForm({ ...form, contactRole: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: "var(--sh-fg-3)" }}>Email</Label>
              <Input className="h-8 text-xs" style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border)" }} type="email" placeholder="john@broker.com" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: "var(--sh-fg-3)" }}>Channel</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                <SelectTrigger className="h-8 text-xs" style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border)" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["email", "phone", "linkedin", "sms"].map((c) => (
                    <SelectItem key={c} value={c} className="text-xs capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: "var(--sh-fg-3)" }}>Subject</Label>
            <Input className="h-8 text-xs" style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border)" }} placeholder="Re: Business Acquisition Inquiry" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: "var(--sh-fg-3)" }}>Message / Notes</Label>
            <Textarea className="text-xs resize-none" style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border)" }} rows={3} placeholder="Initial outreach email sent..." value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" style={{ borderColor: "var(--sh-border)", background: "transparent" }} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" className="h-8 text-xs" disabled={!form.dealId || createOutreach.isPending}>
              {createOutreach.isPending ? "Logging..." : "Log Contact"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Outreach() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data: outreachList, isLoading, refetch } = trpc.outreach.list.useQuery();
  const { data: deals } = trpc.deals.list.useQuery({ limit: 100 });

  const updateStatus = trpc.outreach.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const dealMap = new Map(deals?.map((d) => [d.id, d]) ?? []);
  const totalContacts = outreachList?.length ?? 0;
  const replied = (outreachList ?? []).filter((o) => ["replied", "meeting_scheduled"].includes(o.status)).length;
  const meetings = (outreachList ?? []).filter((o) => o.status === "meeting_scheduled").length;
  const replyRate = totalContacts > 0 ? Math.round((replied / totalContacts) * 100) : 0;

  return (
    <EditorialTopNav>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="sh-heading-2" style={{ color: "var(--sh-fg-1)" }}>Outreach Pipeline</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--sh-fg-3)" }}>
            {totalContacts} contact{totalContacts !== 1 ? "s" : ""} · {replyRate}% reply rate
          </p>
        </div>
        <AddOutreachDialog deals={deals ?? []} onSuccess={refetch} />
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Contacts", value: totalContacts, accent: "var(--sh-fg-1)" },
          { label: "Replied", value: replied, accent: "var(--sh-emerald)" },
          { label: "Meetings", value: meetings, accent: "oklch(0.65 0.20 300)" },
          { label: "Reply Rate", value: `${replyRate}%`, accent: "var(--sh-primary)" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border p-4"
            style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}
          >
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--sh-fg-3)" }}>{kpi.label}</p>
            <p className="sh-data-lg font-bold" style={{ color: kpi.accent }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ── Outreach list ── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !outreachList?.length ? (
        <div
          className="rounded-xl border flex flex-col items-center justify-center py-20 text-center"
          style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}
        >
          <Mail className="w-12 h-12 mb-4" style={{ color: "var(--sh-fg-3)", opacity: 0.3 }} />
          <p className="text-sm font-medium" style={{ color: "var(--sh-fg-3)" }}>No outreach logged yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--sh-fg-3)", opacity: 0.6 }}>Log your first contact to start tracking the pipeline</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(outreachList ?? []).map((contact) => {
            const deal = dealMap.get(contact.dealId);
            const config = STATUS_CONFIG[contact.status] ?? STATUS_CONFIG.pending;
            const isExpanded = expandedId === contact.id;

            return (
              <div
                key={contact.id}
                className="rounded-xl border transition-colors overflow-hidden"
                style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}
              >
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : contact.id)}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-3)" }}
                  >
                    {CHANNEL_ICON[contact.channel] ?? <Mail className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: "var(--sh-fg-1)" }}>
                        {contact.contactName ?? "Unknown Contact"}
                      </span>
                      {contact.contactRole && (
                        <span className="text-[11px]" style={{ color: "var(--sh-fg-3)" }}>{contact.contactRole}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {deal && (
                        <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--sh-fg-3)" }}>
                          <Building2 className="w-2.5 h-2.5" />{deal.name}
                        </span>
                      )}
                      {contact.subject && (
                        <span className="text-[11px] truncate max-w-xs" style={{ color: "var(--sh-fg-3)" }}>
                          · {contact.subject}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="hidden sm:block text-[11px]" style={{ color: "var(--sh-fg-3)" }}>
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </span>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium", config.color)}>
                      {config.icon}{config.label}
                    </span>
                    {isExpanded
                      ? <ChevronUp className="w-3.5 h-3.5" style={{ color: "var(--sh-fg-3)" }} />
                      : <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--sh-fg-3)" }} />
                    }
                  </div>
                </div>

                {isExpanded && (
                  <div
                    className="px-4 pb-4 pt-3 space-y-3 border-t"
                    style={{ borderColor: "var(--sh-border)" }}
                  >
                    {contact.body && (
                      <div className="rounded-lg p-3" style={{ background: "var(--sh-surface-2)" }}>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--sh-fg-3)" }}>
                          {contact.body}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px]" style={{ color: "var(--sh-fg-3)" }}>Update status:</span>
                      {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                        <button
                          key={status}
                          onClick={() => updateStatus.mutate({ id: contact.id, status: status as "pending"|"sent"|"opened"|"replied"|"meeting_scheduled"|"no_response"|"not_interested"|"closed" })}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-opacity",
                            contact.status === status ? cfg.color : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
                          )}
                        >
                          {cfg.icon}{cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </EditorialTopNav>
  );
}

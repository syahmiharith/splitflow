import { CheckCircle2, Clock3, RotateCcw, XCircle } from "lucide-react";
import type { ParticipantStatus, ProposalStatus } from "@/lib/types";
import { humanStatus } from "@/lib/format";

type BadgeTone = "blue" | "green" | "amber" | "red" | "violet" | "gray";

const toneClass: Record<BadgeTone, string> = {
  blue: "border-blue-100 bg-blue-50 text-app-blue",
  green: "border-green-100 bg-green-50 text-app-green",
  amber: "border-amber-100 bg-amber-50 text-app-amber",
  red: "border-red-100 bg-red-50 text-app-red",
  violet: "border-violet-100 bg-violet-50 text-app-violet",
  gray: "border-slate-200 bg-slate-50 text-slate-600"
};

function statusTone(status: ParticipantStatus | ProposalStatus | string): BadgeTone {
  if (status === "accepted" || status === "paid" || status === "safe_to_book" || status === "settled") return "green";
  if (status === "pending" || status === "not_sent" || status === "waiting_for_responses" || status === "draft") return "amber";
  if (status === "requested_changes" || status === "changes_requested" || status === "needs_reconfirmation") return "violet";
  if (status === "opted_out") return "red";
  if (status === "booked" || status === "settling" || status === "sent") return "blue";
  return "gray";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "accepted" || status === "paid" || status === "safe_to_book") return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
  if (status === "requested_changes" || status === "needs_reconfirmation") return <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />;
  if (status === "opted_out") return <XCircle className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />;
}

export function StatusBadge({ status, label }: { status: ParticipantStatus | ProposalStatus | string; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${toneClass[statusTone(status)]}`}>
      <StatusIcon status={status} />
      {label ?? humanStatus(status)}
    </span>
  );
}

"use client";

import { Check, CreditCard, MoreHorizontal, Send, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { formatKrw, humanStatus } from "@/lib/format";
import { useSplitFlow } from "@/lib/store";
import type { PaymentRecord, Proposal } from "@/lib/types";
import { ArtifactSummary } from "@/components/workspace-detail/artifact-summary";
import { PanelAction } from "@/components/workspace-detail/panel-action";
import { ProposalPanelBody } from "@/components/workspace-detail/proposal-panel-body";
import { StatusBadge } from "@/components/ui/status-badge";

export function WorkspaceDetailPanel({
  fallbackProposal,
  desktopPersistent = false
}: {
  fallbackProposal?: Proposal;
  desktopPersistent?: boolean;
}) {
  const {
    state,
    activeGroup,
    selectedArtifact,
    selectedPanelProposal,
    sendProposal,
    acceptRequestedChange,
    markPaid,
    markSettled,
    resolveAllocation,
    updateCreditStatus,
    closePanel
  } = useSplitFlow();
  const proposal = selectedPanelProposal ?? (selectedArtifact?.proposalId ? activeGroup.proposals.find((item) => item.id === selectedArtifact.proposalId) : undefined) ?? fallbackProposal;
  const claimedCredit = proposal?.paymentRecords?.find((record) => record.status === "claimed");
  const payableParticipant = proposal?.participants.find((participant) => participant.id !== proposal.organizerId && participant.id !== "you" && participant.status !== "opted_out");
  const isOpen = Boolean(state.workspacePanel || fallbackProposal);

  if (!isOpen && !desktopPersistent) return null;

  return (
    <aside
      className={`${isOpen ? "fixed inset-0 z-40 h-[100dvh]" : "hidden"} flex min-h-0 w-full flex-col border-t border-app-border bg-white lg:static lg:z-auto lg:flex lg:h-auto lg:min-h-[520px] lg:w-[420px] lg:border-l lg:border-t-0`}
      data-testid="workspace-detail-panel"
      aria-hidden={!isOpen && desktopPersistent}
    >
      <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-app-border bg-white px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">
            {selectedArtifact ? humanStatus(selectedArtifact.type) : "Trip Split"}
          </div>
          <h2 className="mt-1 text-lg font-bold text-app-text">{selectedArtifact?.title ?? proposal?.title ?? "Workspace detail"}</h2>
          {proposal ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={proposal.status} />
              <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-bold text-app-text">{formatKrw(proposal.calculationResult?.totalCost ?? proposal.totalCost)}</span>
            </div>
          ) : null}
        </div>
        {isOpen ? (
          <button type="button" onClick={closePanel} className="grid h-9 w-9 place-items-center rounded-lg border border-app-border text-app-muted hover:bg-slate-50" aria-label="Close panel">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {selectedArtifact ? <ArtifactSummary artifact={selectedArtifact} /> : null}
        {proposal ? (
          <ProposalPanelBody proposal={proposal} />
        ) : (
          <div className="rounded-lg border border-dashed border-app-border bg-slate-50 px-4 py-5">
            <p className="text-sm font-semibold text-app-text">Select a split or detail</p>
            <p className="mt-2 text-sm leading-6 text-app-muted">
              Desktop keeps this panel open so split details, payment notes, and next actions stay visible while you review the chat.
            </p>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 grid gap-2 border-t border-app-border bg-white p-4" data-testid="workspace-panel-footer">
        {proposal ? (
          <ProposalPanelActions
            proposal={proposal}
            claimedCredit={claimedCredit}
            onConfirmCredit={() => claimedCredit ? updateCreditStatus(claimedCredit.id, "confirmed") : undefined}
            onDisputeCredit={() => claimedCredit ? updateCreditStatus(claimedCredit.id, "disputed") : undefined}
            onVoidCredit={() => claimedCredit ? updateCreditStatus(claimedCredit.id, "void") : undefined}
            onSendProposal={() => sendProposal(proposal.id)}
            onAcceptChange={() => acceptRequestedChange(proposal.id)}
            onMarkPaid={() => payableParticipant ? markPaid(payableParticipant.id, proposal.id) : undefined}
            onMarkSettled={() => markSettled(proposal.id)}
          />
        ) : selectedArtifact?.type === "allocation_resolution" ? (
          <>
            <PanelAction testId="panel-use-equal-allocation" icon={Check} label="Use equal item allocation" onClick={() => resolveAllocation("single_total_equal_items")} primary />
            <PanelAction testId="panel-combine-allocation" icon={CreditCard} label="Combine as one shared item" onClick={() => resolveAllocation("unallocated_remainder")} />
            <PanelAction testId="panel-close" icon={X} label="Cancel" onClick={closePanel} />
          </>
        ) : isOpen ? (
          <PanelAction testId="panel-close" icon={X} label="Close panel" onClick={closePanel} />
        ) : (
          <div className="rounded-lg border border-app-border bg-slate-50 px-3 py-3 text-sm text-app-muted">
            No active review selected.
          </div>
        )}
      </div>
    </aside>
  );
}

function ProposalPanelActions({
  proposal,
  claimedCredit,
  onConfirmCredit,
  onDisputeCredit,
  onVoidCredit,
  onSendProposal,
  onAcceptChange,
  onMarkPaid,
  onMarkSettled
}: {
  proposal: Proposal;
  claimedCredit?: PaymentRecord;
  onConfirmCredit: () => void;
  onDisputeCredit: () => void;
  onVoidCredit: () => void;
  onSendProposal: () => void;
  onAcceptChange: () => void;
  onMarkPaid: () => void;
  onMarkSettled: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const needsOrganizerDecision = proposal.status === "changes_requested" || proposal.status === "recalculation_needed";
  const shouldSend = proposal.status === "draft";

  if (claimedCredit) {
    return (
      <>
        <PanelAction testId="panel-confirm-credit" icon={Check} label="Confirm payment note" onClick={onConfirmCredit} primary />
        <PanelAction testId="panel-dispute-credit" icon={X} label="Dispute payment note" onClick={onDisputeCredit} />
        <OverflowActions open={moreOpen} onToggle={() => setMoreOpen((current) => !current)}>
          <PanelAction testId="panel-void-credit" icon={X} label="Void claimed credit" onClick={onVoidCredit} />
          <PanelAction testId="panel-send-proposal" icon={Send} label="Send to friends" onClick={onSendProposal} />
          <PanelAction testId="panel-mark-settled" icon={CreditCard} label="Mark collected" onClick={onMarkSettled} />
        </OverflowActions>
      </>
    );
  }

  if (shouldSend) {
    return (
      <>
        <PanelAction testId="panel-send-proposal" icon={Send} label="Send to friends" onClick={onSendProposal} primary />
        <PanelAction testId="panel-mark-settled" icon={CreditCard} label="Mark collected" onClick={onMarkSettled} />
        <OverflowActions open={moreOpen} onToggle={() => setMoreOpen((current) => !current)}>
          <PanelAction testId="panel-accept-change" icon={Check} label="Use change" onClick={onAcceptChange} />
          <PanelAction testId="panel-mark-paid" icon={CreditCard} label="Mark friend paid" onClick={onMarkPaid} />
        </OverflowActions>
      </>
    );
  }

  if (needsOrganizerDecision) {
    return (
      <>
        <PanelAction testId="panel-accept-change" icon={Check} label="Use change" onClick={onAcceptChange} primary />
        <PanelAction testId="panel-mark-settled" icon={CreditCard} label="Mark collected" onClick={onMarkSettled} />
        <OverflowActions open={moreOpen} onToggle={() => setMoreOpen((current) => !current)}>
          <PanelAction testId="panel-send-proposal" icon={Send} label="Send to friends" onClick={onSendProposal} />
          <PanelAction testId="panel-mark-paid" icon={CreditCard} label="Mark friend paid" onClick={onMarkPaid} />
        </OverflowActions>
      </>
    );
  }

  return (
    <>
      <PanelAction testId="panel-mark-settled" icon={CreditCard} label="Mark collected" onClick={onMarkSettled} primary />
      <PanelAction testId="panel-send-proposal" icon={Send} label="Send to friends" onClick={onSendProposal} />
      <OverflowActions open={moreOpen} onToggle={() => setMoreOpen((current) => !current)}>
        <PanelAction testId="panel-accept-change" icon={Check} label="Use change" onClick={onAcceptChange} />
        <PanelAction testId="panel-mark-paid" icon={CreditCard} label="Mark friend paid" onClick={onMarkPaid} />
      </OverflowActions>
    </>
  );
}

function OverflowActions({ children, open, onToggle }: { children: ReactNode; open: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <button
        type="button"
        data-testid="workspace-panel-more-actions"
        onClick={onToggle}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-app-border bg-white px-3 text-sm font-semibold text-app-text hover:bg-slate-50"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4 text-app-blue" aria-hidden="true" />
        More actions
      </button>
      {open ? (
        <div className="mt-2 grid gap-2 rounded-lg border border-app-border bg-slate-50 p-2" data-testid="workspace-panel-overflow-actions">
          {children}
        </div>
      ) : null}
    </div>
  );
}

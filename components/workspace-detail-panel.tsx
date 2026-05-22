"use client";

import { Check, CreditCard, Send, X } from "lucide-react";
import { formatKrw, humanStatus } from "@/lib/format";
import { useSplitFlow } from "@/lib/store";
import type { Artifact, Proposal } from "@/lib/types";
import { StatusBadge } from "@/components/ui/status-badge";

export function WorkspaceDetailPanel({ fallbackProposal }: { fallbackProposal?: Proposal }) {
  const {
    state,
    activeGroup,
    selectedArtifact,
    selectedPanelProposal,
    sendProposal,
    acceptRequestedChange,
    markPaid,
    markSettled,
    closePanel
  } = useSplitFlow();
  const proposal = selectedPanelProposal ?? (selectedArtifact?.proposalId ? activeGroup.proposals.find((item) => item.id === selectedArtifact.proposalId) : undefined) ?? fallbackProposal;

  if (!state.workspacePanel && !fallbackProposal) return null;

  return (
    <aside className="flex min-h-[520px] w-full flex-col border-t border-app-border bg-white lg:w-[420px] lg:border-l lg:border-t-0" data-testid="workspace-detail-panel">
      <div className="flex items-start gap-3 border-b border-app-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">
            {selectedArtifact ? humanStatus(selectedArtifact.type) : "Proposal detail"}
          </div>
          <h2 className="mt-1 text-lg font-bold text-app-text">{selectedArtifact?.title ?? proposal?.title ?? "Workspace detail"}</h2>
          {proposal ? <div className="mt-2"><StatusBadge status={proposal.status} /></div> : null}
        </div>
        <button type="button" onClick={closePanel} className="grid h-9 w-9 place-items-center rounded-lg border border-app-border text-app-muted hover:bg-slate-50" aria-label="Close panel">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {selectedArtifact ? <ArtifactSummary artifact={selectedArtifact} /> : null}
        {proposal ? <ProposalPanelBody proposal={proposal} /> : <p className="text-sm text-app-muted">Select an artifact or proposal to inspect details.</p>}
      </div>

      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] grid gap-2 border-t border-app-border bg-white p-4 lg:bottom-0" data-testid="workspace-panel-footer">
        {proposal ? (
          <>
            <PanelAction testId="panel-send-proposal" icon={Send} label="Send proposal" onClick={() => sendProposal(proposal.id)} />
            <PanelAction testId="panel-accept-change" icon={Check} label="Accept change" onClick={() => acceptRequestedChange(proposal.id)} />
            <PanelAction testId="panel-mark-paid" icon={CreditCard} label="Mark Daniel paid" onClick={() => markPaid("daniel", proposal.id)} />
            <PanelAction testId="panel-mark-settled" icon={CreditCard} label="Mark settled" onClick={() => markSettled(proposal.id)} primary />
          </>
        ) : (
          <PanelAction testId="panel-close" icon={X} label="Close panel" onClick={closePanel} />
        )}
      </div>
    </aside>
  );
}

function ArtifactSummary({ artifact }: { artifact: Artifact }) {
  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50 p-3">
      <div className="text-sm font-semibold text-app-blue">Artifact preview</div>
      <p className="mt-2 text-sm leading-6 text-app-text">{artifact.summary}</p>
      {artifact.details && artifact.details.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm leading-6 text-app-text">
          {artifact.details.map((detail) => (
            <li key={detail} className="rounded-md bg-white/70 px-2 py-1">
              {detail}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ProposalPanelBody({ proposal }: { proposal: Proposal }) {
  const calculation = proposal.calculationResult;
  return (
    <>
      <section className="grid grid-cols-2 gap-2">
        <Metric label="Total" value={formatKrw(calculation?.totalCost ?? proposal.totalCost)} />
        <Metric label="Participants" value={String(proposal.participants.length)} />
      </section>

      <section>
        <h3 className="text-sm font-bold">Itemized costs</h3>
        <div className="mt-2 space-y-2">
          {proposal.costItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-app-border px-3 py-2 text-sm">
              <span>{item.label}</span>
              <span className="font-semibold">{formatKrw(item.amount)}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-bold">Participant balances</h3>
        <div className="mt-2 space-y-2">
          {proposal.participants.map((participant) => {
            const net = calculation?.netBalanceByParticipant[participant.id] ?? -participant.shareAmount;
            return (
              <div key={participant.id} className="rounded-lg border border-app-border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{participant.name}</span>
                  <span className={net >= 0 ? "font-bold text-app-green" : "font-bold text-app-red"}>{formatKrw(net)}</span>
                </div>
                <div className="mt-1 text-xs text-app-muted">{humanStatus(participant.status)}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-bold">Settlement plan</h3>
        <div className="mt-2 space-y-2">
          {calculation?.settlementInstructions.map((instruction) => (
            <div key={`${instruction.fromParticipantId}-${instruction.toParticipantId}-${instruction.amount}`} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm">
              {instruction.text}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-bold">Timeline</h3>
        <div className="mt-2 space-y-2">
          {(proposal.timeline ?? []).map((event) => (
            <div key={event.id} className="rounded-lg border border-app-border px-3 py-2 text-sm">
              <div className="font-medium">{event.actor}</div>
              <div className="text-app-muted">{event.text}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-app-border bg-slate-50 px-3 py-2">
      <div className="text-xs text-app-muted">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  );
}

function PanelAction({ icon: Icon, label, onClick, testId, primary = false }: { icon: typeof Send; label: string; onClick: () => void; testId: string; primary?: boolean }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold ${
        primary ? "bg-app-blue text-white hover:bg-blue-700" : "border border-app-border bg-white text-app-text hover:bg-slate-50"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

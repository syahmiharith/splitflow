"use client";

import { Check, Copy, CreditCard, MoreHorizontal, Send, UserRoundCheck, X } from "lucide-react";
import { useEffect, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { formatKrw, humanStatus } from "@/lib/format";
import { deriveSplitReadiness } from "@/lib/readiness";
import { useSplitFlow } from "@/lib/store";
import type { PaymentRecord, Proposal } from "@/lib/types";
import type { ProposalHistoryResult } from "@/lib/workflow/schema";
import { ArtifactSummary } from "@/components/workspace-detail/artifact-summary";
import { PanelAction } from "@/components/workspace-detail/panel-action";
import { ProposalPanelBody } from "@/components/workspace-detail/proposal-panel-body";
import { StatusBadge } from "@/components/ui/status-badge";

type HistoryTab = "review" | "versions" | "artifacts" | "run";

const historyTabs: Array<{ id: HistoryTab; label: string }> = [
  { id: "review", label: "Review" },
  { id: "versions", label: "Versions" },
  { id: "artifacts", label: "Artifacts" },
  { id: "run", label: "Run" }
];

export function WorkspaceDetailPanel({
  fallbackProposal
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
    rejectRequestedChange,
    markSettled,
    resolveAllocation,
    updateCreditStatus,
    closePanel
  } = useSplitFlow();
  const proposal = selectedPanelProposal ?? (selectedArtifact?.proposalId ? activeGroup.proposals.find((item) => item.id === selectedArtifact.proposalId) : undefined) ?? fallbackProposal;
  const claimedCredit = proposal?.paymentRecords?.find((record) => record.status === "claimed");
  const isOpen = Boolean(state.workspacePanel || fallbackProposal);
  const [activeTab, setActiveTab] = useState<HistoryTab>("review");
  const [history, setHistory] = useState<ProposalHistoryResult | undefined>();
  const [historyError, setHistoryError] = useState<string | undefined>();
  const [panelWidth, setPanelWidth] = useState(420);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    const savedWidth = Number(window.localStorage.getItem("splitflow-workspace-panel-width"));
    if (Number.isFinite(savedWidth) && savedWidth > 0) {
      setPanelWidth(clampPanelWidth(savedWidth));
    }
  }, []);

  useEffect(() => {
    if (!resizing) return;

    function onPointerMove(event: PointerEvent) {
      setPanelWidth(clampPanelWidth(window.innerWidth - event.clientX));
    }

    function onPointerUp() {
      setResizing(false);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [resizing]);

  useEffect(() => {
    if (!resizing) {
      window.localStorage.setItem("splitflow-workspace-panel-width", String(panelWidth));
    }
  }, [panelWidth, resizing]);

  useEffect(() => {
    if (!proposal?.id || !isOpen) {
      setHistory(undefined);
      setHistoryError(undefined);
      setActiveTab("review");
      return;
    }

    let cancelled = false;
    setHistoryError(undefined);
    fetch(`/api/workflow/proposals/${proposal.id}/history?groupId=${activeGroup.id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Proposal history unavailable.");
        return response.json() as Promise<ProposalHistoryResult>;
      })
      .then((payload) => {
        if (!cancelled) setHistory(payload);
      })
      .catch((error) => {
        if (!cancelled) setHistoryError(error instanceof Error ? error.message : "Proposal history unavailable.");
      });

    return () => {
      cancelled = true;
    };
  }, [activeGroup.id, isOpen, proposal?.id, proposal?.status, proposal?.updatedAt, proposal?.version]);

  if (!isOpen) return null;

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    setResizing(true);
    setPanelWidth(clampPanelWidth(window.innerWidth - event.clientX));
  }

  function resetResize() {
    setPanelWidth(420);
  }

  return (
    <aside
      className="fixed right-0 top-0 z-40 flex h-dvh min-h-0 max-w-[100vw] translate-x-0 flex-col border-l border-app-border bg-white shadow-[0_18px_45px_rgba(24,33,47,0.18)] transition-transform duration-200 ease-out"
      data-testid="workspace-detail-panel"
      aria-label="Workspace detail panel"
      style={{ width: `min(100vw, ${panelWidth}px)` }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize workspace detail panel"
        tabIndex={0}
        data-testid="workspace-panel-resize-handle"
        onPointerDown={startResize}
        onDoubleClick={resetResize}
        className="absolute left-0 top-0 z-20 h-full w-3 -translate-x-1/2 cursor-col-resize touch-none"
      >
        <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-transparent transition-colors hover:bg-app-blue" aria-hidden="true" />
      </div>

      <div className="flex shrink-0 items-start gap-3 border-b border-app-border bg-white px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">
            {selectedArtifact ? humanStatus(selectedArtifact.type) : "Split"}
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

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4" data-testid="workspace-panel-body">
        {proposal ? (
          <>
            <HistoryTabs activeTab={activeTab} onChange={setActiveTab} />
            {historyError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-app-text">
                {historyError}
              </div>
            ) : null}
            {activeTab === "review" ? (
              <>
                {selectedArtifact ? <ArtifactSummary artifact={selectedArtifact} /> : null}
                <ProposalPanelBody proposal={proposal} />
              </>
            ) : activeTab === "versions" ? (
              <VersionHistoryPanel history={history} />
            ) : activeTab === "artifacts" ? (
              <ArtifactHistoryPanel history={history} />
            ) : (
              <RunTimelinePanel history={history} />
            )}
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-app-border bg-slate-50 px-4 py-5">
            <p className="text-sm font-semibold text-app-text">Select a split or detail</p>
            <p className="mt-2 text-sm leading-6 text-app-muted">Split details, payment notes, and next actions appear here after selection.</p>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 grid shrink-0 gap-2 border-t border-app-border bg-white p-4" data-testid="workspace-panel-footer">
        {proposal ? (
          <ProposalPanelActions
            proposal={proposal}
            claimedCredit={claimedCredit}
            onConfirmCredit={() => claimedCredit ? updateCreditStatus(claimedCredit.id, "confirmed") : undefined}
            onDisputeCredit={() => claimedCredit ? updateCreditStatus(claimedCredit.id, "disputed") : undefined}
            onVoidCredit={() => claimedCredit ? updateCreditStatus(claimedCredit.id, "void") : undefined}
            onSendProposal={() => sendProposal(proposal.id)}
            onAcceptChange={() => acceptRequestedChange(proposal.id)}
            onRejectChange={() => rejectRequestedChange(proposal.id)}
            onMarkSettled={() => markSettled(proposal.id)}
            onViewShare={() => {
              window.location.href = `/groups/${activeGroup.id}/inbox`;
            }}
            onCopyReminder={() => {
              void navigator.clipboard?.writeText(`Please review ${proposal.title} in SplitFlow so we can settle safely.`);
            }}
            onCopySummary={() => {
              void navigator.clipboard?.writeText(`${proposal.title}: ${formatKrw(proposal.calculationResult?.totalCost ?? proposal.totalCost)} ${humanStatus(proposal.status)}.`);
            }}
            onClose={closePanel}
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

function clampPanelWidth(value: number): number {
  if (typeof window === "undefined") return Math.min(720, Math.max(360, value));
  const maxWidth = Math.min(720, Math.floor(window.innerWidth * 0.9));
  const minWidth = Math.min(360, maxWidth);
  return Math.min(maxWidth, Math.max(minWidth, value));
}

function HistoryTabs({ activeTab, onChange }: { activeTab: HistoryTab; onChange: (tab: HistoryTab) => void }) {
  return (
    <div className="grid grid-cols-4 rounded-lg border border-app-border bg-slate-50 p-1" data-testid="proposal-history-tabs">
      {historyTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`min-h-9 rounded-md px-2 text-xs font-bold ${activeTab === tab.id ? "bg-white text-app-blue shadow-sm" : "text-app-muted hover:text-app-text"}`}
          aria-pressed={activeTab === tab.id}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function VersionHistoryPanel({ history }: { history?: ProposalHistoryResult }) {
  if (!history) return <PanelEmptyState text="Loading immutable proposal versions..." />;

  return (
    <div className="space-y-3" data-testid="proposal-version-history">
      {history.versions.map((version) => (
        <div key={version.id} className="rounded-lg border border-app-border bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-app-text">v{version.version} {humanStatus(version.transitionType)}</p>
              <p className="mt-1 break-words text-sm leading-5 text-app-muted">{version.reason}</p>
            </div>
            <span className="shrink-0 rounded-md bg-slate-50 px-2 py-1 text-xs font-bold text-app-text">
              {version.amountChanges} changes
            </span>
          </div>
          <div className="mt-3 grid gap-1 text-xs font-semibold text-app-muted">
            <span>Actor: {version.actor}</span>
            <span>Parent: {version.parentVersionId ?? "none"}</span>
            <span suppressHydrationWarning>{formatDate(version.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ArtifactHistoryPanel({ history }: { history?: ProposalHistoryResult }) {
  if (!history) return <PanelEmptyState text="Loading artifact lifecycle..." />;

  const activeArtifacts = history.artifacts.filter((artifact) => artifact.active);
  const historicalArtifacts = history.artifacts.filter((artifact) => !artifact.active);
  const artifacts = [...activeArtifacts, ...historicalArtifacts];

  if (artifacts.length === 0) return <PanelEmptyState text="No proposal artifacts recorded yet." />;

  return (
    <div className="space-y-3" data-testid="artifact-history-list">
      {artifacts.map((artifact) => (
        <div key={artifact.id} className="rounded-lg border border-app-border bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-bold text-app-text">{artifact.title}</p>
              <p className="mt-1 text-xs font-semibold uppercase text-app-muted">{humanStatus(artifact.kind)}</p>
            </div>
            <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${artifact.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-app-muted"}`}>
              {humanStatus(artifact.state)}
            </span>
          </div>
          <div className="mt-3 grid gap-1 text-xs font-semibold text-app-muted">
            <span>Run: {shortId(artifact.runId)}</span>
            <span>Version: {artifact.proposalVersionId ?? "unlinked"}</span>
            {artifact.supersedesArtifactId ? <span>Supersedes: {shortId(artifact.supersedesArtifactId)}</span> : null}
            {artifact.supersededByArtifactId ? <span>Superseded by: {shortId(artifact.supersededByArtifactId)}</span> : null}
            <span suppressHydrationWarning>{formatDate(artifact.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RunTimelinePanel({ history }: { history?: ProposalHistoryResult }) {
  if (!history) return <PanelEmptyState text="Loading run events..." />;
  const events = history.runs.flatMap((run) => run.events.map((event) => ({ ...event, status: run.status, retryCount: run.retryCount })));
  if (events.length === 0) return <PanelEmptyState text="No persisted run events are linked to this proposal yet." />;

  return (
    <div className="space-y-2" data-testid="run-event-timeline">
      {events.map((event) => (
        <div key={event.id} className="rounded-lg border border-app-border bg-white px-3 py-2" data-testid={`run-event-row-${event.id}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-app-text">{humanStatus(event.type)}</p>
              <p className="mt-1 break-words text-sm leading-5 text-app-muted">{eventDetail(event)}</p>
            </div>
            <span className="shrink-0 rounded-md bg-slate-50 px-2 py-1 text-xs font-bold text-app-text" suppressHydrationWarning>
              {formatDate(event.at)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PanelEmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-app-border bg-slate-50 px-4 py-5 text-sm font-semibold text-app-muted">
      {text}
    </div>
  );
}

function eventDetail(event: ProposalHistoryResult["runs"][number]["events"][number]): string {
  if ("detail" in event && event.detail) return event.detail;
  if (event.type === "artifact_staged") return `Artifact ${shortId(event.artifactId)} staged.`;
  return humanStatus(event.type);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function shortId(value?: string): string {
  return value ? value.slice(0, 8) : "none";
}

function ProposalPanelActions({
  proposal,
  claimedCredit,
  onConfirmCredit,
  onDisputeCredit,
  onVoidCredit,
  onSendProposal,
  onAcceptChange,
  onRejectChange,
  onMarkSettled,
  onViewShare,
  onCopyReminder,
  onCopySummary,
  onClose
}: {
  proposal: Proposal;
  claimedCredit?: PaymentRecord;
  onConfirmCredit: () => void;
  onDisputeCredit: () => void;
  onVoidCredit: () => void;
  onSendProposal: () => void;
  onAcceptChange: () => void;
  onRejectChange: () => void;
  onMarkSettled: () => void;
  onViewShare: () => void;
  onCopyReminder: () => void;
  onCopySummary: () => void;
  onClose: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const readiness = deriveSplitReadiness(proposal);
  const needsOrganizerDecision = proposal.status === "changes_requested" || proposal.status === "recalculation_needed" || readiness.changeRequests > 0;
  const waitingForResponses = proposal.status === "sent" || proposal.status === "waiting_for_responses";
  const shouldSend = proposal.status === "draft";

  if (claimedCredit) {
    return (
      <>
        <PanelAction testId="panel-confirm-credit" icon={Check} label="Confirm claim" onClick={onConfirmCredit} primary />
        <PanelAction testId="panel-dispute-credit" icon={X} label="Dispute claim" onClick={onDisputeCredit} />
        <OverflowActions open={moreOpen} onToggle={() => setMoreOpen((current) => !current)}>
          <PanelAction testId="panel-void-credit" icon={X} label="Void claim" onClick={onVoidCredit} />
          {shouldSend ? <PanelAction testId="panel-send-proposal" icon={Send} label="Send split" onClick={onSendProposal} /> : null}
          {needsOrganizerDecision ? <PanelAction testId="panel-accept-change" icon={Check} label="Accept change" onClick={onAcceptChange} /> : null}
        </OverflowActions>
      </>
    );
  }

  if (shouldSend) {
    return (
      <>
        <PanelAction testId="panel-send-proposal" icon={Send} label="Send split" onClick={onSendProposal} primary />
        <PanelAction testId="panel-view-share" icon={UserRoundCheck} label="View Your Share" onClick={onViewShare} />
      </>
    );
  }

  if (needsOrganizerDecision) {
    return (
      <>
        <PanelAction testId="panel-accept-change" icon={Check} label="Accept change" onClick={onAcceptChange} primary />
        <PanelAction testId="panel-reject-change" icon={X} label="Reject change" onClick={onRejectChange} />
        <OverflowActions open={moreOpen} onToggle={() => setMoreOpen((current) => !current)}>
          <PanelAction testId="panel-copy-reminder" icon={Copy} label="Copy reminder" onClick={onCopyReminder} />
        </OverflowActions>
      </>
    );
  }

  if (waitingForResponses || proposal.status === "needs_reconfirmation") {
    return (
      <>
        <PanelAction testId="panel-copy-reminder" icon={Copy} label="Copy reminder" onClick={onCopyReminder} primary />
        <PanelAction testId="panel-view-share" icon={UserRoundCheck} label="View Your Share" onClick={onViewShare} />
      </>
    );
  }

  if (readiness.state === "ready") {
    return <PanelAction testId="panel-mark-settled" icon={CreditCard} label="Mark settled" onClick={onMarkSettled} primary />;
  }

  if (readiness.state === "settled") {
    return (
      <>
        <PanelAction testId="panel-close" icon={X} label="Close" onClick={onClose} primary />
        <PanelAction testId="panel-copy-summary" icon={Copy} label="Copy summary" onClick={onCopySummary} />
      </>
    );
  }

  return (
    <>
      <PanelAction testId="panel-copy-reminder" icon={Copy} label="Copy reminder" onClick={onCopyReminder} primary />
      <PanelAction testId="panel-view-share" icon={UserRoundCheck} label="View Your Share" onClick={onViewShare} />
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

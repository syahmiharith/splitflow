"use client";

import { FormEvent, useMemo, useState } from "react";
import { Send, UserCheck, UserMinus, UserPen } from "lucide-react";
import type { OrchestratorResponse } from "@/lib/agents/agent-types";
import { formatAmount } from "@/lib/domain/money";

const scenarios = [
  "Split a ₩480,000 Busan Airbnb between 5 people. Amir stays 1 night and everyone else stays 2 nights.",
  "Split a ₩120,000 dinner equally between 4 people.",
  "Split a ₩300,000 group gift where Aina pays ₩50,000 fixed and the rest split the remaining amount between 3 people."
];

async function callAgent(body: Record<string, unknown>): Promise<OrchestratorResponse> {
  const response = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as OrchestratorResponse;
  if (!response.ok) {
    throw new Error("Agent request failed.");
  }
  return payload;
}

export default function AgentLabPage() {
  const [message, setMessage] = useState(scenarios[0]);
  const [result, setResult] = useState<OrchestratorResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const proposal = result?.proposal;
  const activeParticipants = useMemo(() => proposal?.participants ?? [], [proposal]);
  const sdk = result?.runtime?.openAiAgentsSdk;
  const sdkTraceCount = result?.trace.filter((step) => step.action === "run_openai_agents_sdk").length ?? 0;

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(await callAgent({ type: "user_message", message }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Agent request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendProposal() {
    if (!proposal) return;
    setBusy(true);
    setResult(await callAgent({ type: "send_proposal", proposalId: proposal.id }));
    setBusy(false);
  }

  async function respond(participantId: string, response: "accepted" | "opted_out" | "requested_change") {
    if (!proposal) return;
    setBusy(true);
    setResult(
      await callAgent({
        type: "participant_response",
        proposalId: proposal.id,
        participantId,
        response,
        note: response === "requested_change" ? "I joined late and need this adjusted." : undefined
      })
    );
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-5 md:p-6" data-testid="agent-lab-route">
      <div className="rounded-lg border border-app-border bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-app-text">Agent workflow lab</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-app-muted">
              Test orchestrator-controlled proposal creation, participant responses, recalculation, risk, recommendation, and trace.
            </p>
          </div>
          <button
            type="button"
            onClick={sendProposal}
            disabled={!proposal || busy}
            className="min-h-11 rounded-md border border-app-border px-4 text-sm font-semibold text-app-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send proposal
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario}
              type="button"
              onClick={() => setMessage(scenario)}
              className="min-h-11 rounded-md border border-app-border bg-page px-3 text-left text-xs font-semibold text-app-text"
            >
              {scenario}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-4 flex flex-col gap-3 md:flex-row">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-28 flex-1 rounded-md border border-app-border px-3 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-app-blue px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Run
          </button>
        </form>
        {error ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-app-red">{error}</div> : null}
      </div>

      {result ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-4">
            <div className="rounded-lg border border-app-border bg-white p-4">
              <div className="text-sm font-semibold text-app-muted">Orchestrator message</div>
              <div className="mt-2 text-base font-semibold text-app-text">{result.message}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.nextActions.map((action) => (
                  <span key={action} className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-semibold text-app-blue">
                    {action}
                  </span>
                ))}
              </div>
            </div>

            {proposal ? (
              <div className="rounded-lg border border-app-border bg-white">
                <div className="border-b border-app-border px-4 py-3">
                  <div className="text-lg font-bold text-app-text">{proposal.title}</div>
                  <div className="mt-1 text-sm text-app-muted">
                    {formatAmount(proposal.totalAmount, proposal.currency)} · {proposal.splitMethod} · {proposal.status}
                  </div>
                </div>
                <div className="divide-y divide-app-border">
                  {activeParticipants.map((participant) => (
                    <div key={participant.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="font-semibold text-app-text">{participant.name}</div>
                        <div className="mt-1 text-sm text-app-muted">
                          {formatAmount(participant.amountOwed, proposal.currency)} · {participant.responseStatus}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button type="button" onClick={() => respond(participant.id, "accepted")} className="grid min-h-11 place-items-center rounded-md border border-app-border text-app-green" aria-label={`Accept for ${participant.name}`}>
                          <UserCheck className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => respond(participant.id, "requested_change")} className="grid min-h-11 place-items-center rounded-md border border-app-border text-app-amber" aria-label={`Request change for ${participant.name}`}>
                          <UserPen className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => respond(participant.id, "opted_out")} className="grid min-h-11 place-items-center rounded-md border border-app-border text-app-red" aria-label={`Opt out for ${participant.name}`}>
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <aside className="space-y-4">
            <div className="rounded-lg border border-app-border bg-white p-4">
              <div className="text-sm font-semibold text-app-muted">Runtime</div>
              <div className="mt-3 grid gap-2 text-sm">
                <RuntimeRow testId="agent-backend" label="Backend" value={result.runtime?.backend ?? "unknown"} />
                <RuntimeRow testId="sdk-flag-status" label="SDK flag enabled" value={yesNo(sdk?.envFlagEnabled)} />
                <RuntimeRow testId="sdk-api-key-present" label="API key present" value={yesNo(sdk?.apiKeyPresent)} />
                <RuntimeRow testId="sdk-runtime-created" label="SDK runtime created" value={yesNo(sdk?.runtimeCreated)} />
                <RuntimeRow testId="sdk-attempted" label="SDK attempted" value={yesNo(sdk?.attempted)} />
                <RuntimeRow testId="sdk-invoked" label="SDK invoked" value={yesNo(sdk?.invoked)} />
                <RuntimeRow testId="sdk-returned-output" label="SDK returned output" value={yesNo(sdk?.returnedOutput)} />
                <RuntimeRow testId="sdk-trace-count" label="SDK trace count" value={String(sdkTraceCount)} />
              </div>
            </div>

            {result.risk ? (
              <div className="rounded-lg border border-app-border bg-white p-4">
                <div className="text-sm font-semibold text-app-muted">Risk</div>
                <div className="mt-1 text-lg font-bold text-app-text">{result.risk.level}</div>
                <div className="mt-2 text-sm text-app-muted">{result.risk.recommendedNextAction}</div>
              </div>
            ) : null}

            {result.recommendation ? (
              <div className="rounded-lg border border-app-border bg-white p-4">
                <div className="text-sm font-semibold text-app-muted">Recommendation</div>
                <div className="mt-1 text-base font-bold text-app-text">{result.recommendation.primaryAction}</div>
                <div className="mt-2 text-sm leading-6 text-app-muted">{result.recommendation.reason}</div>
              </div>
            ) : null}

            <div className="rounded-lg border border-app-border bg-white p-4">
              <div className="text-sm font-semibold text-app-muted">Trace</div>
              <div className="mt-3 space-y-2">
                {result.trace.map((step, index) => (
                  <div key={`${step.agent}-${step.action}-${index}`} className="rounded-md border border-app-border px-3 py-2 text-sm">
                    <div className="font-semibold text-app-text">{step.agent}</div>
                    <div className="text-xs text-app-muted">{step.action}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function yesNo(value: boolean | undefined): string {
  return value ? "true" : "false";
}

function RuntimeRow({ testId, label, value }: { testId: string; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-app-border bg-slate-50 px-3 py-2">
      <span className="min-w-0 text-app-muted">{label}</span>
      <span data-testid={testId} className="shrink-0 font-bold text-app-text">
        {value}
      </span>
    </div>
  );
}

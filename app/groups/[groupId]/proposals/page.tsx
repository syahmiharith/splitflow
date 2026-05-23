"use client";

import { FileText, Search } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { formatKrw, humanStatus } from "@/lib/format";
import { filterProposals, type ProposalFilter } from "@/lib/proposal-filters";
import { countParticipants } from "@/lib/split";
import { useSplitFlow } from "@/lib/store";
import { GroupRouteSync } from "@/components/group-route-sync";
import { WorkspaceDetailPanel } from "@/components/workspace-detail-panel";
import { AppCard } from "@/components/ui/app-card";
import { Table } from "@/components/ui/table";
import { useDeviceProfile } from "@/lib/use-device-profile";

const filters: Array<{ label: string; value: ProposalFilter }> = [
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Paid", value: "paid" }
];

export default function GroupProposalsPage() {
  const params = useParams<{ groupId: string }>();
  const { activeGroup, openProposalPanel } = useSplitFlow();
  const device = useDeviceProfile();
  const desktopLayout = device.layoutMode === "desktop";
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProposalFilter>("active");
  const visibleProposals = filterProposals(activeGroup.proposals, filter, query);

  return (
    <div className="flex min-h-[calc(100vh-76px)] flex-col lg:flex-row" data-testid="group-proposals-route">
      <GroupRouteSync groupId={params.groupId} />
      <section className="min-w-0 flex-1 space-y-4 px-4 py-5 md:p-6">
        <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-app-border bg-white px-4 shadow-[0_1px_2px_rgba(24,33,47,0.04)]">
          <Search className="h-6 w-6 text-app-muted" aria-hidden="true" />
          <input
            data-testid="proposal-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-app-muted"
            placeholder={`Search ${activeGroup.name} splits...`}
          />
        </label>

        <div className="flex gap-3 overflow-x-auto pb-1">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              data-testid={`proposal-filter-${item.value}`}
              onClick={() => setFilter(item.value)}
              className={`flex min-h-12 shrink-0 items-center gap-2 rounded-2xl border px-4 text-base font-semibold ${
                filter === item.value ? "border-blue-200 bg-blue-50 text-app-blue" : "border-app-border bg-white text-app-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {visibleProposals.length === 0 ? (
          <AppCard className="p-5 text-sm text-app-muted" data-testid="proposal-empty-state">
            No splits match this search and filter.
          </AppCard>
        ) : null}

        {!desktopLayout ? (
          <div className="space-y-3">
            {visibleProposals.map((proposal) => {
              const counts = countParticipants(proposal);
              return (
                <button
                  key={proposal.id}
                  type="button"
                  data-testid={`proposal-row-${proposal.id}`}
                  onClick={() => openProposalPanel(proposal.id)}
                  className="block w-full rounded-2xl text-left focus:outline-none focus:ring-2 focus:ring-app-blue focus:ring-offset-2"
                >
                  <AppCard className="p-5 hover:border-blue-200 hover:bg-blue-50/40">
                    <div className="flex gap-3">
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-50 text-app-blue">
                        <FileText className="h-7 w-7" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <h2 className="min-w-0 flex-1 truncate text-xl font-bold">{proposal.title}</h2>
                          <span className="shrink-0 rounded-xl bg-blue-50 px-3 py-1.5 text-sm font-semibold text-app-blue">{humanStatus(proposal.status)}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                          <Meta label="Total" value={formatKrw(proposal.totalCost)} />
                          <Meta label="Members" value={String(proposal.participants.length)} />
                          <Meta label="Changes" value={String(counts.changes)} />
                        </div>
                      </div>
                    </div>
                  </AppCard>
                </button>
              );
            })}
          </div>
        ) : null}
        {desktopLayout && visibleProposals.length > 0 ? (
          <Table minWidth="860px">
              <Table.Header>
                <Table.Row>
                  <Table.Head>Split</Table.Head>
                  <Table.Head>Status</Table.Head>
                  <Table.Head numeric>Total</Table.Head>
                  <Table.Head>Members</Table.Head>
                  <Table.Head>Changes</Table.Head>
                  <Table.Head>Split method</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body interactive>
                {visibleProposals.map((proposal) => {
                  const counts = countParticipants(proposal);
                  return (
                    <Table.Row
                      key={proposal.id}
                      data-testid={`proposal-row-${proposal.id}`}
                      onClick={() => openProposalPanel(proposal.id)}
                      className="cursor-pointer"
                    >
                      <Table.Cell>
                        <div className="font-semibold text-app-text">{proposal.title}</div>
                        <div className="mt-1 max-w-md truncate text-xs text-app-muted">{proposal.description}</div>
                      </Table.Cell>
                      <Table.Cell nowrap>
                        <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-app-blue">{humanStatus(proposal.status)}</span>
                      </Table.Cell>
                      <Table.Cell numeric nowrap>{formatKrw(proposal.totalCost)}</Table.Cell>
                      <Table.Cell nowrap>{proposal.participants.length}</Table.Cell>
                      <Table.Cell nowrap>{counts.changes}</Table.Cell>
                      <Table.Cell nowrap>{humanStatus(proposal.splitMethod)}</Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
        ) : null}
      </section>
      <WorkspaceDetailPanel desktopPersistent />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs text-app-muted">{label}</div>
      <div className="mt-1 truncate font-semibold text-app-text">{value}</div>
    </div>
  );
}

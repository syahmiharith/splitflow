"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CheckCircle2, ChevronRight, Clock3, Plus, Users, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { CreateGroupModal } from "@/components/top-header/create-group-modal";
import { AppCard } from "@/components/ui/app-card";
import { deriveGlobalAnalytics, deriveGroupAnalytics } from "@/lib/analytics";
import { formatKrw } from "@/lib/format";
import { useSplitFlow } from "@/lib/store";
import { Table } from "@/components/ui/table";
import { useDeviceProfile } from "@/lib/use-device-profile";

export default function GroupsPage() {
  const { state, createGroup } = useSplitFlow();
  const router = useRouter();
  const device = useDeviceProfile();
  const desktopLayout = device.layoutMode === "desktop";
  const globalSummary = deriveGlobalAnalytics(state.groups);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState("Syahmi, Ali, Sarah, Daniel, Mira, Hakim, Adam, Minji");
  const [organizer, setOrganizer] = useState("Syahmi");
  const [currency, setCurrency] = useState("KRW");
  const [starterPrompt, setStarterPrompt] = useState("");

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const groupId = createGroup({ name: trimmed, description, members: parseMembers(members, organizer) });
    setName("");
    setDescription("");
    setMembers("Syahmi, Ali, Sarah, Daniel, Mira, Hakim, Adam, Minji");
    setOrganizer("Syahmi");
    setCurrency("KRW");
    setStarterPrompt("");
    setCreating(false);
    router.push(`/groups/${groupId}/chat`);
  }

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="groups-route">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Summary icon={Users} label="Groups" value={String(globalSummary.activeGroups)} tone="blue" />
        <Summary icon={CheckCircle2} label="Active splits" value={String(globalSummary.openProposals)} tone="green" />
        <Summary icon={WalletCards} label="Outstanding" value={formatKrw(globalSummary.stillOwed)} tone="amber" />
      </div>

      {!desktopLayout ? (
        <div className="space-y-4">
          {state.groups.map((group) => {
            const summary = deriveGroupAnalytics(group);
            return (
              <AppCard key={group.id} className="p-5">
                <div className="flex gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-blue-50 text-app-blue">
                    <Users className="h-8 w-8" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <h2 className="min-w-0 flex-1 truncate text-xl font-bold sm:text-2xl">{group.name}</h2>
                      <span className="shrink-0 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-semibold text-app-green">
                        {summary.openChangeRequests > 0 ? "Needs review" : "Active"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-app-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        {group.members.length} members
                      </span>
                      <span>{summary.activeProposals} active splits</span>
                      <span className="basis-full inline-flex items-center gap-1.5">
                        <Clock3 className="h-4 w-4" />
                        Updated {new Date(group.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <AvatarStack names={group.members.map((member) => member.name)} />
                      <Link
                        href={`/groups/${group.id}`}
                        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-app-border px-4 text-sm font-semibold text-app-blue hover:bg-slate-50"
                      >
                        Open group
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              </AppCard>
            );
          })}
        </div>
      ) : null}

      {desktopLayout ? (
        <Table minWidth="760px">
          <Table.Header>
            <Table.Row>
              <Table.Head>Group</Table.Head>
              <Table.Head>Members</Table.Head>
              <Table.Head>Active splits</Table.Head>
              <Table.Head numeric>Outstanding</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head align="right">Action</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body interactive>
            {state.groups.map((group) => {
              const summary = deriveGroupAnalytics(group);
              return (
                <Table.Row key={group.id}>
                  <Table.Cell>
                    <div className="font-semibold text-app-text">{group.name}</div>
                    <div className="mt-1 max-w-md truncate text-xs text-app-muted">{group.description}</div>
                  </Table.Cell>
                  <Table.Cell nowrap>{group.members.length}</Table.Cell>
                  <Table.Cell nowrap>{summary.activeProposals}</Table.Cell>
                  <Table.Cell numeric nowrap>{formatKrw(summary.stillOwed)}</Table.Cell>
                  <Table.Cell nowrap>
                    <span className="rounded-md bg-green-50 px-2 py-1 text-xs font-semibold text-app-green">
                      {summary.openChangeRequests > 0 ? "Needs review" : "Active"}
                    </span>
                  </Table.Cell>
                  <Table.Cell align="right" nowrap>
                    <Link
                      href={`/groups/${group.id}`}
                      className="inline-flex min-h-9 items-center justify-center rounded-md border border-app-border px-3 text-sm font-semibold text-app-blue hover:bg-slate-50"
                    >
                      Open
                    </Link>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      ) : null}

      <button
        type="button"
        onClick={() => setCreating(true)}
        className="flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-app-blue text-base font-semibold text-white shadow-soft"
        data-testid="groups-create-group"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        New Group
      </button>
      {creating ? (
        <CreateGroupModal
          name={name}
          description={description}
          members={members}
          organizer={organizer}
          currency={currency}
          starterPrompt={starterPrompt}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onMembersChange={setMembers}
          onOrganizerChange={setOrganizer}
          onCurrencyChange={setCurrency}
          onStarterPromptChange={setStarterPrompt}
          onCancel={() => setCreating(false)}
          onSubmit={onCreate}
        />
      ) : null}
    </div>
  );
}

function parseMembers(value: string, organizer: string): string[] {
  const names = value.split(",").map((item) => item.trim()).filter(Boolean);
  const organizerName = organizer.trim() || names[0] || "Syahmi";
  return [organizerName, ...names.filter((name) => name.toLowerCase() !== organizerName.toLowerCase())];
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string; tone: "blue" | "green" | "amber" }) {
  return (
    <div className="min-w-0 rounded-2xl border border-app-border bg-white p-3 shadow-[0_1px_2px_rgba(24,33,47,0.04)] sm:p-4">
      <div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${tone === "green" ? "bg-green-50 text-app-green" : tone === "amber" ? "bg-amber-50 text-app-amber" : "bg-blue-50 text-app-blue"}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="whitespace-nowrap text-lg font-bold sm:text-2xl">{value}</div>
      <div className="text-xs leading-tight text-app-muted sm:text-sm">{label}</div>
    </div>
  );
}

function AvatarStack({ names }: { names: string[] }) {
  return (
    <div className="flex -space-x-2">
      {names.slice(0, 3).map((name) => (
        <span key={name} className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-slate-200 text-xs font-bold">
          {name.charAt(0).toUpperCase()}
        </span>
      ))}
      {names.length > 3 ? <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-slate-100 text-xs font-bold text-app-muted">+{names.length - 3}</span> : null}
    </div>
  );
}

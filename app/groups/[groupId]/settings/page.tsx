"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Save } from "lucide-react";
import { DemoToolbar } from "@/components/demo-toolbar";
import { GroupRouteSync } from "@/components/group-route-sync";
import { useSplitFlow } from "@/lib/store";

export default function GroupSettingsPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const { activeGroup, updateGroup } = useSplitFlow();
  const [name, setName] = useState(activeGroup.name);
  const [description, setDescription] = useState(activeGroup.description);

  useEffect(() => {
    setName(activeGroup.name);
    setDescription(activeGroup.description);
  }, [activeGroup.description, activeGroup.name]);

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="group-settings-route">
      <GroupRouteSync groupId={groupId} />
      <DemoToolbar compact showLoaders={false} />

      <section className="rounded-lg border border-app-border bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-app-text">Group settings</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-app-muted">
              Manage the selected workspace context used by chat sessions, trip splits, friend review, and payment notes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => updateGroup(activeGroup.id, { name, description })}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-app-blue px-4 text-sm font-semibold text-white hover:bg-blue-700"
            data-testid="save-group-settings"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Save changes
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-app-text">
            Group name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-lg border border-app-border bg-white px-3 py-2 text-sm outline-none focus:border-app-blue focus:ring-2 focus:ring-blue-100"
              data-testid="settings-group-name"
            />
          </label>
          <label className="block text-sm font-semibold text-app-text">
            Group context
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 w-full rounded-lg border border-app-border bg-white px-3 py-2 text-sm outline-none focus:border-app-blue focus:ring-2 focus:ring-blue-100"
              data-testid="settings-group-description"
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-app-border bg-white p-5">
        <h2 className="text-lg font-bold text-app-text">Members</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {activeGroup.members.map((member) => (
            <div key={member.id} className="rounded-lg border border-app-border px-3 py-2">
              <div className="font-semibold">{member.name}</div>
              <div className="mt-1 text-xs text-app-muted">{member.roleNote ?? "Participant"}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

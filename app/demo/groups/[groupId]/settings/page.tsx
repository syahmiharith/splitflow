"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, RotateCcw, Save, ShieldCheck, Users } from "lucide-react";
import { GroupRouteSync } from "@/components/group-route-sync";
import { parseSettingsMembers, validateGroupSettings, type GroupSettingsValidation } from "@/lib/group-settings";
import { useSplitFlow } from "@/lib/store";

export default function GroupSettingsPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const { activeGroup, updateGroup, resetDemo } = useSplitFlow();
  const [name, setName] = useState(activeGroup.name);
  const [description, setDescription] = useState(activeGroup.description);
  const [members, setMembers] = useState(activeGroup.members.map((member) => member.name).join(", "));
  const [errors, setErrors] = useState<GroupSettingsValidation>({});
  const [saved, setSaved] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    setName(activeGroup.name);
    setDescription(activeGroup.description);
    setMembers(activeGroup.members.map((member) => member.name).join(", "));
    setErrors({});
    setSaved(false);
  }, [activeGroup.description, activeGroup.members, activeGroup.name]);

  function onSave() {
    const nextErrors = validateGroupSettings({ name, members });
    setErrors(nextErrors);
    setSaved(false);
    if (nextErrors.name || nextErrors.members) return;

    updateGroup(activeGroup.id, {
      name: name.trim(),
      description: description.trim() || "Shared-cost workspace",
      members: parseSettingsMembers(members, activeGroup.members)
    });
    setSaved(true);
  }

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="group-settings-route">
      <GroupRouteSync groupId={groupId} />

      <section className="rounded-lg border border-app-border bg-white p-5" data-testid="settings-identity-section">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-app-text">Group settings</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-app-muted">
              Manage the selected workspace context used by chat, proposal review, participant responses, and payment notes.
            </p>
          </div>
          <button
            type="button"
            onClick={onSave}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-app-blue px-4 text-sm font-semibold text-white hover:bg-blue-700"
            data-testid="save-group-settings"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Save changes
          </button>
        </div>
        {errors.name || errors.members ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-app-red" data-testid="settings-error">
            {errors.name ?? errors.members}
          </div>
        ) : saved ? (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-app-green" data-testid="settings-saved">
            Group settings saved.
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-app-text">
            Group name
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrors((current) => ({ ...current, name: undefined }));
                setSaved(false);
              }}
              aria-invalid={Boolean(errors.name)}
              className="mt-2 w-full rounded-lg border border-app-border bg-white px-3 py-2 text-sm outline-none focus:border-app-blue focus:ring-2 focus:ring-blue-100"
              data-testid="settings-group-name"
            />
          </label>
          <label className="block text-sm font-semibold text-app-text">
            Group context
            <input
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setSaved(false);
              }}
              className="mt-2 w-full rounded-lg border border-app-border bg-white px-3 py-2 text-sm outline-none focus:border-app-blue focus:ring-2 focus:ring-blue-100"
              data-testid="settings-group-description"
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-app-border bg-white p-5" data-testid="settings-members-section">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-app-blue" aria-hidden="true" />
          <h2 className="text-lg font-bold text-app-text">Members</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-app-muted">
          These members seed chat context and participant review. Existing proposal participants remain auditable records.
        </p>
        <label className="mt-4 block text-sm font-semibold text-app-text">
          Members, comma-separated
          <textarea
            value={members}
            onChange={(event) => {
              setMembers(event.target.value);
              setErrors((current) => ({ ...current, members: undefined }));
              setSaved(false);
            }}
            aria-invalid={Boolean(errors.members)}
            className="mt-2 min-h-24 w-full rounded-lg border border-app-border bg-white px-3 py-2 text-sm outline-none focus:border-app-blue focus:ring-2 focus:ring-blue-100"
            data-testid="settings-group-members"
          />
        </label>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {parseSettingsMembers(members, activeGroup.members).map((member) => (
            <div key={member.id} className="rounded-lg border border-app-border px-3 py-2">
              <div className="font-semibold">{member.name}</div>
              <div className="mt-1 text-xs text-app-muted">{member.roleNote ?? "Participant"}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-app-border bg-white p-5" data-testid="settings-defaults-section">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-app-blue" aria-hidden="true" />
            <h2 className="text-lg font-bold text-app-text">Workflow defaults</h2>
          </div>
          <div className="mt-4 grid gap-3">
            <ReadOnlySetting label="Default organizer" value={activeGroup.members[0]?.name ?? "Syahmi"} />
            <ReadOnlySetting label="Default currency" value="KRW" />
            <ReadOnlySetting label="Payment verification" value="Participant claims require organizer confirmation" />
            <ReadOnlySetting label="AI boundary" value="AI drafts and explains; TypeScript owns final math" />
          </div>
        </div>

        <div className="rounded-lg border border-red-200 bg-white p-5" data-testid="settings-danger-zone">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-app-red" aria-hidden="true" />
            <h2 className="text-lg font-bold text-app-text">Danger zone</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-app-muted">
            Reset only affects local prototype state. No production data, payment, or authentication system is connected.
          </p>
          <button
            type="button"
            data-testid="settings-reset-demo"
            onClick={() => {
              if (!confirmingReset) {
                setConfirmingReset(true);
                return;
              }
              resetDemo();
              setConfirmingReset(false);
            }}
            className={`mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold ${
              confirmingReset ? "border-red-200 bg-red-50 text-app-red" : "border-app-border bg-white text-app-text hover:bg-slate-50"
            }`}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {confirmingReset ? "Confirm reset demo data" : "Reset demo data"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ReadOnlySetting({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-app-border bg-slate-50 px-3 py-2">
      <div className="text-xs font-semibold text-app-muted">{label}</div>
      <div className="mt-1 text-sm font-bold text-app-text">{value}</div>
    </div>
  );
}

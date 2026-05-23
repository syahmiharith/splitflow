"use client";

import type { FormEvent } from "react";

type CreateGroupModalProps = {
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CreateGroupModal({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onCancel,
  onSubmit
}: CreateGroupModalProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-lg border border-app-border bg-white p-5 shadow-soft" data-testid="create-group-modal">
        <h2 className="text-lg font-bold">Create group</h2>
        <label className="mt-4 block">
          <span className="text-sm font-semibold text-app-muted">Group name</span>
          <input
            data-testid="create-group-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-app-border px-3 outline-none focus:border-app-blue"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-sm font-semibold text-app-muted">Context</span>
          <textarea
            data-testid="create-group-description"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            className="mt-2 min-h-20 w-full rounded-lg border border-app-border px-3 py-2 outline-none focus:border-app-blue"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-lg border border-app-border px-3 text-sm font-semibold">
            Cancel
          </button>
          <button data-testid="create-group-submit" type="submit" className="h-10 rounded-lg bg-app-blue px-3 text-sm font-semibold text-white">
            Create group
          </button>
        </div>
      </form>
    </div>
  );
}

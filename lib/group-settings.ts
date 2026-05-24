import type { Participant } from "@/lib/types";

export type GroupSettingsValidation = {
  name?: string;
  members?: string;
};

export function parseSettingsMembers(value: string, existingMembers: Participant[] = []): Participant[] {
  const names = Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((name) => name.replace(/\s+/g, " "))
    )
  );
  const existingByName = new Map(existingMembers.map((member) => [member.name.toLowerCase(), member]));

  return names.map((name, index) => {
    const existing = existingByName.get(name.toLowerCase());
    if (existing) return { ...existing, name };
    return {
      id: slugMemberName(name, index),
      name,
      status: index === 0 ? ("accepted" as const) : ("not_sent" as const),
      paymentStatus: index === 0 ? ("review" as const) : ("remind" as const),
      shareAmount: 0
    };
  });
}

export function validateGroupSettings(input: { name: string; members: string }): GroupSettingsValidation {
  const errors: GroupSettingsValidation = {};
  if (!input.name.trim()) {
    errors.name = "Enter a group name before saving.";
  }

  const members = parseSettingsMembers(input.members);
  if (members.length < 2) {
    errors.members = "Add at least two members separated by commas.";
  }

  return errors;
}

function slugMemberName(name: string, index: number): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `member-${index + 1}`;
}

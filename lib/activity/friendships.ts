import type { RecordRow } from "./client";
import type { SharedGroup } from "./model";

export type Friendship = SharedGroup & { friendship: true };

export function isFriendship(group: SharedGroup): group is Friendship {
  return "friendship" in group && group.friendship === true;
}

/** Pair membership is immutable; joined means this person independently added the other. */
export function findFriendship(
  rows: RecordRow[],
  actor: string,
  other: string,
): Friendship | undefined {
  return rows.find((row): row is { kind: "group"; document: Friendship } =>
    row.kind === "group" && isFriendship(row.document) &&
    row.document.people.length === 2 &&
    row.document.people.some(p => p.email === actor) &&
    row.document.people.some(p => p.email === other),
  )?.document;
}

export function mutualFriend(rows: RecordRow[], actor: string, other: string) {
  if (actor === other) return true;
  const friendship = findFriendship(rows, actor, other);
  return Boolean(friendship?.joined.includes(actor) && friendship.joined.includes(other));
}

export function assertMutualFriends(
  rows: RecordRow[],
  actor: string,
  people: { email: string; name?: string }[],
) {
  const missing = people.filter(p => !mutualFriend(rows, actor, p.email));
  if (missing.length)
    throw Error(`Both people must add each other before sharing a new cost or activity: ${missing.map(p => p.name ?? p.email).join(", ")}.`);
}

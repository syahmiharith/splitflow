import { describe, expect, it } from "vitest";
import { createGroup, changeGroup } from "@/lib/activity/model";
import type { RecordRow } from "@/lib/activity/client";
import { assertMutualFriends, findFriendship, mutualFriend } from "@/lib/activity/friendships";

const alex = "alex@example.test", minji = "minji@example.test";
const people = [{ name: "Alex", email: alex }, { name: "Minji", email: minji }];
function row(joined: string[], friendship = true): RecordRow {
  return { kind: "group", document: { ...createGroup(alex, { name: "Friends", people }), friendship, joined } } as RecordRow;
}

describe("mutual friendship", () => {
  it("requires each person to add the other independently", () => {
    expect(mutualFriend([row([alex])], alex, minji)).toBe(false);
    expect(mutualFriend([row([alex, minji])], alex, minji)).toBe(true);
    expect(mutualFriend([row([alex, minji])], minji, alex)).toBe(true);
  });
  it("does not treat joined groups as friendship", () => {
    expect(mutualFriend([row([alex, minji], false)], alex, minji)).toBe(false);
  });
  it("revoking either side stops future sharing without deleting the pair", () => {
    const rows = [row([minji])];
    expect(findFriendship(rows, alex, minji)).toBeDefined();
    expect(() => assertMutualFriends(rows, alex, people)).toThrow("Both people must add each other");
  });
  it("only changes the acting person's consent and preserves the pair after removal", () => {
    const pending = createGroup(alex, { name: "Friends", people, friendship: true });
    expect(pending.joined).toEqual([alex]);
    const mutual = changeGroup(pending, minji, { type: "join" });
    expect(mutual.joined).toEqual([alex, minji]);
    const revoked = changeGroup(mutual, alex, { type: "leave" });
    expect(revoked.people).toEqual(people);
    expect(revoked.joined).toEqual([minji]);
    expect(() => changeGroup(mutual, alex, { type: "remove", email: minji })).toThrow("independently");
  });
  it("rejects a third participant in a friendship", () => {
    expect(() => createGroup(alex, { name: "Friends", friendship: true, people: [...people, { name: "Sam", email: "sam@example.test" }] })).toThrow("exactly two");
  });
  it("does not require friendship with oneself or accept a third party", () => {
    expect(mutualFriend([], alex, alex)).toBe(true);
    expect(mutualFriend([row([alex, minji])], alex, "sam@example.test")).toBe(false);
  });
});

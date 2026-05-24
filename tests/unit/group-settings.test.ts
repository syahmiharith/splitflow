import { describe, expect, it } from "vitest";
import { parseSettingsMembers, validateGroupSettings } from "@/lib/group-settings";
import { defaultGroup } from "@/lib/demo-data";

describe("group settings helpers", () => {
  it("parses comma-separated members and preserves existing participant ids", () => {
    const members = parseSettingsMembers("Syahmi, Daniel, Daniel, New Friend", defaultGroup.members);

    expect(members.map((member) => member.name)).toEqual(["Syahmi", "Daniel", "New Friend"]);
    expect(members.find((member) => member.name === "Daniel")?.id).toBe("daniel");
    expect(members.find((member) => member.name === "New Friend")?.id).toBe("new-friend");
  });

  it("validates required group name and minimum member count", () => {
    expect(validateGroupSettings({ name: "", members: "Syahmi, Daniel" }).name).toBeTruthy();
    expect(validateGroupSettings({ name: "BBQ Crew", members: "Syahmi" }).members).toBeTruthy();
    expect(validateGroupSettings({ name: "BBQ Crew", members: "Syahmi, Daniel" })).toEqual({});
  });
});

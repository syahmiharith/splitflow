import { describe, expect, it } from "vitest";
import { createGroupParticipant } from "@/lib/group-participant";

describe("group participant creation", () => {
  it("assigns the current-user identity only when explicit", () => {
    expect(createGroupParticipant("Syahmi", 0, { isCurrentUser: true })).toMatchObject({
      id: "you",
      status: "accepted",
      paymentStatus: "review"
    });

    expect(createGroupParticipant("Syahmi", 1)).toMatchObject({
      id: "syahmi",
      status: "not_sent",
      paymentStatus: "remind"
    });
  });
});

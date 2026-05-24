import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

function isMobile(page: Page) {
  return (page.viewportSize()?.width ?? 1024) < 768;
}

async function clearDemoStorage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

async function openMobileSidebarWithEdgeSwipe(page: Page) {
  await page.evaluate(() => {
    const start = new Event("touchstart", { bubbles: true });
    Object.defineProperty(start, "touches", { value: [{ clientX: 2, clientY: 320 }] });
    window.dispatchEvent(start);

    const end = new Event("touchend", { bubbles: true });
    Object.defineProperty(end, "changedTouches", { value: [{ clientX: 96, clientY: 324 }] });
    window.dispatchEvent(end);
  });
  await expect(page.getByTestId("mobile-sidebar-overlay")).toBeVisible();
}

async function openProfileSwitcher(page: Page) {
  if (isMobile(page)) {
    await page.getByTestId("mobile-sidebar-open").click();
    const sidebar = page.getByTestId("mobile-sidebar-overlay");
    await expect(sidebar).toBeVisible();
    await sidebar.getByTestId("sidebar-profile-button").click();
    return;
  }
  await page.getByTestId("sidebar-profile-button").click();
}

async function closeProfileSwitcher(page: Page) {
  await page.getByTestId("profile-sheet-close").click();
  if (isMobile(page)) {
    await page.getByLabel("Close sidebar").click();
  }
}

async function selectProfile(page: Page, participantId: string) {
  await openProfileSwitcher(page);
  await page.getByTestId(`profile-switch-${participantId}`).click();
  await closeProfileSwitcher(page);
}

async function expectSidebarProfile(page: Page, name: string) {
  if (isMobile(page)) {
    await page.getByTestId("mobile-sidebar-open").click();
    await expect(page.getByTestId("mobile-sidebar-overlay").getByTestId("sidebar-profile-button")).toContainText(name);
    await page.getByLabel("Close sidebar").click();
    return;
  }
  await expect(page.getByTestId("sidebar-profile-button")).toContainText(name);
}

async function resetDemoData(page: Page) {
  await page.getByTestId("header-actions-more").click();
  await page.getByTestId("reset-demo-data").click();
}

async function createGroup(page: Page, name: string, description = "") {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (isMobile(page)) {
    await page.goto("/groups");
    await page.getByTestId("groups-create-group").click();
  } else {
    await page.getByTestId("group-switcher").click();
    await page.getByTestId("create-group-open").click();
  }

  await page.getByTestId("create-group-name").fill(name);
  if (description) await page.getByTestId("create-group-description").fill(description);
  await page.getByTestId("create-group-submit").click();
  await expect(page).toHaveURL(new RegExp(`/groups/${slug}/chat$`));
}

const canonicalBbqPrompt = `I'm organizing a Han River BBQ for 8 people and need agreement before I front ₩128,000.

Estimated costs:
- meat ₩80,000
- drinks ₩20,000
- charcoal ₩10,000
- sides ₩18,000

Daniel does not eat beef, so exclude him from meat.
Sarah already sent me ₩10,000, but I need to confirm it before counting it as paid.
Ali says he may request a change if his share goes above ₩20,000.

Create a proposal I can send to the group before I buy everything.`;

async function seedSplitOperationsState(page: Page) {
  await page.evaluate(() => {
    const key = "splitflow.demoState.v4";
    type ParticipantRecord = { id?: string; status?: string; paymentStatus?: string; changeRequestNote?: string; [key: string]: unknown };
    type PaymentRecord = { id?: string; status?: string; [key: string]: unknown };
    type ProposalRecord = {
      id?: string;
      title?: string;
      status?: string;
      participants?: ParticipantRecord[];
      paymentRecords?: PaymentRecord[];
      timeline?: unknown[];
      [key: string]: unknown;
    };
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    const state = JSON.parse(raw) as {
      groups?: Array<{ id: string; proposals?: ProposalRecord[] }>;
    };
    const group = state.groups?.find((item) => item.id === "han-river-bbq");
    const base = group?.proposals?.[0];
    if (!group || !base) return;

    const clone = (id: string, title: string, status: string) => ({
      ...base,
      id,
      title,
      status,
      paymentRecords: [],
      timeline: [...(base.timeline ?? [])],
      participants: (base.participants ?? []).map((participant) => ({ ...participant }))
    });
    const allAccepted = (proposal: ProposalRecord) => ({
      ...proposal,
      participants: (proposal.participants ?? []).map((participant) => ({
        ...participant,
        status: "accepted",
        paymentStatus: participant.id === "you" ? "review" : "unpaid",
        changeRequestNote: undefined
      }))
    });

    const waiting = clone("jeju-booking-split", "Jeju Booking Split", "waiting_for_responses");
    waiting.participants = waiting.participants.map((participant) =>
      ["you", "ali", "sarah"].includes(participant.id ?? "") ? { ...participant, status: "accepted" } : { ...participant, status: "pending" }
    );

    const changed = clone("daniel-change-split", "Daniel Change Split", "changes_requested");
    changed.participants = changed.participants.map((participant) =>
      participant.id === "daniel"
        ? { ...participant, status: "requested_changes", changeRequestNote: "Daniel requested a meat exclusion review." }
        : participant
    );

    const ready = allAccepted(clone("ready-settle-split", "Ready Settlement Split", "safe_to_book"));
    ready.paymentRecords = (base.paymentRecords ?? []).map((record) => ({ ...record, id: `${record.id}-ready`, status: "confirmed" }));

    const settled = allAccepted(clone("settled-split", "Settled Split", "settled"));
    settled.paymentRecords = (base.paymentRecords ?? []).map((record) => ({ ...record, id: `${record.id}-settled`, status: "confirmed" }));

    group.proposals = [base, waiting, changed, ready, settled];
    window.localStorage.setItem(key, JSON.stringify(state));
  });
}

async function seedGroupWithoutSplits(page: Page) {
  await page.evaluate(() => {
    const key = "splitflow.demoState.v4";
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    const state = JSON.parse(raw) as {
      selectedGroupId?: string;
      selectedChatIdByGroupId?: Record<string, string>;
      selectedProfileByGroupId?: Record<string, string>;
      groups?: Array<Record<string, unknown> & { id: string; chats?: Array<{ id: string }> }>;
    };
    const base = state.groups?.[0];
    if (!base) return;
    const chatId = base.chats?.[0]?.id ?? "chat-empty-review-group";
    state.selectedGroupId = "empty-review-group";
    state.selectedChatIdByGroupId = { "empty-review-group": chatId };
    state.selectedProfileByGroupId = { "empty-review-group": "you" };
    state.groups = [
      {
        ...base,
        id: "empty-review-group",
        name: "Empty Review Group",
        description: "No split created yet.",
        proposals: [],
        artifacts: [],
        analyticsSummary: {
          activeProposals: 0,
          openChangeRequests: 0,
          pendingSettlements: 0,
          totalFronted: 0,
          stillOwed: 0,
          pendingResponses: 0,
          confirmedPayments: 0,
          claimedUnconfirmedCredits: 0
        }
      }
    ];
    window.localStorage.setItem(key, JSON.stringify(state));
  });
}

async function seedPartialHomeState(page: Page) {
  await page.evaluate(() => {
    const key = "splitflow.demoState.v4";
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    const state = JSON.parse(raw) as {
      groups?: Array<{
        id: string;
        proposals?: Array<{
          id: string;
          calculationResult?: unknown;
          paymentRecords?: unknown;
          timeline?: unknown;
        }>;
      }>;
    };
    const proposal = state.groups?.find((group) => group.id === "han-river-bbq")?.proposals?.[0];
    if (proposal) {
      proposal.calculationResult = {
        fairShareByParticipant: { daniel: 6858 },
        netBalanceByParticipant: {},
        itemizedBreakdown: []
      };
      delete proposal.paymentRecords;
      delete proposal.timeline;
    }
    window.localStorage.setItem(key, JSON.stringify(state));
  });
}

test("home shows product story and global status cards", async ({ page }) => {
  await clearDemoStorage(page);

  await expect(page.getByTestId("home-route")).toBeVisible();
  if (!isMobile(page)) {
    await expect(page.getByTestId("group-switcher")).toContainText("Han River BBQ Crew");
  }
  await expect(page.getByText(/agreement before/i).first()).toBeVisible();
  await expect(page.getByText("Get agreement before you front group expenses.")).toBeVisible();
  await expect(page.getByTestId("global-status-cards")).toContainText("Needs action");
  await expect(page.getByTestId("global-status-cards")).toContainText("Waiting confirmations");
  await expect(page.getByTestId("global-status-cards")).toContainText("Unconfirmed claims");
  await expect(page.getByTestId("global-next-action-card")).toContainText("Next best action");
  await expect(page.getByTestId("home-primary-cta")).toBeVisible();

  await page.goto("/groups/han-river-bbq/chat");
  await expect(page.getByTestId("chat-route")).toBeVisible();
  await expect(page.getByTestId("chat-centered-column")).toBeVisible();
  if (!isMobile(page)) {
    const columnWidth = await page.getByTestId("chat-centered-column").evaluate((node) => node.getBoundingClientRect().width);
    expect(columnWidth).toBeLessThanOrEqual(840);
  }
  await expect(page.getByTestId("decision-summary-card")).toContainText("Not ready");
  await expect(page.getByTestId("decision-primary-cta")).toBeVisible();
  await expect(page.getByTestId("artifact-preview-proposal_draft")).toContainText("Han River BBQ Proposal");
});

test("home shows next best action for unresolved change request", async ({ page }) => {
  await clearDemoStorage(page);
  await seedSplitOperationsState(page);
  await page.goto("/");

  await expect(page.getByTestId("global-next-action-card")).toContainText("Daniel requested a change");
  await expect(page.getByTestId("global-next-action-card")).toContainText("Daniel requested a meat exclusion review");
  await page.getByTestId("global-next-action-cta").click();
  await expect(page).toHaveURL(/\/groups\/han-river-bbq\/proposals\/daniel-change-split$/);
  await expect(page.getByTestId("proposal-detail-route")).toBeVisible();
});

test("home shows active workflows before recent activity", async ({ page }) => {
  await clearDemoStorage(page);
  await seedSplitOperationsState(page);
  await page.goto("/");

  await expect(page.getByTestId("active-workflows-section")).toBeVisible();
  await expect(page.getByTestId("active-workflow-daniel-change-split")).toContainText("Han River BBQ Crew");
  await expect(page.getByTestId("active-workflow-daniel-change-split")).toContainText("Daniel Change Split");
  await expect(page.getByTestId("active-workflow-daniel-change-split")).toContainText(/Change|Needs|Review/);
  await expect(page.getByTestId("recent-activity-section")).toBeVisible();

  const nextBox = await page.getByTestId("global-next-action-card").boundingBox();
  const workflowsBox = await page.getByTestId("active-workflows-section").boundingBox();
  const activityBox = await page.getByTestId("recent-activity-section").boundingBox();
  expect(nextBox?.y ?? 0).toBeLessThan(activityBox?.y ?? 0);
  expect(workflowsBox?.y ?? 0).toBeLessThan(activityBox?.y ?? 0);
});

test("home empty state works when a group has no splits", async ({ page }) => {
  await clearDemoStorage(page);
  await seedGroupWithoutSplits(page);
  await page.reload();

  await expect(page.getByTestId("home-no-splits-state")).toContainText("Start in Chat");
  await expect(page.getByTestId("home-no-splits-state")).toContainText("reviewable split");
  await expect(page.getByRole("link", { name: "Start from chat" }).first()).toBeVisible();
});

test("home survives partial calculation and missing timeline state", async ({ page }) => {
  await clearDemoStorage(page);
  await seedPartialHomeState(page);
  await page.goto("/");

  await expect(page.getByTestId("home-route")).toBeVisible();
  await expect(page.getByTestId("global-status-cards")).toContainText("Still owed");
  await expect(page.getByTestId("recent-activity-empty")).toContainText("Activity appears here");
});

test("sidebar uses Splits and Your Share navigation labels", async ({ page }) => {
  await clearDemoStorage(page);

  if (isMobile(page)) {
    await page.getByTestId("mobile-sidebar-open").click();
    const sidebar = page.getByTestId("mobile-sidebar-overlay");
    await expect(sidebar.getByTestId("nav-proposals")).toContainText("Splits");
    await expect(sidebar.getByTestId("nav-notifications")).toContainText("Your Share");
    return;
  }

  await expect(page.getByTestId("nav-proposals")).toContainText("Splits");
  await expect(page.getByTestId("nav-notifications")).toContainText("Your Share");
});

test("mobile home keeps next best action above activity", async ({ page }) => {
  test.skip(!isMobile(page), "Mobile-only Home layout coverage");
  await clearDemoStorage(page);
  await seedSplitOperationsState(page);
  await page.goto("/");

  await expect(page.getByTestId("global-next-action-card")).toBeVisible();
  await expect(page.getByTestId("active-workflows-section")).toBeVisible();
  await expect(page.getByTestId("recent-activity-section")).toBeVisible();
  const nextBox = await page.getByTestId("global-next-action-card").boundingBox();
  const activityBox = await page.getByTestId("recent-activity-section").boundingBox();
  expect(nextBox?.y ?? 0).toBeLessThan(activityBox?.y ?? 0);
  const ctaBox = await page.getByTestId("global-next-action-cta").boundingBox();
  expect(ctaBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

test("mobile sidebar opens from hamburger and left-edge swipe", async ({ page }) => {
  test.skip(!isMobile(page), "Mobile-only sidebar gesture coverage");
  await clearDemoStorage(page);

  await page.goto("/groups/han-river-bbq/chat");
  await expect(page.getByTestId("mobile-swipe-hint")).toBeVisible();
  await page.getByTestId("mobile-sidebar-open").click();
  await expect(page.getByTestId("mobile-sidebar-overlay")).toBeVisible();
  await page.getByLabel("Close sidebar").click();

  await openMobileSidebarWithEdgeSwipe(page);
  await expect(page.getByTestId("mobile-sidebar-overlay").getByTestId("sidebar-group-list")).toContainText("Han River BBQ Crew");
});

test("chat creates revised BBQ proposal artifact", async ({ page }) => {
  await clearDemoStorage(page);

  await page.goto("/groups/han-river-bbq/chat");
  await page.getByRole("textbox").fill(canonicalBbqPrompt);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("agent-run-card")).toContainText(/Reading organizer request|Workflow Running|Agent run complete/);
  await expect(page.getByTestId("agent-run-completed-summary")).toContainText("Split Agent ran deterministic math");
  await expect(page.getByTestId("decision-summary-card")).toContainText(/Not ready|Needs review/);
  await expect(page.getByTestId("decision-primary-cta")).toBeVisible();
  await expect(page.getByTestId("artifact-preview-list")).toBeVisible();
  await expect(page.getByTestId("artifact-preview-proposal_draft").first()).toContainText("Han River BBQ Proposal");
  if (!(await page.getByTestId("panel-decision").isVisible())) {
    await page.getByTestId("artifact-preview-proposal_draft").last().click();
  }
  await expect(page.getByTestId("panel-decision")).toContainText(/Not ready|Human Review Required|Needs/);
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Daniel");
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Sarah");
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("claimed");
});

test("mobile chat keeps composer and artifact panel usable", async ({ page }) => {
  test.skip(!isMobile(page), "Mobile-only chat layout coverage");
  await clearDemoStorage(page);

  await page.goto("/groups/han-river-bbq/chat");
  await expect(page.getByTestId("chat-centered-column")).toBeVisible();
  await expect(page.getByTestId("chat-input-area")).toBeVisible();
  await expect(page.getByTestId("decision-primary-cta")).toBeVisible();
  await page.getByTestId("artifact-preview-proposal_draft").first().click();
  await expect(page.getByTestId("workspace-detail-panel")).toBeVisible();
  await expect(page.getByTestId("panel-decision")).toBeVisible();
  await expect(page.getByTestId("workspace-panel-footer")).toBeVisible();
});

test("proposal panel shows settlement readiness", async ({ page }) => {
  await clearDemoStorage(page);

  await page.goto("/groups/han-river-bbq/proposals");
  await page.getByTestId("proposal-row-han-river-bbq-proposal").first().click();
  await expect(page.getByTestId("panel-decision")).toContainText("Settlement readiness");
  await expect(page.getByTestId("panel-decision")).toContainText(/Not ready|Needs review|Ready/);
  await expect(page.getByTestId("rules-applied")).toContainText("Ready Check");
  await expect(page.getByTestId("itemized-split")).toContainText("Meat");
  await expect(page.getByTestId("itemized-split")).toContainText("Daniel");
  await expect(page.getByTestId("math-audit")).toContainText("Deterministic");
  await expect(page.getByTestId("claimed-payment-ledger")).toContainText("Sarah");
  await expect(page.getByTestId("claimed-payment-ledger")).toContainText("Claimed payment");
  await expect(page.getByTestId("claimed-payment-ledger")).toContainText("No bank verification in prototype");
  await expect(page.getByTestId("workspace-panel-footer")).toContainText("Confirm claim");
  await expect(page.getByTestId("workspace-panel-footer")).not.toContainText("Mark Daniel paid");
});

test("proposal history and send flow are still available", async ({ page }) => {
  await clearDemoStorage(page);

  await page.goto("/groups/han-river-bbq/chat");
  await page.getByTestId("artifact-preview-proposal_draft").first().click();
  await expect(page.getByTestId("proposal-history-tabs")).toBeVisible();
  await page.getByTestId("proposal-history-tabs").getByRole("button", { name: "Versions" }).click();
  await expect(page.getByTestId("proposal-version-history")).toContainText("Seeded canonical demo proposal.");
  await page.getByTestId("proposal-history-tabs").getByRole("button", { name: "Artifacts" }).click();
  await expect(page.getByTestId("artifact-history-list")).toContainText("Review Required");
  await page.getByTestId("proposal-history-tabs").getByRole("button", { name: "Review" }).click();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Participant shares");
  await page.getByTestId("workspace-panel-more-actions").click();
  await page.getByTestId("panel-send-proposal").click();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Still Waiting");
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Sent proposal to participants for agreement.");
  await expect(page.getByTestId("share-preview-message")).toContainText("participant agreement");
});

test("sidebar profile switcher appears with group members", async ({ page }) => {
  await clearDemoStorage(page);

  await page.goto("/groups/han-river-bbq");
  await expectSidebarProfile(page, "Syahmi");
  await openProfileSwitcher(page);
  await expect(page.getByTestId("profile-bottom-sheet").last()).toContainText("View as");
  await expect(page.getByTestId("profile-switch-you")).toContainText("Organizer");
  await expect(page.getByTestId("profile-switch-daniel")).toContainText("Daniel");
  await expect(page.getByTestId("profile-switch-sarah")).toContainText("Sarah");
  await expect(page.getByTestId("profile-switcher-note")).toContainText("Prototype profile switching");
  await closeProfileSwitcher(page);
});

test("Your Share uses sidebar-selected participant profile", async ({ page }) => {
  await clearDemoStorage(page);

  await page.goto("/groups/han-river-bbq/inbox");
  await expect(page.getByTestId("organizer-share-state")).toContainText("You are viewing as the organizer");
  await selectProfile(page, "daniel");
  await expect(page.getByTestId("participant-simulation-note")).toContainText("viewing as Daniel");
  await expect(page.getByTestId("participant-inbox-card")).toContainText("Your Share");
  await expect(page.getByTestId("participant-inbox-card")).toContainText("Daniel");
  await expect(page.getByTestId("your-share-decision")).toContainText(/You owe|No payment needed|You receive/);
  await expect(page.getByTestId("participant-share-explanation")).toContainText("Included in your share");
  await expect(page.getByTestId("participant-share-explanation")).toContainText("Excluded from your share");
  await expect(page.getByTestId("participant-share-explanation")).toContainText("Meat");

  await selectProfile(page, "sarah");
  await expect(page.getByTestId("participant-simulation-note")).toContainText("viewing as Sarah");
  await expect(page.getByTestId("participant-inbox-card")).toContainText("Sarah");
  await expect(page.getByTestId("credits-payment-claims")).toContainText("Payment claim");
  await expect(page.getByTestId("credits-payment-claims")).toContainText("Needs organizer confirmation");
});

test("Your Share no longer exposes a large local participant switcher", async ({ page }) => {
  await clearDemoStorage(page);

  await page.goto("/groups/han-river-bbq/inbox");
  await selectProfile(page, "daniel");
  await expect(page.getByTestId("participant-simulation-note")).toContainText("Change profile from the sidebar footer");
  await expect(page.getByTestId("participant-switch-daniel")).toHaveCount(0);
  await expect(page.getByTestId("participant-switch-sarah")).toHaveCount(0);
});

test("selected profile persists across refresh", async ({ page }) => {
  await clearDemoStorage(page);

  await page.goto("/groups/han-river-bbq/inbox");
  await selectProfile(page, "daniel");
  await page.reload();
  await expectSidebarProfile(page, "Daniel");
  await expect(page.getByTestId("participant-simulation-note")).toContainText("viewing as Daniel");
});

test("group switching falls back to a valid profile", async ({ page }) => {
  await clearDemoStorage(page);

  await page.goto("/groups/han-river-bbq/inbox");
  await selectProfile(page, "daniel");
  await createGroup(page, "Temporary Share Group");
  await page.goto("/groups/temporary-share-group/inbox");
  await expectSidebarProfile(page, "Syahmi");
  await expect(page.getByTestId("inbox-route")).toBeVisible();
  await expect(page.getByTestId("organizer-share-state")).toContainText("You are viewing as the organizer");
});

test("participant review simulation supports Daniel change request", async ({ page }) => {
  await clearDemoStorage(page);

  await page.goto("/groups/han-river-bbq/inbox");
  await selectProfile(page, "daniel");
  await expect(page.getByTestId("participant-inbox-card")).toContainText("Han River BBQ Proposal");
  await expect(page.getByTestId("participant-inbox-card")).toContainText("Your Share");
  await expect(page.getByTestId("participant-share-explanation")).toContainText("Why this amount");
  await page.getByTestId("participant-request-change-open").click();
  await page.getByTestId("change-reason-input").fill("Daniel does not eat beef, so please verify meat is excluded.");
  await page.getByTestId("participant-request-changes").click();
  await expect(page.getByTestId("participant-reply-state")).toContainText("Change requested");

  await page.goto("/groups/han-river-bbq/proposals");
  await page.getByTestId("proposal-row-han-river-bbq-proposal").first().click();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Daniel");
  await expect(page.getByTestId("workspace-detail-panel")).toContainText(/Asked for a change|Asked for a Change|Change requests/);
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("meat");
});

test("participant actions are trust-safe", async ({ page }) => {
  await clearDemoStorage(page);

  await page.goto("/groups/han-river-bbq/inbox");
  await selectProfile(page, "daniel");
  await page.getByTestId("participant-accept").click();
  await expect(page.getByTestId("participant-reply-state")).toContainText("I'm In");
  await page.getByTestId("payment-reference-input").fill("Toss transfer ref 123");
  await page.getByTestId("participant-claim-paid").click();
  await expect(page.getByTestId("credits-payment-claims")).toContainText("Payment claim");
  await expect(page.getByTestId("credits-payment-claims")).toContainText("Needs organizer confirmation");
  await expect(page.getByTestId("credits-payment-claims")).toContainText("No bank verification in prototype");
  await expect(page.getByTestId("credits-payment-claims")).not.toContainText("Payment verified");
});

test("partial calculation state does not crash Your Share", async ({ page }) => {
  await clearDemoStorage(page);
  await page.evaluate(() => {
    const key = "splitflow.demoState.v4";
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    const state = JSON.parse(raw) as {
      groups?: Array<{ id: string; proposals?: Array<{ id: string; calculationResult?: unknown }> }>;
    };
    const proposal = state.groups?.find((group) => group.id === "han-river-bbq")?.proposals?.[0];
    if (proposal) {
      proposal.calculationResult = {
        fairShareByParticipant: { daniel: 6858 },
        netBalanceByParticipant: {},
        itemizedBreakdown: []
      };
    }
    window.localStorage.setItem(key, JSON.stringify(state));
  });

  await page.goto("/groups/han-river-bbq/inbox");
  await selectProfile(page, "daniel");
  await expect(page.getByTestId("participant-inbox-card")).toContainText("Daniel");
  await expect(page.getByTestId("participant-share-explanation")).toBeVisible();
});

test("Splits page survives partial calculation state", async ({ page }) => {
  await clearDemoStorage(page);
  await page.evaluate(() => {
    const key = "splitflow.demoState.v4";
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    const state = JSON.parse(raw) as {
      groups?: Array<{ id: string; proposals?: Array<{ id: string; calculationResult?: unknown }> }>;
    };
    const proposal = state.groups?.find((group) => group.id === "han-river-bbq")?.proposals?.[0];
    if (proposal) {
      proposal.calculationResult = {
        fairShareByParticipant: { daniel: 6858 },
        netBalanceByParticipant: {},
        totalPaidByParticipant: {}
      };
    }
    window.localStorage.setItem(key, JSON.stringify(state));
  });

  await page.goto("/groups/han-river-bbq/proposals");
  await expect(page.getByTestId("proposal-row-han-river-bbq-proposal").first()).toContainText("Han River BBQ Proposal");
  await page.getByTestId("proposal-row-han-river-bbq-proposal").first().click();
  await expect(page.getByTestId("panel-decision")).toContainText("Settlement readiness");
  await expect(page.getByTestId("math-audit")).toBeVisible();
});

test("mobile sidebar footer can switch Your Share profile", async ({ page }) => {
  test.skip(!isMobile(page), "Mobile-only profile switcher coverage");
  await clearDemoStorage(page);

  await page.goto("/groups/han-river-bbq/inbox");
  await page.getByTestId("mobile-sidebar-open").click();
  await expect(page.getByTestId("mobile-sidebar-overlay")).toBeVisible();
  await page.getByTestId("mobile-sidebar-overlay").getByTestId("sidebar-profile-button").click();
  await page.getByTestId("profile-switch-daniel").click();
  await closeProfileSwitcher(page);
  await expect(page.getByTestId("participant-simulation-note")).toContainText("viewing as Daniel");
  await expect(page.getByTestId("mobile-share-action-bar")).toBeVisible();
});

test("claimed payment confirmation updates readiness", async ({ page }) => {
  await clearDemoStorage(page);

  await page.goto("/groups/han-river-bbq/proposals");
  await page.getByTestId("proposal-row-han-river-bbq-proposal").first().click();
  await expect(page.getByTestId("claimed-payment-ledger")).toContainText("Needs organizer confirmation");
  await page.getByTestId("panel-confirm-credit").click();
  await expect(page.getByTestId("claimed-payment-ledger")).toContainText("Confirmed by organizer");
  await expect(page.getByTestId("workspace-detail-panel")).not.toContainText("payment claim needs confirmation");
});

test("creating a group and resetting data returns to canonical BBQ workspace", async ({ page }) => {
  await clearDemoStorage(page);

  await createGroup(page, "Temporary Review Group");
  if (!isMobile(page)) {
    await expect(page.getByTestId("group-switcher")).toContainText("Temporary Review Group");
  }

  await page.goto("/groups/temporary-review-group/chat");
  await resetDemoData(page);
  if (!isMobile(page)) {
    await expect(page.getByTestId("group-switcher")).toContainText("Han River BBQ Crew");
  }
  await page.goto("/groups");
  await expect(page.getByText("Temporary Review Group")).toHaveCount(0);
  await expect(page.getByTestId("groups-route").getByText("Han River BBQ Crew").first()).toBeVisible();
});

test("group overview leads with settlement readiness actions", async ({ page }) => {
  await clearDemoStorage(page);
  await page.goto("/groups/han-river-bbq");

  await expect(page.getByTestId("action-queue")).toBeVisible();
  await expect(page.getByTestId("agreement-health")).toContainText("Draft");
  await expect(page.getByTestId("settlement-readiness-card")).toContainText("claimed payment");
  await expect(page.getByTestId("blocking-progress-card")).toContainText("Daniel");
});

test("Splits page is an agreement operations surface", async ({ page }) => {
  await clearDemoStorage(page);
  await seedSplitOperationsState(page);
  await page.goto("/groups/han-river-bbq/proposals");

  if (!isMobile(page)) {
    await expect(page.getByTestId("nav-proposals")).toContainText("Splits");
  }
  await expect(page.getByTestId("group-proposals-route")).toBeVisible();
  await expect(page.getByTestId("splits-summary-header").getByRole("heading", { name: "Splits" })).toBeVisible();
  await expect(page.getByTestId("splits-summary-header")).toContainText("Active splits");
  await expect(page.getByTestId("splits-summary-header")).toContainText("Needs action");
  await expect(page.getByTestId("splits-summary-header")).toContainText("Pending amount");
  const summaryBox = await page.getByTestId("splits-summary-header").boundingBox();
  const searchBox = await page.getByTestId("proposal-search").boundingBox();
  expect(summaryBox?.y ?? 0).toBeLessThan(searchBox?.y ?? 0);

  await expect(page.getByTestId("next-best-action-card")).toContainText("payment claim needs organizer confirmation");
  await expect(page.getByTestId("proposal-row-han-river-bbq-proposal").first()).toContainText("1/8 confirmed");
  await expect(page.getByTestId("proposal-row-han-river-bbq-proposal").first()).toContainText("claimed payment");
  await expect(page.getByTestId("proposal-row-han-river-bbq-proposal").first()).toContainText("Confirm payment claim");

  await page.getByTestId("proposal-row-han-river-bbq-proposal").first().click();
  await expect(page.getByTestId("panel-decision")).toContainText("Settlement readiness");
  await expect(page.getByTestId("workspace-panel-footer")).toContainText("Confirm claim");
  await expect(page.getByTestId("workspace-panel-footer")).not.toContainText("Mark Daniel paid");
  await expect(page.getByTestId("claimed-payment-ledger")).toContainText("Claimed payment");
  await expect(page.getByTestId("claimed-payment-ledger")).toContainText("No bank verification in prototype");
  await expect(page.getByTestId("claimed-payment-ledger")).not.toContainText("Payment verified");
  await expect(page.getByTestId("claimed-payment-ledger")).not.toContainText("bank verified");
  await page.getByLabel("Close panel").click();

  await page.getByTestId("proposal-filter-drafts").click();
  await expect(page.getByText("Han River BBQ Proposal").first()).toBeVisible();
  await expect(page.getByText("Jeju Booking Split")).toHaveCount(0);

  await page.getByTestId("proposal-filter-waiting_responses").click();
  await expect(page.getByText("Jeju Booking Split").first()).toBeVisible();
  await expect(page.getByTestId("split-card-list")).not.toContainText("Han River BBQ Proposal");

  await page.getByTestId("proposal-filter-changes_requested").click();
  await expect(page.getByText("Daniel Change Split").first()).toBeVisible();

  await page.getByTestId("proposal-filter-ready_to_settle").click();
  await expect(page.getByText("Ready Settlement Split").first()).toBeVisible();
  await page.getByTestId("proposal-row-ready-settle-split").first().click();
  await expect(page.getByTestId("workspace-panel-footer")).toContainText("Mark settled");
  await page.getByLabel("Close panel").click();

  await page.getByTestId("proposal-filter-settled").click();
  await expect(page.getByText("Settled Split").first()).toBeVisible();
  await page.getByTestId("proposal-row-settled-split").first().click();
  await expect(page.getByTestId("workspace-panel-footer")).toContainText("Copy summary");
  await page.getByLabel("Close panel").click();

  await page.getByTestId("proposal-filter-all").click();
  await page.getByTestId("proposal-search").fill("Daniel");
  await expect(page.getByText("Daniel Change Split").first()).toBeVisible();
  await page.getByTestId("proposal-search").fill("not-a-match");
  await expect(page.getByTestId("proposal-empty-state")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

test("agent lab runs orchestrator scenario without layout overflow", async ({ page }) => {
  await page.goto("/agent-lab");
  await expect(page.getByTestId("agent-lab-route")).toBeVisible();
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByText("Orchestrator message")).toBeVisible();
  await expect(page.getByText("Busan Airbnb").first()).toBeVisible();
  await expect(page.getByText("Risk", { exact: true })).toBeVisible();
  await expect(page.getByText("Trace", { exact: true })).toBeVisible();
  await expect(page.getByTestId("agent-backend")).toHaveText("runOrchestrator");
  await expect(page.getByTestId("sdk-invoked")).toHaveText("false");

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

test("README documents the canonical demo", async () => {
  const readme = await readFile("README.md", "utf8");
  expect(readme).toContain("Han River BBQ: Agreement Before the Organizer Fronts Money");
  expect(readme).toContain("the organizer does not only need math");
  expect(readme).toContain("Daniel does not eat beef");
  expect(readme).toContain("claimed vs confirmed payments");
});

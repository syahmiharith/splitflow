import type { AgentStep, AppState, Artifact, BotMessage, ChatSession, Notification, Proposal, SplitFlowGroup } from "@/lib/types";
import { createHanRiverBbqProposal } from "@/lib/prototype-proposals";
import { deriveGroupAnalytics } from "@/lib/analytics";

const now = "2026-05-22T10:22:00.000+09:00";
export const canonicalBbqPrompt = `I'm organizing a Han River BBQ for 8 people and need agreement before I front ₩128,000.

Estimated costs:
- meat ₩80,000
- drinks ₩20,000
- charcoal ₩10,000
- sides ₩18,000

Daniel does not eat beef, so exclude him from meat.
Sarah already sent me ₩10,000, but I need to confirm it before counting it as paid.
Ali says he may request a change if his share goes above ₩20,000.

Create a proposal I can send to the group before I buy everything.`;

export const demoProposal: Proposal = {
  ...createHanRiverBbqProposal("han-river-bbq", "han-river-bbq-proposal"),
  createdAt: now,
  updatedAt: now,
  deadline: "2026-05-24T18:00:00.000+09:00"
};

export const demoMessages: BotMessage[] = [
  {
    id: "m1",
    sender: "bot",
    content: "Tell me what needs agreement before someone fronts money.",
    createdAt: "2026-05-22T10:21:00.000+09:00"
  },
  {
    id: "m2",
    sender: "user",
    content: canonicalBbqPrompt,
    createdAt: "2026-05-22T10:22:00.000+09:00"
  },
  {
    id: "m3",
    sender: "bot",
    content: "I built a Han River BBQ proposal artifact. Review the deterministic math, Daniel's meat exclusion, Sarah's claimed payment, and Ali's risk note before sending it for agreement.",
    createdAt: "2026-05-22T10:22:00.000+09:00",
    relatedProposalId: "han-river-bbq-proposal"
  }
];

export const demoAgentSteps: AgentStep[] = [
  { id: "reading", name: "Reading organizer request", description: "Found BBQ agreement context for 8 participants", time: "10:21 AM", status: "completed" },
  { id: "extracting", name: "Extracting items and participants", description: "Parsed meat, drinks, charcoal, sides, and member list", time: "10:21 AM", status: "completed" },
  { id: "rules", name: "Checking exclusions and claimed payments", description: "Daniel excluded from meat; Sarah payment remains claimed", time: "10:22 AM", status: "completed" },
  { id: "validation", name: "Validating total against itemized costs", description: "Itemized costs reconcile to ₩128,000", time: "10:22 AM", status: "completed" },
  { id: "engine", name: "Running deterministic split engine", description: "Final amounts calculated in TypeScript, not by AI", time: "10:22 AM", status: "completed" },
  { id: "artifact", name: "Creating proposal artifact", description: "Ready for organizer review", time: "10:22 AM", status: "completed" },
  { id: "review-actions", name: "Preparing human review actions", description: "Confirm Sarah's claim and send for agreement", time: "—", status: "pending" }
];

export const demoNotifications: Notification[] = [
  {
    id: "n-daniel",
    participantId: "daniel",
    proposalId: "han-river-bbq-proposal",
    title: "SplitFlow",
    message: "Syahmi prepared a Han River BBQ proposal for agreement before buying supplies.",
    read: false,
    createdAt: now
  }
];

export const demoArtifacts: Artifact[] = [
  {
    id: "artifact-han-river-bbq-proposal",
    type: "proposal_draft",
    title: "Han River BBQ Proposal",
    summary: "Ready for organizer review: ₩128,000 total, Daniel excluded from meat, Sarah claimed ₩10,000, Ali risk note captured.",
    proposalId: "han-river-bbq-proposal",
    createdAt: now
  },
  {
    id: "artifact-han-river-bbq-readiness",
    type: "settlement_plan",
    title: "Settlement Readiness",
    summary: "Not ready: organizer must send for agreement and confirm Sarah's claimed payment before settlement.",
    proposalId: "han-river-bbq-proposal",
    createdAt: now
  }
];

export const demoChats: ChatSession[] = [
  {
    id: "chat-han-river-bbq",
    title: "Han River BBQ agreement",
    messages: demoMessages,
    artifactIds: demoArtifacts.map((artifact) => artifact.id),
    createdAt: "2026-05-22T10:21:00.000+09:00",
    updatedAt: now
  }
];

export const defaultGroup: SplitFlowGroup = {
  id: "han-river-bbq",
  name: "Han River BBQ Crew",
  description: "Agreement before the organizer fronts the BBQ cost.",
  members: demoProposal.participants,
  proposals: [demoProposal],
  chats: demoChats,
  artifacts: demoArtifacts,
  analyticsSummary: deriveGroupAnalytics({ proposals: [demoProposal] } as SplitFlowGroup),
  createdAt: now,
  updatedAt: now
};

export const initialState: AppState = {
  schemaVersion: 7,
  migrationLog: [],
  currentUser: "you",
  selectedGroupId: defaultGroup.id,
  selectedChatIdByGroupId: { [defaultGroup.id]: demoChats[0].id },
  selectedProfileByGroupId: { [defaultGroup.id]: "you" },
  groups: [defaultGroup],
  workspacePanel: null,
  globalNotifications: demoNotifications,
  agentSteps: demoAgentSteps,
  agentRuns: [],
  aiUnavailable: false
};

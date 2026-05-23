import type { AgentStep, AppState, Artifact, BotMessage, ChatSession, Notification, Proposal, SplitFlowGroup } from "@/lib/types";
import { createJejuTripProposal } from "@/lib/prototype-proposals";
import { deriveGroupAnalytics } from "@/lib/analytics";

const now = "2026-05-22T10:22:00.000+09:00";

export const demoProposal: Proposal = {
  ...createJejuTripProposal("jeju-trip", "jeju-airbnb-trip"),
  createdAt: now,
  updatedAt: now,
  deadline: "2026-05-25T20:00:00.000+09:00"
};

export const demoMessages: BotMessage[] = [
  {
    id: "m1",
    sender: "bot",
    content: "Tell me what needs to be split before someone pays upfront.",
    createdAt: "2026-05-22T10:21:00.000+09:00"
  },
  {
    id: "m2",
    sender: "user",
    content: "Jeju trip for me, Mina, Daniel, Alex, Sarah, and Yuna. Airbnb is ₩420,000 for two nights, cleaning is ₩60,000, Sarah paid ₩90,000 van deposit. Alex only joins Saturday. I need to know if it is safe to book tonight.",
    createdAt: "2026-05-22T10:22:00.000+09:00"
  },
  {
    id: "m3",
    sender: "bot",
    content: "I built a Jeju Airbnb Trip Split. Review the split details, then send it to friends so they can tap I’m In or ask for a change.",
    createdAt: "2026-05-22T10:22:00.000+09:00",
    relatedProposalId: "jeju-airbnb-trip"
  }
];

export const demoAgentSteps: AgentStep[] = [
  { id: "understood", name: "Understood", description: "Found 6 friends and one partial stay", time: "10:21 AM", status: "completed" },
  { id: "costs", name: "Costs", description: "Parsed Airbnb, cleaning, and van deposit costs", time: "10:21 AM", status: "completed" },
  { id: "shares", name: "Shares", description: "Calculated each share with Alex excluded from Friday", time: "10:22 AM", status: "completed" },
  { id: "ready-check", name: "Ready Check", description: "Booking is not ready until friends confirm", time: "10:22 AM", status: "completed" },
  { id: "send", name: "Send", description: "Ready to send Your Share to friends", time: "—", status: "pending" }
];

export const demoNotifications: Notification[] = [
  {
    id: "n-alex",
    participantId: "alex",
    proposalId: "jeju-airbnb-trip",
    title: "SplitFlow",
    message: "Syahmi sent you Your Share for Jeju Airbnb Trip Split.",
    read: false,
    createdAt: now
  }
];

export const demoArtifacts: Artifact[] = [
  {
    id: "artifact-jeju-trip-split",
    type: "proposal_draft",
    title: "Jeju Airbnb Trip Split",
    summary: "A reviewable trip split with Alex excluded from Friday and Sarah credited for the van deposit.",
    proposalId: "jeju-airbnb-trip",
    createdAt: now
  },
  {
    id: "artifact-jeju-ready-check",
    type: "settlement_plan",
    title: "Ready to Book Check",
    summary: "Shows who still needs to tap I’m In before Syahmi should book the Airbnb.",
    proposalId: "jeju-airbnb-trip",
    createdAt: now
  }
];

export const demoChats: ChatSession[] = [
  {
    id: "chat-jeju-intake",
    title: "Jeju booking split",
    messages: demoMessages,
    artifactIds: demoArtifacts.map((artifact) => artifact.id),
    createdAt: "2026-05-22T10:21:00.000+09:00",
    updatedAt: now
  }
];

export const defaultGroup: SplitFlowGroup = {
  id: "jeju-trip",
  name: "Jeju Trip",
  description: "Default reviewer group for a shared Airbnb booking decision.",
  members: demoProposal.participants,
  proposals: [demoProposal],
  chats: demoChats,
  artifacts: demoArtifacts,
  analyticsSummary: deriveGroupAnalytics({ proposals: [demoProposal] } as SplitFlowGroup),
  createdAt: now,
  updatedAt: now
};

export const initialState: AppState = {
  schemaVersion: 5,
  migrationLog: [],
  currentUser: "organizer",
  selectedGroupId: defaultGroup.id,
  selectedChatIdByGroupId: { [defaultGroup.id]: demoChats[0].id },
  groups: [defaultGroup],
  workspacePanel: null,
  globalNotifications: demoNotifications,
  agentSteps: demoAgentSteps,
  agentRuns: [],
  aiUnavailable: false
};

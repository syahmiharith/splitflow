import type { AgentStep, AppState, Artifact, BotMessage, ChatSession, Notification, Proposal, SplitFlowGroup } from "@/lib/types";
import { recalculateProposal } from "@/lib/prototype-proposals";
import { deriveGroupAnalytics } from "@/lib/analytics";

const now = "2026-05-22T10:22:00.000+09:00";

const demoProposalBase: Proposal = {
  id: "bbq-dinner",
  title: "BBQ Dinner",
  description: "BBQ dinner for 8 people with item-based exclusions and tracked participant responses.",
  groupId: "bbq-crew",
  organizerId: "you",
  organizerName: "Syahmi",
  totalCost: 128000,
  currency: "KRW",
  splitMethod: "mixed_item_based",
  deadline: "2026-05-24T14:30:00.000+09:00",
  cancellationRule: "After accepting, participants are responsible unless someone replaces them.",
  status: "draft",
  isBooked: false,
  createdAt: now,
  updatedAt: now,
  fairnessNote: "Daniel pays less because beef was excluded from his share.",
  recommendation:
    "Daniel's request is likely valid if he did not eat beef. Suggested adjustment reduces his amount by ₩8,000.",
  costItems: [
    { id: "meat", label: "Meat", amount: 64000, paidBy: "Syahmi", paidByParticipantId: "you", excludedParticipantIds: ["daniel"] },
    { id: "drinks", label: "Drinks", amount: 24000, paidBy: "Ali", paidByParticipantId: "ali" },
    { id: "charcoal", label: "Charcoal", amount: 10000, paidBy: "Sarah", paidByParticipantId: "sarah" },
    { id: "sides", label: "Sides", amount: 30000, paidBy: "Syahmi", paidByParticipantId: "you" }
  ],
  participants: [
    {
      id: "you",
      name: "Syahmi",
      status: "accepted",
      paymentStatus: "review",
      shareAmount: 64000,
      roleNote: "Paid: Meat"
    },
    {
      id: "ali",
      name: "Ali",
      status: "accepted",
      paymentStatus: "paid",
      shareAmount: 16000,
      roleNote: "Paid: Drinks",
      lastRespondedAt: now
    },
    {
      id: "sarah",
      name: "Sarah",
      status: "accepted",
      paymentStatus: "unpaid",
      shareAmount: 10000,
      roleNote: "Paid: Charcoal",
      lastRespondedAt: now
    },
    {
      id: "daniel",
      name: "Daniel",
      status: "requested_changes",
      paymentStatus: "review",
      shareAmount: 21000,
      roleNote: "Didn't eat beef",
      changeRequestNote: "I did not eat beef.",
      lastRespondedAt: now
    },
    { id: "aiman", name: "Aiman", status: "pending", paymentStatus: "remind", shareAmount: 17000 },
    { id: "amir", name: "Amir", status: "accepted", paymentStatus: "paid", shareAmount: 17000 },
    { id: "aisyah", name: "Aisyah", status: "accepted", paymentStatus: "paid", shareAmount: 17000 },
    { id: "mina", name: "Mina", status: "pending", paymentStatus: "remind", shareAmount: 17000 }
  ],
  timeline: [
    { id: "created", at: now, actor: "Organizer", text: "Created BBQ proposal." },
    { id: "daniel-change", at: now, actor: "Daniel", text: "Requested exclusion from beef." }
  ],
  aiExplanation: "AI drafted the proposal context; deterministic TypeScript calculated item shares and settlement."
};

export const demoProposal: Proposal = recalculateProposal(demoProposalBase);

export const demoMessages: BotMessage[] = [
  {
    id: "m1",
    sender: "bot",
    content: "What are we splitting today?",
    createdAt: "2026-05-22T10:21:00.000+09:00"
  },
  {
    id: "m2",
    sender: "user",
    content: "BBQ dinner for 8 people. I paid for meat, Ali paid drinks, Sarah bought charcoal. Daniel didn’t eat beef.",
    createdAt: "2026-05-22T10:22:00.000+09:00"
  },
  {
    id: "m3",
    sender: "bot",
    content: "I’ll create a mixed split with item-based rules and explain each participant’s amount.",
    createdAt: "2026-05-22T10:22:00.000+09:00",
    relatedProposalId: "bbq-dinner"
  }
];

export const demoAgentSteps: AgentStep[] = [
  { id: "intake", name: "Intake Agent", description: "Understood event and participants", time: "10:21 AM", status: "completed" },
  { id: "cost", name: "Cost Agent", description: "Parsed 4 cost items totaling ₩128,000", time: "10:21 AM", status: "completed" },
  { id: "split", name: "Split Agent", description: "Calculated mixed split", time: "10:22 AM", status: "completed" },
  { id: "fairness", name: "Fairness Agent", description: "Added explanations", time: "10:22 AM", status: "completed" },
  { id: "participant", name: "Participant Agent", description: "Waiting to send proposal", time: "—", status: "pending" }
];

export const demoNotifications: Notification[] = [
  {
    id: "n-daniel",
    participantId: "daniel",
    proposalId: "bbq-dinner",
    title: "SplitFlow",
    message: "You were invited to review BBQ Dinner. Your estimated share is ₩21,000.",
    read: false,
    createdAt: now
  }
];

export const demoArtifacts: Artifact[] = [
  {
    id: "artifact-bbq-proposal",
    type: "proposal_draft",
    title: "BBQ Dinner proposal",
    summary: "Itemized proposal with Daniel excluded from beef and payer reimbursement calculated.",
    proposalId: "bbq-dinner",
    createdAt: now
  },
  {
    id: "artifact-bbq-settlement",
    type: "settlement_plan",
    title: "BBQ settlement plan",
    summary: "Deterministic debtor-to-creditor settlement instructions for the BBQ proposal.",
    proposalId: "bbq-dinner",
    createdAt: now
  }
];

export const demoChats: ChatSession[] = [
  {
    id: "chat-bbq-intake",
    title: "BBQ proposal setup",
    messages: demoMessages,
    artifactIds: demoArtifacts.map((artifact) => artifact.id),
    createdAt: "2026-05-22T10:21:00.000+09:00",
    updatedAt: now
  }
];

export const defaultGroup: SplitFlowGroup = {
  id: "bbq-crew",
  name: "BBQ Crew",
  description: "Default reviewer group for the BBQ split agreement demo.",
  members: demoProposal.participants,
  proposals: [demoProposal],
  chats: demoChats,
  artifacts: demoArtifacts,
  analyticsSummary: deriveGroupAnalytics({ proposals: [demoProposal] } as SplitFlowGroup),
  createdAt: now,
  updatedAt: now
};

export const initialState: AppState = {
  currentUser: "organizer",
  selectedGroupId: defaultGroup.id,
  selectedChatIdByGroupId: { [defaultGroup.id]: demoChats[0].id },
  groups: [defaultGroup],
  workspacePanel: null,
  globalNotifications: demoNotifications,
  agentSteps: demoAgentSteps,
  aiUnavailable: false
};

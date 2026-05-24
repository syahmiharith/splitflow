import type { Artifact, SplitFlowGroup } from "@/lib/types";

function artifactMatchKey(artifact: Artifact): string {
  return artifact.stableKey ?? `${artifact.proposalId ?? artifact.id}:${artifact.type}`;
}

export function upsertArtifactsForChat(group: SplitFlowGroup, chatId: string, incomingArtifacts: Artifact[]): SplitFlowGroup {
  if (incomingArtifacts.length === 0) return group;

  const existingByKey = new Map(group.artifacts.map((artifact) => [artifactMatchKey(artifact), artifact]));
  const upserted = incomingArtifacts.map((artifact) => {
    const existing = existingByKey.get(artifactMatchKey(artifact));
    return existing
      ? {
          ...existing,
          ...artifact,
          id: existing.id,
          createdAt: existing.createdAt,
          stableKey: artifact.stableKey ?? existing.stableKey,
          sourceHash: artifact.sourceHash ?? existing.sourceHash
        }
      : artifact;
  });
  const upsertedIds = new Set(upserted.map((artifact) => artifact.id));
  const incomingKeys = new Set(upserted.map(artifactMatchKey));
  const artifacts = [...upserted, ...group.artifacts.filter((artifact) => !upsertedIds.has(artifact.id) && !incomingKeys.has(artifactMatchKey(artifact)))];

  return {
    ...group,
    artifacts,
    chats: group.chats.map((chat) =>
      chat.id === chatId
        ? {
            ...chat,
            artifactIds: Array.from(new Set([...upserted.map((artifact) => artifact.id), ...chat.artifactIds])),
            updatedAt: new Date().toISOString()
          }
        : chat
    )
  };
}

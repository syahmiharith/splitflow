"use client";

import { FileText } from "lucide-react";
import { humanStatus } from "@/lib/format";
import type { Artifact } from "@/lib/types";

export function ArtifactPreviewGrid({
  artifacts,
  onOpenArtifact
}: {
  artifacts: Artifact[];
  onOpenArtifact: (artifactId: string) => void;
}) {
  if (artifacts.length === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2" data-testid="artifact-preview-list">
      {artifacts.map((artifact) => (
        <button
          key={artifact.id}
          type="button"
          data-testid={`artifact-preview-${artifact.type}`}
          onClick={() => onOpenArtifact(artifact.id)}
          className="rounded-lg border border-app-border bg-white p-4 text-left hover:border-blue-200 hover:bg-blue-50"
        >
          <div className="flex items-center gap-2 text-sm font-bold">
            <FileText className="h-4 w-4 text-app-blue" aria-hidden="true" />
            {artifact.title}
          </div>
          <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-app-muted">{humanStatus(artifact.type)}</div>
          <p className="mt-2 text-sm leading-6 text-app-muted">{artifact.summary}</p>
        </button>
      ))}
    </div>
  );
}

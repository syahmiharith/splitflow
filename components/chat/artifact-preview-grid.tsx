"use client";

import { FileText } from "lucide-react";
import { humanStatus } from "@/lib/format";
import type { Artifact } from "@/lib/types";

export function ArtifactPreviewGroup({
  artifacts,
  onOpenArtifact
}: {
  artifacts: Artifact[];
  onOpenArtifact: (artifactId: string) => void;
}) {
  if (artifacts.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-app-border bg-white p-3" data-testid="artifact-preview-list">
      <div className="text-xs font-bold uppercase tracking-wide text-app-muted">Artifacts</div>
      {artifacts.map((artifact) => (
        <div
          key={artifact.id}
          data-testid={`artifact-preview-${artifact.type}`}
          role="button"
          tabIndex={0}
          onClick={() => onOpenArtifact(artifact.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpenArtifact(artifact.id);
            }
          }}
          className="flex cursor-pointer items-center gap-3 rounded-md border border-app-border bg-slate-50 px-3 py-2 hover:border-blue-200 hover:bg-blue-50"
        >
          <FileText className="h-4 w-4 shrink-0 text-app-blue" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-app-text">{artifact.title}</div>
            <p className="truncate text-xs text-app-muted">{artifact.summary}</p>
          </div>
          <span className="hidden shrink-0 rounded-md bg-white px-2 py-1 text-xs font-bold text-app-muted sm:inline-flex">{humanStatus(artifact.type)}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenArtifact(artifact.id);
            }}
            className="shrink-0 rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-bold text-app-blue hover:bg-blue-50"
          >
            Open
          </button>
        </div>
      ))}
    </div>
  );
}

export function ArtifactPreviewGrid(props: { artifacts: Artifact[]; onOpenArtifact: (artifactId: string) => void }) {
  return <ArtifactPreviewGroup {...props} />;
}

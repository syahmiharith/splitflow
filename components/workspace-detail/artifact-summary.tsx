"use client";

import type { Artifact } from "@/lib/types";

export function ArtifactSummary({ artifact }: { artifact: Artifact }) {
  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50 p-3">
      <div className="text-sm font-semibold text-app-blue">Artifact preview</div>
      <p className="mt-2 text-sm leading-6 text-app-text">{artifact.summary}</p>
      {artifact.bundleSections?.some((section) => section.available) ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {artifact.bundleSections
            .filter((section) => section.available)
            .map((section) => (
              <span key={section.id} className="rounded-md border border-blue-100 bg-white px-2 py-1 text-xs font-bold text-app-text">
                {section.label}
                {typeof section.count === "number" && section.count > 0 ? ` ${section.count}` : ""}
              </span>
            ))}
        </div>
      ) : null}
      {artifact.details && artifact.details.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm leading-6 text-app-text">
          {artifact.details.map((detail) => (
            <li key={detail} className="rounded-md bg-white/70 px-2 py-1">
              {detail}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

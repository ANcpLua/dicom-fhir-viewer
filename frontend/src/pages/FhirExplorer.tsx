import { useState } from "react";
import { useFhirLists } from "../hooks/useFhirLists.js";
import { useFhirResource, type FhirResourceType } from "../hooks/useFhirResource.js";
import { useFhirSync } from "../hooks/useFhirSync.js";
import type {
  FhirImagingStudySummary,
  FhirPatientSummary,
  FhirResource,
} from "../lib/types.js";

const RESOURCE_TYPES: ReadonlyArray<FhirResourceType> = ["Patient", "ImagingStudy"];

export function FhirExplorer() {
  const [tab, setTab] = useState<FhirResourceType>("Patient");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { lists, loading, error, refetch } = useFhirLists();
  const selected = useFhirResource<FhirResource>(tab, selectedId);
  const { syncing, message: syncMessage, sync } = useFhirSync(refetch);

  const onTabSwitch = (next: FhirResourceType) => {
    setTab(next);
    setSelectedId(null);
  };

  const bundle = lists === null ? null : tab === "Patient" ? lists.patients : lists.studies;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="section-label mb-1.5">
            Interoperability
          </p>
          <h2 className="text-[28px] font-semibold tracking-tight text-ink-50 leading-tight">
            FHIR Explorer
          </h2>
          <p className="text-[13px] text-ink-400 mt-1">
            Raw FHIR R4 Patient / ImagingStudy JSON from the Silver-layer SQLite store.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {syncMessage && <span className="text-[12px] text-ink-400">{syncMessage}</span>}
          <button
            type="button"
            onClick={() => void sync()}
            disabled={syncing}
            className="btn-primary"
          >
            {syncing ? "Syncing…" : "Sync from Orthanc"}
          </button>
        </div>
      </header>

      <div role="tablist" className="flex gap-0.5 border-b hairline">
        {RESOURCE_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => onTabSwitch(t)}
            className={[
              "relative px-3.5 py-2 text-[13px] font-medium tracking-tight transition-colors duration-150",
              tab === t ? "text-ink-50" : "text-ink-500 hover:text-ink-200",
            ].join(" ")}
          >
            {t}
            <span
              aria-hidden="true"
              className={[
                "absolute left-2.5 right-2.5 -bottom-px h-[2px] rounded-full transition-opacity duration-150",
                "bg-gradient-to-r from-accent-500 via-accent-400 to-accent-300",
                tab === t ? "opacity-100" : "opacity-0",
              ].join(" ")}
            />
          </button>
        ))}
      </div>

      {loading && <p className="text-ink-400 italic text-sm">Loading resources…</p>}
      {error && (
        <p role="alert" className="text-red-400 text-sm">
          Error: {error}
        </p>
      )}

      {bundle !== null && (
        <div className="grid grid-cols-[18rem_1fr] gap-4 items-start">
          <ResourceList
            items={bundle.entry.map(({ resource }) => ({
              id: resource.id,
              label: labelFor(tab, resource),
            }))}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <ResourceJson
            selectedId={selectedId}
            resource={selected.resource}
            loading={selected.loading}
            error={selected.error}
          />
        </div>
      )}
    </div>
  );
}

interface ResourceListItem {
  readonly id: string;
  readonly label: string;
}

function ResourceList({
  items,
  selectedId,
  onSelect,
}: {
  readonly items: ReadonlyArray<ResourceListItem>;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="surface p-5">
        <p className="text-ink-500 italic text-[13px]">
          No resources yet. Click "Sync from Orthanc".
        </p>
      </div>
    );
  }
  return (
    <nav aria-label="FHIR resource list" className="surface p-1.5 space-y-0.5">
      {items.map((item) => {
        const active = selectedId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={[
              "w-full text-left px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150",
              active
                ? "bg-accent-500/10 text-ink-50 border border-accent-500/20"
                : "text-ink-300 hover:bg-white/[0.025] hover:text-ink-100 border border-transparent",
            ].join(" ")}
          >
            <div className="font-medium truncate tracking-tight">{item.label}</div>
            <div className="text-[10px] font-mono text-ink-500 truncate mt-0.5">
              {item.id}
            </div>
          </button>
        );
      })}
    </nav>
  );
}

function ResourceJson({
  selectedId,
  resource,
  loading,
  error,
}: {
  readonly selectedId: string | null;
  readonly resource: FhirResource | null;
  readonly loading: boolean;
  readonly error: string | null;
}) {
  return (
    <div className="surface p-4 overflow-auto max-h-[70vh]">
      {selectedId === null && (
        <p className="text-ink-500 italic text-[13px]">
          Select a resource on the left to view its JSON.
        </p>
      )}
      {loading && <p className="text-ink-500 italic text-[13px]">Loading resource…</p>}
      {error && (
        <p role="alert" className="text-red-400 text-[13px]">
          Error: {error}
        </p>
      )}
      {resource && (
        <pre className="text-[12px] font-mono text-ink-200 whitespace-pre-wrap leading-relaxed">
          {JSON.stringify(resource, null, 2)}
        </pre>
      )}
    </div>
  );
}

function labelFor(type: FhirResourceType, resource: FhirResource): string {
  if (type === "Patient") return (resource as FhirPatientSummary).name?.[0]?.text ?? resource.id;
  return (resource as FhirImagingStudySummary).description ?? resource.id;
}

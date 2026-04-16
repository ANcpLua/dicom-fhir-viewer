import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ImageViewer } from "../components/ImageViewer.js";
import { TagsPanel } from "../components/TagsPanel.js";
import { useStudyDetail } from "../hooks/useStudyDetail.js";
import type { Instance, Series } from "../lib/types.js";

export function StudyDetail() {
  const params = useParams<{ studyUid: string }>();
  const studyUid = params.studyUid ?? "";
  const { detail, loading, error } = useStudyDetail(studyUid);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selected = useMemo(() => {
    if (detail === null) return null;
    const pairs = detail.series.flatMap((series) =>
      series.instances.map((instance) => ({ series, instance })),
    );
    const match = pairs.find(
      ({ series, instance }) =>
        selectedKey === null ||
        selectedKey === `${series.seriesInstanceUid}::${instance.sopInstanceUid}`,
    );
    return match ?? null;
  }, [detail, selectedKey]);

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        to="/studies"
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-200 transition-colors duration-150"
      >
        <span aria-hidden="true">←</span> Back to Study Browser
      </Link>

      {loading && <p className="text-ink-400 italic text-sm">Loading study…</p>}
      {error && (
        <p role="alert" className="text-red-400 text-sm">
          Error: {error}
        </p>
      )}

      {detail !== null && (
        <>
          <header>
            <p className="section-label mb-1.5">
              Patient
            </p>
            <h2 className="text-[28px] font-semibold tracking-tight text-ink-50 leading-tight">
              {detail.patientName ?? "(no patient name)"}
            </h2>
            <p className="text-[10px] font-mono text-ink-500 break-all mt-1.5">{studyUid}</p>
          </header>

          <div className="grid grid-cols-[16rem_1fr_18rem] gap-4 items-start">
            <SeriesList
              detail={detail}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
            />

            <div>
              {selected !== null ? (
                <ImageViewer
                  studyInstanceUid={studyUid}
                  seriesInstanceUid={selected.series.seriesInstanceUid}
                  sopInstanceUid={selected.instance.sopInstanceUid}
                />
              ) : (
                <div className="surface aspect-square flex items-center justify-center">
                  <p className="text-ink-500 text-[13px]">No instance available.</p>
                </div>
              )}
            </div>

            {selected !== null && (
              <TagsPanel detail={detail} series={selected.series} instance={selected.instance} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface SeriesListProps {
  readonly detail: { readonly series: ReadonlyArray<Series> };
  readonly selectedKey: string | null;
  readonly onSelect: (key: string) => void;
}

function SeriesList({ detail, selectedKey, onSelect }: SeriesListProps) {
  if (detail.series.length === 0) {
    return <p className="text-ink-500 italic text-[13px]">No series found.</p>;
  }
  return (
    <nav aria-label="Series and instances" className="space-y-2.5">
      {detail.series.map((series) => (
        <section key={series.seriesInstanceUid} className="surface p-3.5">
          <header className="mb-2.5 pb-2.5 border-b hairline">
            <h3 className="text-[13px] font-semibold text-ink-200 tracking-tight">
              Series {series.seriesNumber ?? "—"} · {series.modality ?? "—"}
            </h3>
            <p className="text-[11px] text-ink-500 truncate mt-0.5">
              {series.seriesDescription ?? "—"}
            </p>
          </header>
          <ul className="space-y-0.5">
            {series.instances.map((instance) => (
              <InstanceButton
                key={instance.sopInstanceUid}
                series={series}
                instance={instance}
                selectedKey={selectedKey}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

interface InstanceButtonProps {
  readonly series: Series;
  readonly instance: Instance;
  readonly selectedKey: string | null;
  readonly onSelect: (key: string) => void;
}

function InstanceButton({ series, instance, selectedKey, onSelect }: InstanceButtonProps) {
  const key = `${series.seriesInstanceUid}::${instance.sopInstanceUid}`;
  const active = selectedKey === key || (selectedKey === null && instance.instanceNumber === 1);
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(key)}
        className={[
          "w-full text-left text-[12px] px-2 py-1.5 rounded-lg transition-all duration-150",
          active
            ? "bg-accent-500/10 text-accent-300 border border-accent-500/20"
            : "text-ink-400 hover:bg-white/[0.025] hover:text-ink-200 border border-transparent",
        ].join(" ")}
      >
        Instance {instance.instanceNumber ?? "—"}
        {instance.rows !== null && instance.columns !== null && (
          <span className="text-ink-500 ml-2 font-mono text-[10px]">
            {instance.columns}×{instance.rows}
          </span>
        )}
      </button>
    </li>
  );
}

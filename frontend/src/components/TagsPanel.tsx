import { formatDicomDate } from "../lib/dicom-format.js";
import type { Instance, Series, StudyDetail } from "../lib/types.js";

export interface TagsPanelProps {
  readonly detail: StudyDetail;
  readonly series: Series;
  readonly instance: Instance;
}

interface DisplayTag {
  readonly label: string;
  readonly value: string;
}

export function TagsPanel({ detail, series, instance }: TagsPanelProps) {
  const tags = collectTags(detail, series, instance);
  return (
    <aside className="surface p-4">
      <h4 className="section-label mb-4 flex items-center gap-2">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-accent-500/15 border border-accent-400/25 text-accent-300 text-[9px] font-semibold tracking-widest">DICOM</span>
        Tags
      </h4>
      <dl className="text-[13px]">
        {tags.map((tag, idx) => (
          <div
            key={tag.label}
            className={[
              "grid grid-cols-[8rem_1fr] gap-2 items-baseline px-2 py-1.5 -mx-2 rounded-md transition-colors duration-100",
              idx % 2 === 0 ? "bg-white/[0.015]" : "",
            ].join(" ")}
          >
            <dt className="text-[10px] uppercase tracking-wider text-ink-500 font-medium">
              {tag.label}
            </dt>
            <dd className="text-ink-200 break-all tracking-tight">{tag.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function collectTags(detail: StudyDetail, series: Series, instance: Instance): DisplayTag[] {
  return [
    { label: "Patient Name", value: detail.patientName ?? "—" },
    { label: "Patient ID", value: detail.patientId ?? "—" },
    { label: "Patient Sex", value: detail.patientSex ?? "—" },
    { label: "Study Date", value: formatDicomDate(detail.studyDate) },
    { label: "Study Description", value: detail.studyDescription ?? "—" },
    { label: "Modality", value: series.modality ?? "—" },
    { label: "Manufacturer", value: series.manufacturer ?? "—" },
    { label: "Series #", value: series.seriesNumber?.toString() ?? "—" },
    { label: "Series Description", value: series.seriesDescription ?? "—" },
    { label: "Instance #", value: instance.instanceNumber?.toString() ?? "—" },
    { label: "Dimensions", value: formatDimensions(instance) },
    { label: "Bits Allocated", value: instance.bitsAllocated?.toString() ?? "—" },
    { label: "SOP Class UID", value: instance.sopClassUid ?? "—" },
  ];
}

function formatDimensions(instance: Instance): string {
  if (instance.rows === null && instance.columns === null) return "—";
  return `${instance.columns ?? "?"} × ${instance.rows ?? "?"}`;
}

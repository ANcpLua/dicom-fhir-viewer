import { Link } from "react-router-dom";
import { formatDicomDate } from "../lib/dicom-format.js";
import type { Study } from "../lib/types.js";

export interface StudyTableProps {
  readonly studies: ReadonlyArray<Study>;
}

export function StudyTable({ studies }: StudyTableProps) {
  if (studies.length === 0) {
    return (
      <div className="surface p-8 text-center">
        <p className="text-ink-400 text-[13px]">
          No studies stored yet. Upload a DICOM file to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left border-b hairline text-ink-500 text-[10px] font-medium uppercase tracking-[0.14em]">
              <th scope="col" className="py-3 px-4">Patient</th>
              <th scope="col" className="py-3 px-4">Patient ID</th>
              <th scope="col" className="py-3 px-4">Study Date</th>
              <th scope="col" className="py-3 px-4">Description</th>
              <th scope="col" className="py-3 px-4 text-right">Series</th>
              <th scope="col" className="py-3 px-4 text-right">Instances</th>
            </tr>
          </thead>
          <tbody>
            {studies.map((s, idx) => (
              <tr
                key={s.studyInstanceUid}
                className={[
                  "group transition-colors duration-150",
                  idx === studies.length - 1 ? "" : "border-b hairline",
                  "hover:bg-white/[0.02]",
                ].join(" ")}
              >
                <td className="py-3 px-4">
                  <Link
                    to={`/studies/${encodeURIComponent(s.studyInstanceUid)}`}
                    className="text-accent-300 hover:text-accent-400 font-medium tracking-tight transition-colors duration-150"
                  >
                    {s.patientName ?? "—"}
                  </Link>
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-ink-500">
                  {s.patientId ?? "—"}
                </td>
                <td className="py-3 px-4 tabular-nums text-ink-300">
                  {formatDicomDate(s.studyDate)}
                </td>
                <td className="py-3 px-4 text-ink-300">{s.studyDescription ?? "—"}</td>
                <td className="py-3 px-4 text-right tabular-nums text-ink-300">
                  {s.numberOfSeries ?? "—"}
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-ink-300">
                  {s.numberOfInstances ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

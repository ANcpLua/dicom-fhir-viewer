import { DicomUpload } from "../components/DicomUpload.js";
import { StudyTable } from "../components/StudyTable.js";
import { useStudies } from "../hooks/useStudies.js";

export function StudyBrowser() {
  const { studies, loading, error, refetch } = useStudies();

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="section-label mb-1.5">
          DICOMweb
        </p>
        <h2 className="text-[28px] font-semibold tracking-tight text-ink-50 leading-tight">
          Study Browser
        </h2>
        <p className="text-[13px] text-ink-400 mt-1">
          Upload DICOM files and browse stored studies from the Orthanc archive.
        </p>
      </header>

      <section aria-labelledby="upload-heading" className="space-y-3">
        <h3
          id="upload-heading"
          className="section-label"
        >
          Upload
        </h3>
        <DicomUpload onUploaded={refetch} />
      </section>

      <section aria-labelledby="studies-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3
            id="studies-heading"
            className="section-label"
          >
            Studies
          </h3>
          <button type="button" onClick={refetch} className="btn-ghost">
            Refresh
          </button>
        </div>
        {loading && <p className="text-ink-400 italic text-sm">Loading studies…</p>}
        {error && (
          <p role="alert" className="text-red-400 text-sm">
            Error: {error}
          </p>
        )}
        {!loading && !error && <StudyTable studies={studies} />}
      </section>
    </div>
  );
}

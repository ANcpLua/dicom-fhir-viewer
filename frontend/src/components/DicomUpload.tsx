import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";
import { useUpload } from "../hooks/useUpload.js";

export interface DicomUploadProps {
  readonly onUploaded?: () => void;
}

export function DicomUpload({ onUploaded }: DicomUploadProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, lastResult, error } = useUpload(onUploaded);

  const handleFiles = (files: FileList | null): void => {
    if (files === null || files.length === 0) return;
    void upload(Array.from(files));
  };

  const onClick = (): void => {
    inputRef.current?.click();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  const onDragEnter = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragging(true);
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragging(false);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
  };

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>): void => {
    handleFiles(event.target.files);
    event.target.value = "";
  };

  const dropzoneClass = [
    "relative overflow-hidden rounded-xl p-10 text-center cursor-pointer",
    "transition-all duration-200 ease-out",
    "border border-dashed",
    dragging
      ? "border-accent-400/50 bg-accent-500/[0.04] scale-[1.005]"
      : "border-white/[0.08] hover:border-white/[0.14] hover:bg-white/[0.01]",
  ].join(" ");

  return (
    <div className="space-y-2.5">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload DICOM files"
        onClick={onClick}
        onKeyDown={onKeyDown}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={dropzoneClass}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(400px 160px at 50% 0%, rgba(96,165,250,0.10), transparent 70%)",
          }}
        />
        <div className="relative">
          <div
            aria-hidden="true"
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.07] text-ink-300"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v13" />
              <path d="m7 8 5-5 5 5" />
              <rect x="3" y="16" width="18" height="5" rx="1.5" />
            </svg>
          </div>
          <p className="text-[14px] font-medium text-ink-100 tracking-tight">
            Drop DICOM files here
          </p>
          <p className="text-[12px] text-ink-500 mt-1">
            or click to select <span className="font-mono text-ink-500">.dcm</span>
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".dcm,application/dicom"
          className="hidden"
          onChange={onChange}
          data-testid="dicom-file-input"
        />
      </div>
      {uploading && (
        <p role="status" className="text-[13px] text-ink-300 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-accent-400 animate-pulse"
          />
          Uploading…
        </p>
      )}
      {lastResult && !error && (
        <p role="status" className="text-[13px] text-emerald-400 flex items-center gap-2">
          <span aria-hidden="true">✓</span>
          Uploaded {lastResult.fileCount} file(s): {lastResult.referencedSopCount} stored,{" "}
          {lastResult.failedSopCount} failed.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-red-400">
          Upload error: {error}
        </p>
      )}
    </div>
  );
}

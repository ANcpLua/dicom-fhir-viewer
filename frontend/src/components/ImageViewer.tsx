import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { getBackendUrl } from "../lib/env.js";
import {
  decodeDicomInstance,
  formatDecodeError,
  renderToImageData,
  type DecodedInstance,
} from "../lib/dicom-pixels.js";

export interface ImageViewerProps {
  readonly studyInstanceUid: string;
  readonly seriesInstanceUid: string;
  readonly sopInstanceUid: string;
}

type ViewerState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready" }
  | { readonly kind: "error"; readonly message: string };

interface WindowLevel {
  readonly center: number;
  readonly width: number;
}

interface DragState {
  readonly startX: number;
  readonly startY: number;
  readonly startCenter: number;
  readonly startWidth: number;
}

export function ImageViewer(props: ImageViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<DecodedInstance | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [state, setState] = useState<ViewerState>({ kind: "loading" });
  const [wl, setWl] = useState<WindowLevel | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    setState({ kind: "loading" });
    setWl(null);
    instanceRef.current = null;

    const url =
      `${getBackendUrl()}/api/wado/instance` +
      `/${encodeURIComponent(props.studyInstanceUid)}` +
      `/${encodeURIComponent(props.seriesInstanceUid)}` +
      `/${encodeURIComponent(props.sopInstanceUid)}`;

    fetch(url, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return new Uint8Array(await res.arrayBuffer());
      })
      .then((bytes) => {
        if (cancelled) return;
        const result = decodeDicomInstance(bytes);
        if (!result.ok) {
          setState({ kind: "error", message: formatDecodeError(result.error) });
          return;
        }
        instanceRef.current = result.value;
        setWl({ center: result.value.windowCenter, width: result.value.windowWidth });
        setState({ kind: "ready" });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [props.studyInstanceUid, props.seriesInstanceUid, props.sopInstanceUid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const instance = instanceRef.current;
    if (canvas === null || instance === null || wl === null) return;
    canvas.width = instance.columns;
    canvas.height = instance.rows;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    ctx.putImageData(renderToImageData(instance, wl.center, wl.width), 0, 0);
  }, [wl, state]);

  const onMouseDown = (event: ReactMouseEvent<HTMLCanvasElement>): void => {
    if (wl === null || event.button !== 0) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startCenter: wl.center,
      startWidth: wl.width,
    };
    event.preventDefault();
  };

  const onMouseMove = (event: ReactMouseEvent<HTMLCanvasElement>): void => {
    const drag = dragRef.current;
    if (drag === null) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setWl({
      center: drag.startCenter + dy * 2,
      width: Math.max(1, drag.startWidth + dx * 2),
    });
  };

  const clearDrag = (): void => {
    dragRef.current = null;
  };

  return (
    <div
      role="img"
      aria-label={`DICOM instance ${props.sopInstanceUid}`}
      className={[
        "surface relative bg-black aspect-square overflow-hidden transition-shadow duration-300",
        state.kind === "ready" ? "shadow-[0_0_32px_-8px_rgba(96,165,250,0.15)]" : "",
      ].join(" ")}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={clearDrag}
        onMouseLeave={clearDrag}
        data-testid="dicom-canvas"
      />
      {state.kind === "loading" && (
        <p className="absolute inset-0 flex items-center justify-center text-ink-500 text-[13px] pointer-events-none animate-shimmer">
          Loading DICOM…
        </p>
      )}
      {state.kind === "error" && (
        <p
          role="alert"
          className="absolute inset-0 flex items-center justify-center text-red-400 text-[12px] p-4 text-center pointer-events-none"
        >
          {state.message}
        </p>
      )}
      {state.kind === "ready" && wl !== null && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex justify-between text-[10px] font-mono text-ink-400 pointer-events-none select-none">
          <span className="chip">Drag · window / level</span>
          <span className="chip tabular-nums">
            C {Math.round(wl.center)} / W {Math.round(wl.width)}
          </span>
        </div>
      )}
    </div>
  );
}

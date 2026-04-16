import "@testing-library/jest-dom/vitest";

// jsdom logs a noisy "HTMLCanvasElement.prototype.getContext not implemented"
// warning every time component code touches canvas. The ImageViewer already
// handles `getContext` returning null gracefully, so suppress the warning by
// stubbing getContext to null at the prototype level.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

// jsdom doesn't ship a constructable ImageData; dicom-pixels.ts needs it at
// import time for the canvas-rendering helper. This is a structural stub, not
// a full canvas polyfill — it's enough for pure-function tests of pixel
// transforms that read back via `.data`.
if (typeof globalThis.ImageData === "undefined") {
  class ImageDataStub {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8ClampedArray;
    readonly colorSpace: "srgb" = "srgb";
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  }
  (globalThis as unknown as { ImageData: typeof ImageData }).ImageData =
    ImageDataStub as unknown as typeof ImageData;
}

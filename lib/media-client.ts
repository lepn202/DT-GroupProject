// Browser-side media handling (architecture §5.3): photos are resized, videos are reduced to
// ~4 still frames with <video> + <canvas>. No server-side media processing.

const MAX_EDGE = 1568;

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", quality),
  );
}

function drawScaled(source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Resizes a photo to ≤ 1568 px on the long edge and re-encodes it as JPEG. */
export async function resizePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = drawScaled(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  return canvasToJpeg(canvas);
}

export const MAX_VIDEO_SECONDS = 30;

/** Extracts `count` evenly spaced JPEG frames from a video file. */
export async function extractFrames(file: File, count = 4): Promise<{ frames: Blob[]; duration: number }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("This video format can't be read in the browser"));
    });
    const duration = video.duration;
    const frames: Blob[] = [];
    for (let i = 0; i < count; i++) {
      const t = (duration * (i + 0.5)) / count;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        video.currentTime = t;
      });
      frames.push(await canvasToJpeg(drawScaled(video, video.videoWidth, video.videoHeight), 0.8));
    }
    return { frames, duration };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------- Web Speech API (voice memos)

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

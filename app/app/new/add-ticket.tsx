"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Camera, Check, Mic, Square, Video, X } from "lucide-react";
import { Button, ErrorNote, Textarea } from "@/components/ui";
import { submitReport } from "@/lib/actions/tenant";
import { extractFrames, getSpeechRecognition, MAX_VIDEO_SECONDS, resizePhoto } from "@/lib/media-client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

type Attachment =
  | { kind: "photo"; blob: Blob; preview: string }
  | { kind: "video"; file: File; frames: Blob[]; preview: string };

export function AddTicket({ userId, flat, building }: { userId: string; flat: string; building: string }) {
  const router = useRouter();
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [text, setText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [recording, setRecording] = useState(false);
  // Web Speech API support is a browser fact; assume yes on the server, check on the client.
  const speechSupported = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(getSpeechRecognition()),
    () => true,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [received, setReceived] = useState(false);
  const recognition = useRef<ReturnType<typeof startRecognition> | null>(null);

  useEffect(() => () => recognition.current?.stop(), []);

  async function onPhoto(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy("Preparing photo…");
    try {
      const added: Attachment[] = [];
      for (const file of Array.from(files).slice(0, 4)) {
        const blob = await resizePhoto(file);
        added.push({ kind: "photo", blob, preview: URL.createObjectURL(blob) });
      }
      setAttachments((a) => [...a, ...added].slice(0, 4));
    } catch {
      setError("That photo couldn't be read. Try another one.");
    } finally {
      setBusy(null);
    }
  }

  async function onVideo(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setBusy("Preparing video…");
    try {
      const { frames, duration } = await extractFrames(file);
      if (duration > MAX_VIDEO_SECONDS + 1) {
        setError(`Videos can be up to ${MAX_VIDEO_SECONDS} seconds. Try a shorter one.`);
        return;
      }
      setAttachments((a) => [
        ...a.filter((x) => x.kind !== "video"),
        { kind: "video", file, frames, preview: URL.createObjectURL(frames[0]) },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That video couldn't be read.");
    } finally {
      setBusy(null);
    }
  }

  function startRecognition() {
    const SR = getSpeechRecognition()!;
    const r = new SR();
    r.lang = "en-GB";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      if (finalText) setTranscript((t) => `${t} ${finalText}`.trim());
      setInterim(interimText);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") setError("Allow microphone access to record a voice memo.");
      setRecording(false);
    };
    r.onend = () => {
      setRecording(false);
      setInterim("");
    };
    r.start();
    return r;
  }

  function toggleVoice() {
    setError(null);
    if (recording) {
      recognition.current?.stop();
      setRecording(false);
      return;
    }
    recognition.current = startRecognition();
    setRecording(true);
  }

  async function upload(blob: Blob, ext: string) {
    const supabase = createClient();
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, blob, { contentType: blob.type || undefined });
    if (error) throw new Error(error.message);
    return path;
  }

  async function submit() {
    recognition.current?.stop();
    setError(null);
    setBusy("Sending…");
    try {
      const mediaPaths: string[] = [];
      const framePaths: string[] = [];
      for (const a of attachments) {
        if (a.kind === "photo") mediaPaths.push(await upload(a.blob, "jpg"));
        else {
          const ext = a.file.name.split(".").pop()?.toLowerCase() || "mp4";
          mediaPaths.push(await upload(a.file, ext));
          for (const f of a.frames) framePaths.push(await upload(f, "jpg"));
        }
      }
      const result = await submitReport({
        text: text.trim() || null,
        transcript: transcript.trim() || null,
        mediaPaths,
        framePaths,
      });
      if ("error" in result) {
        setError(result.error);
        setBusy(null);
        return;
      }
      setBusy(null);
      setReceived(true);
      setTimeout(() => router.push(`/app/tickets/${result.ticketId}`), 1400);
    } catch (e) {
      setError(e instanceof Error ? `Upload failed: ${e.message}` : "Upload failed. Try again.");
      setBusy(null);
    }
  }

  const hasContent = attachments.length > 0 || transcript.trim() || text.trim();

  if (received) {
    return (
      <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-2)]">
          <Check className="size-8" strokeWidth={2.5} aria-hidden />
        </span>
        <h1 className="text-[28px] leading-[34px] font-bold">Received, we&apos;re on it</h1>
        <p className="text-muted-foreground">Your ticket is on Home now. We&apos;ll tell you what happens next.</p>
      </div>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="text-[13px] text-muted-foreground">
          Flat {flat} · {building}
        </span>
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.01em]">What&apos;s wrong?</h1>
        <p className="text-muted-foreground">Show us or tell us. We&apos;ll work out the rest, no forms.</p>
      </header>

      <input ref={photoInput} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onPhoto(e.target.files)} />
      <input ref={videoInput} type="file" accept="video/*" capture="environment" className="sr-only" onChange={(e) => onVideo(e.target.files)} />

      <div className="flex flex-col gap-3">
        <MediaButton primary icon={<Camera className="size-7" strokeWidth={1.75} aria-hidden />} title="Take a photo" hint="Fastest way to report" onClick={() => photoInput.current?.click()} />
        <MediaButton icon={<Video className="size-7" strokeWidth={1.75} aria-hidden />} title="Record a video" hint={`Up to ${MAX_VIDEO_SECONDS} seconds`} onClick={() => videoInput.current?.click()} />
        {speechSupported && (
          <MediaButton
            active={recording}
            icon={recording ? <Square className="size-6 fill-current" aria-hidden /> : <Mic className="size-7" strokeWidth={1.75} aria-hidden />}
            title={recording ? "Stop recording" : "Record a voice memo"}
            hint={recording ? "Listening… say what happened" : "Just say what happened"}
            onClick={toggleVoice}
          />
        )}
      </div>

      {(transcript || interim) && (
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
          <span className="label-caps text-muted-foreground">Voice memo</span>
          <p>
            {transcript} <span className="text-muted-foreground">{interim}</span>
          </p>
          {!recording && (
            <button type="button" className="self-start text-sm font-semibold text-primary" onClick={() => setTranscript("")}>
              Clear
            </button>
          )}
        </div>
      )}

      {attachments.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {attachments.map((a, i) => (
            <li key={a.preview} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img src={a.preview} alt={a.kind === "video" ? "Video frame" : "Photo"} className="size-full object-cover" />
              {a.kind === "video" && <Video className="absolute bottom-1 left-1 size-4 text-white drop-shadow" aria-hidden />}
              <button
                type="button"
                aria-label="Remove"
                onClick={() => setAttachments((list) => list.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-foreground/70 text-white"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">
          Anything to add? <span className="font-normal text-muted-foreground">Optional</span>
        </span>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Water under the kitchen sink" rows={3} />
      </label>

      {!speechSupported && <p className="text-sm text-muted-foreground">Voice memos aren&apos;t supported in this browser. You can type instead.</p>}
      <ErrorNote>{error}</ErrorNote>

      <Button onClick={submit} disabled={!hasContent || Boolean(busy) || recording} className="w-full">
        {busy ?? "Send report"}
      </Button>
    </>
  );
}

function MediaButton({
  icon,
  title,
  hint,
  onClick,
  primary,
  active,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  primary?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[72px] items-center gap-4 rounded-2xl px-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        primary ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "border border-border bg-card hover:bg-muted",
        active && "border-emergency bg-emergency-tint text-emergency-text",
      )}
    >
      {icon}
      <span className="flex flex-col">
        <span className="text-[17px] font-semibold">{title}</span>
        <span className={cn("text-sm", primary ? "text-primary-foreground/80" : "text-muted-foreground")}>{hint}</span>
      </span>
    </button>
  );
}

"use client";

import { Camera, FileText, ImagePlus, Loader2, Presentation, Type, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ErrorMessage } from "@/components/form";
import { Alert, Button, Input, Label, ProgressBar, Segmented, Textarea } from "@/components/ui";
import { compressImage } from "@/lib/image-compress";
import { cn } from "@/lib/utils";
import { createSetAction, extractPhotoTextAction } from "@/server/actions/sets";
import type { ErrorCode } from "@/server/actions/result";
import { UPLOAD_LIMITS } from "@/server/limits/config";

type Source = "text" | "pdf" | "pptx" | "photo";
type OutputLang = "auto" | "en" | "tl";

const sources: { value: Source; Icon: typeof Type }[] = [
  { value: "text", Icon: Type },
  { value: "pdf", Icon: FileText },
  { value: "pptx", Icon: Presentation },
  { value: "photo", Icon: Camera },
];

export function CreateFlow({ maxChars }: { maxChars: number }) {
  const t = useTranslations("create");
  const router = useRouter();
  const [source, setSource] = useState<Source>("text");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [outputLang, setOutputLang] = useState<OutputLang>("auto");
  const [error, setError] = useState<ErrorCode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"parsing" | "extracting" | null>(null);
  const [generating, startGenerate] = useTransition();

  const tooLong = text.length > maxChars;
  const tooShort = text.trim().length < 40;

  function resetMessages() {
    setError(null);
    setNotice(null);
  }

  async function onFile(file: File, kind: "pdf" | "pptx") {
    resetMessages();
    const limit = kind === "pdf" ? UPLOAD_LIMITS.maxPdfBytes : UPLOAD_LIMITS.maxPptxBytes;
    if (file.size > limit) {
      setNotice(t("fileTooBig", { mb: Math.round(limit / 1024 / 1024) }));
      return;
    }
    setBusy("parsing");
    try {
      const buffer = await file.arrayBuffer();
      if (kind === "pdf") {
        const { parsePdf } = await import("@/lib/parsers/pdf");
        const result = await parsePdf(buffer);
        setText(result.text);
        const hints: string[] = [];
        if (result.truncated) hints.push(t("pdfTruncated", { pages: UPLOAD_LIMITS.maxPdfPages }));
        if (result.emptyPages.length > 0) {
          hints.push(t("pdfNoText", { pages: result.emptyPages.slice(0, 8).join(", ") }));
        }
        if (hints.length) setNotice(hints.join(" "));
      } else {
        const { parsePptx } = await import("@/lib/parsers/pptx");
        const result = await parsePptx(buffer);
        setText(result.text);
        if (!result.text.trim()) setNotice(t("pptxEmpty"));
      }
      if (!title) setTitle(file.name.replace(/\.(pdf|pptx)$/i, "").slice(0, 120));
    } catch {
      setNotice(t("parseFailed"));
    } finally {
      setBusy(null);
    }
  }

  function generate() {
    resetMessages();
    startGenerate(async () => {
      const res = await createSetAction({
        text,
        title: title.trim() || undefined,
        subject: subject.trim() || undefined,
        sourceType: source,
        outputLang,
      });
      if (res.ok) router.push(`/sets/${res.data.id}`);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label={t("sourceLabel")} className="grid grid-cols-4 gap-2">
        {sources.map(({ value, Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={source === value}
            onClick={() => {
              setSource(value);
              resetMessages();
            }}
            className={cn(
              "flex min-h-18 flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-surface text-xs font-bold",
              source === value ? "border-primary text-primary" : "border-border text-muted",
            )}
          >
            <Icon aria-hidden className="size-6" />
            {t(`source.${value}`)}
          </button>
        ))}
      </div>

      {source === "pdf" && (
        <FilePicker accept="application/pdf,.pdf" label={t("pickPdf")} hint={t("pdfHint")} onFile={(f) => onFile(f, "pdf")} />
      )}
      {source === "pptx" && (
        <FilePicker
          accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          label={t("pickPptx")}
          hint={t("pptxHint")}
          onFile={(f) => onFile(f, "pptx")}
        />
      )}
      {source === "photo" && (
        <PhotoPicker
          busy={busy === "extracting"}
          onExtract={async (images) => {
            resetMessages();
            setBusy("extracting");
            const res = await extractPhotoTextAction(images);
            setBusy(null);
            if (res.ok) {
              setText((prev) => (prev ? `${prev}\n\n${res.data.text}` : res.data.text));
              setNotice(t("reviewExtracted"));
            } else {
              setError(res.error);
            }
          }}
        />
      )}

      {busy === "parsing" && (
        <p className="flex items-center gap-2 font-bold text-muted" role="status">
          <Loader2 aria-hidden className="size-5 animate-spin" /> {t("reading")}
        </p>
      )}
      {notice && <Alert tone="info">{notice}</Alert>}

      {(source === "text" || text) && (
        <div>
          <Label htmlFor="notes">{source === "text" ? t("pasteLabel") : t("reviewLabel")}</Label>
          <Textarea
            id="notes"
            rows={source === "text" ? 12 : 10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("pastePlaceholder")}
          />
          <p className={cn("mt-1 text-right text-xs", tooLong ? "font-bold text-danger" : "text-muted")}>
            {text.length.toLocaleString()} / {maxChars.toLocaleString()}
          </p>
        </div>
      )}

      {text && (
        <div className="space-y-4 rounded-3xl bg-surface p-4">
          <div>
            <Label htmlFor="title">{t("setTitle")}</Label>
            <Input id="title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={t("setTitlePlaceholder")} />
          </div>
          <div>
            <Label htmlFor="subject">{t("subject")}</Label>
            <Input id="subject" value={subject} maxLength={80} onChange={(e) => setSubject(e.target.value)} placeholder={t("subjectPlaceholder")} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-bold text-muted">{t("outputLang")}</p>
            <Segmented
              label={t("outputLang")}
              value={outputLang}
              onChange={setOutputLang}
              options={[
                { value: "auto", label: t("langAuto") },
                { value: "en", label: "English" },
                { value: "tl", label: "Tagalog" },
              ]}
            />
          </div>
        </div>
      )}

      {error && <ErrorMessage code={error} />}
      {generating ? (
        <GeneratingProgress />
      ) : (
        <Button size="lg" className="w-full" disabled={tooShort || tooLong || busy !== null} onClick={generate}>
          {t("generate")}
        </Button>
      )}
      {tooShort && text.length > 0 && <p className="text-center text-sm text-muted">{t("tooShort")}</p>}
    </div>
  );
}

function FilePicker({
  accept,
  label,
  hint,
  onFile,
}: {
  accept: string;
  label: string;
  hint: string;
  onFile: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-3xl border-2 border-dashed border-border p-6 text-center">
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <Button variant="secondary" onClick={() => ref.current?.click()}>
        {label}
      </Button>
      <p className="mt-2 text-xs text-muted">{hint}</p>
    </div>
  );
}

function PhotoPicker({ busy, onExtract }: { busy: boolean; onExtract: (images: string[]) => void }) {
  const t = useTranslations("create");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [failed, setFailed] = useState(false);

  async function add(files: FileList | null) {
    if (!files) return;
    setFailed(false);
    setCompressing(true);
    const room = UPLOAD_LIMITS.maxPhotos - images.length;
    const next: string[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      try {
        next.push(await compressImage(file));
      } catch {
        setFailed(true);
      }
    }
    setImages((prev) => [...prev, ...next].slice(0, UPLOAD_LIMITS.maxPhotos));
    setCompressing(false);
  }

  const full = images.length >= UPLOAD_LIMITS.maxPhotos;

  return (
    <div className="space-y-3 rounded-3xl border-2 border-dashed border-border p-4">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" aria-label={t("takePhoto")} onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="sr-only" aria-label={t("choosePhotos")} onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={full || compressing} onClick={() => cameraRef.current?.click()}>
          <Camera aria-hidden className="size-5" /> {t("takePhoto")}
        </Button>
        <Button variant="secondary" disabled={full || compressing} onClick={() => galleryRef.current?.click()}>
          <ImagePlus aria-hidden className="size-5" /> {t("choosePhotos")}
        </Button>
      </div>
      <p className="text-center text-xs text-muted">{t("photoHint", { max: UPLOAD_LIMITS.maxPhotos })}</p>
      {failed && <Alert tone="info">{t("photoFailed")}</Alert>}
      {images.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {images.map((src, i) => (
            <li key={i} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
              <img src={src} alt={t("photoAlt", { n: i + 1 })} className="size-full object-cover" />
              <button
                type="button"
                aria-label={t("removePhoto", { n: i + 1 })}
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {(compressing || busy) && (
        <p className="flex items-center justify-center gap-2 text-sm font-bold text-muted" role="status">
          <Loader2 aria-hidden className="size-4 animate-spin" /> {busy ? t("extracting") : t("compressing")}
        </p>
      )}
      <Button className="w-full" disabled={images.length === 0 || busy || compressing} onClick={() => onExtract(images)}>
        {t("extract")}
      </Button>
    </div>
  );
}

/** The server does the work in one request; this shows friendly stages while it runs. */
function GeneratingProgress() {
  const t = useTranslations("create");
  const stages = [t("stage1"), t("stage2"), t("stage3"), t("stage4")];
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const stage = Math.min(stages.length - 1, Math.floor(elapsed / 6));
  // Eases toward 95% so it never looks finished before it is.
  const value = 0.95 * (1 - Math.exp(-elapsed / 18));

  return (
    <div className="space-y-3 rounded-3xl bg-surface p-5" role="status" aria-live="polite">
      <p className="flex items-center gap-2 font-bold">
        <Loader2 aria-hidden className="size-5 animate-spin text-primary" /> {stages[stage]}
      </p>
      <ProgressBar value={value} label={t("generating")} />
      <p className="text-xs text-muted">{t("stayOnPage")}</p>
    </div>
  );
}

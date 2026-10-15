"use client";
/**
 * حقل رفع وسائط v3 — صور وفيديو مع شريط تقدم حقيقي
 * ★ الرفع فوري إلى /api/media (GridFS في MongoDB) — الحفظ في الإعدادات يمرر رابطاً خفيفاً فقط
 *   (يقتل جذرياً فشل "رفع وحفظ الصور والفيديوهات" الذي كان بسبب base64 في مستند 16MB)
 * ★ v3.17: الصور تُضغط في المتصفح قبل الرفع (image-compress.ts) — الفيديو والصور الصغيرة
 *   تمر كما هي — يقلص حجم قاعدة البيانات وبايتات Origin على الاستضافة بلا أي فرق بصري
 */
import { useRef, useState } from "react";
import { Film, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { compressImageFile } from "@/lib/image-compress";

export default function MediaInput({
  value,
  onChange,
  label,
  accept = "image/*,video/*",
}: {
  value: string; // رابط /api/media/... أو dataURL قديم أو ""
  onChange: (v: string) => void;
  label?: string;
  accept?: string;
}) {
  const { t, me } = useApp();
  const ref = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(-1); // -1 = خامل، 0-99 رفع، 100 معالجة
  const [err, setErr] = useState("");

  const isVideo =
    value.startsWith("/api/media/") && /\.(mp4|webm|mov)$/i.test(value)
      ? true
      : value.startsWith("data:video");

  const upload = async (file?: File) => {
    if (!file) return;
    setErr("");
    setProgress(0);
    const fd = new FormData();
    /* ★ v3.17: ضغط الصور في المتصفح — أي فشل يعيد الملف الأصلي (لا يتعطل الرفع أبداً) */
    fd.append("file", await compressImageFile(file));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && j.url) {
          onChange(j.url);
          setProgress(-1);
        } else {
          setErr(j.error || t("media.uploadFailed"));
          setProgress(-1);
        }
      } catch {
        setErr(t("media.uploadFailed"));
        setProgress(-1);
      }
    };
    xhr.onerror = () => {
      setErr(t("media.uploadFailed"));
      setProgress(-1);
    };
    xhr.send(fd);
  };

  const canUpload = !!me && (me.role === "admin" || me.role === "assistant");

  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      {value ? (
        <div className="relative w-fit">
          {isVideo ? (
            <video src={value} className="h-28 rounded-2xl object-cover ring-1 ring-border bg-black" muted playsInline />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={value} alt="معاينة" className="h-28 rounded-2xl object-contain ring-1 ring-border bg-muted" />
          )}
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute -top-2 -end-2 h-7 w-7 rounded-full"
            onClick={() => onChange("")}
            aria-label="إزالة"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => ref.current?.click()} className="mt-1">
            {t("media.change")}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => ref.current?.click()}
          disabled={!canUpload || progress >= 0}
          className="gap-2 border-dashed"
        >
          {progress >= 0 ? (
            <>
              <Loader2 className="h-4.5 w-4.5 animate-spin text-primary" />
              {t("media.uploading")} {progress}%
            </>
          ) : (
            <>
              <ImagePlus className="h-4.5 w-4.5 text-primary" />
              <Film className="h-4 w-4 text-primary/60" />
              {label || t("media.pick")}
            </>
          )}
        </Button>
      )}
      {progress > 0 && progress < 100 && (
        <div className="h-1.5 w-48 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

/* ═══════════ منتقي وسائط متعدد (للإعلانات — نمط طمأنينة) ═══════════
 * حتى max وسيط (5 صور + فيديو): الرفع فوري إلى /api/media ويمرر الروابط فقط */
export function MediaPicker({
  value,
  onChange,
  max = 6,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  const { t, me } = useApp();
  const ref = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(-1);
  const [err, setErr] = useState("");

  const canUpload = !!me && (me.role === "admin" || me.role === "assistant");

  const upload = async (files?: FileList | null) => {
    if (!files || !files.length) return;
    const room = max - value.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (!list.length) {
      setErr(t("ads.mediaMax"));
      return;
    }
    setErr("");
    let done = 0;
    setProgress(1);
    const urls: string[] = [];
    for (const file of list) {
      const fd = new FormData();
      /* ★ v3.17: ضغط الصور في المتصفح قبل الرفع */
      fd.append("file", await compressImageFile(file));
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/media");
      xhr.onload = () => {
        done++;
        try {
          const j = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && j.url) urls.push(j.url);
          else setErr(j.error || t("media.uploadFailed"));
        } catch {
          setErr(t("media.uploadFailed"));
        }
        setProgress(Math.round((done / list.length) * 100));
        if (done === list.length) {
          onChange([...value, ...urls].slice(0, max));
          setProgress(-1);
        }
      };
      xhr.onerror = () => {
        done++;
        setErr(t("media.uploadFailed"));
        setProgress(Math.round((done / list.length) * 100));
        if (done === list.length) {
          if (urls.length) onChange([...value, ...urls].slice(0, max));
          setProgress(-1);
        }
      };
      xhr.send(fd);
    }
  };

  return (
    <div className="space-y-2">
      <input ref={ref} type="file" accept="image/*,video/*" multiple className="hidden"
        onChange={(e) => { upload(e.target.files); e.currentTarget.value = ""; }} />
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((m, i) => {
            const isVid = m.startsWith("data:video") || (m.startsWith("/api/media/") && /\.(mp4|webm|mov)$/i.test(m));
            return (
              <div key={i} className="relative">
                {isVid ? (
                  <video src={m} className="h-20 w-full rounded-xl bg-black object-cover ring-1 ring-border" muted playsInline />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={m} alt={`media ${i + 1}`} className="h-20 w-full rounded-xl object-cover ring-1 ring-border" />
                )}
                <Button type="button" size="icon" variant="destructive"
                  className="absolute -top-1.5 -end-1.5 h-6 w-6 rounded-full"
                  onClick={() => onChange(value.filter((_, k) => k !== i))}
                  aria-label="إزالة">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {value.length < max && (
        <Button type="button" variant="outline" className="gap-2 border-dashed" disabled={!canUpload || progress >= 0}
          onClick={() => ref.current?.click()}>
          {progress >= 0 ? (
            <>
              <Loader2 className="h-4.5 w-4.5 animate-spin text-primary" />
              {t("media.uploading")} {Math.max(1, progress)}%
            </>
          ) : (
            <>
              <ImagePlus className="h-4.5 w-4.5 text-primary" />
              <Film className="h-4 w-4 text-primary/60" />
              {t("ads.addMedia")} ({value.length}/{max})
            </>
          )}
        </Button>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

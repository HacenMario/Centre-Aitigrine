"use client";
/**
 * ★ v3.26 — حقل رفع ملف PDF واحد (المقالات والتكوينات)
 * الرفع فوري إلى /api/media (GridFS) ويمرر الرابط /api/media/<name>.pdf
 * يعرض اسم الملف المختار مع زر إزالة — نفس نمط MediaPicker
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

const PDF_MAX = 100 * 1024 * 1024; /* نفس حد الخادم */

export default function PdfInput({
  value,
  onChange,
  label,
  hint,
  className,
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  className?: string;
}) {
  const { t } = useApp();
  const ref = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const name = (() => {
    try {
      return value.startsWith("/api/media/") ? decodeURIComponent(value.split("/api/media/")[1] || "") : "";
    } catch {
      return "";
    }
  })();

  const pick = async (f?: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error(t("pdf.only"));
      return;
    }
    if (f.size > PDF_MAX) {
      toast.error(t("pdf.tooBig"));
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/media", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.url) {
        onChange(String(j.url));
        toast.success(t("pdf.uploaded"));
      } else {
        toast.error(j.error || t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    }
    setBusy(false);
    if (ref.current) ref.current.value = "";
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <FileText className="h-4 w-4 text-primary" />
          {label}
        </span>
      )}
      {value ? (
        <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2.5">
          <FileText className="h-4.5 w-4.5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-xs font-bold" dir="ltr">{name || t("pdf.selected")}</span>
          <Button
            type="button" variant="ghost" size="icon"
            className="h-7 w-7 shrink-0 rounded-lg text-destructive"
            aria-label={t("common.delete")}
            onClick={() => onChange("")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => ref.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? t("common.uploading") : t("pdf.pick")}
        </button>
      )}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <input
        ref={ref}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  );
}

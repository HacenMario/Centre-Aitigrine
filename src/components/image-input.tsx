"use client";
/** حقل صورة base64 — رفع من الهاتف/الحاسوب مع معاينة */
import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ImageInput({
  value,
  onChange,
  label = "رفع صورة",
  maxWidth = 900,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  maxWidth?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const pick = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        /* تصغير الصورة قبل التحويل إلى base64 لتخفيف قاعدة البيانات */
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        onChange(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {value ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="معاينة"
            className="h-28 rounded-2xl object-contain ring-1 ring-border bg-muted"
          />
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
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => ref.current?.click()}
          className="gap-2 border-dashed"
        >
          <ImagePlus className="h-4.5 w-4.5 text-primary" />
          {label}
        </Button>
      )}
      {value && (
        <Button type="button" variant="ghost" size="sm" onClick={() => ref.current?.click()}>
          تغيير الصورة
        </Button>
      )}
    </div>
  );
}

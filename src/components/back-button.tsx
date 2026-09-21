"use client";
/** سهم رجوع — في كل صفحة داخلية */
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";

export default function BackButton({ onBack, label }: { onBack: () => void; label?: string }) {
  const { t, dir } = useApp();
  const Icon = dir === "rtl" ? ArrowRight : ArrowLeft;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onBack}
      className="gap-1.5 font-semibold -ms-2 shrink-0"
      aria-label={label || t("common.back")}
    >
      <Icon className="h-4.5 w-4.5" />
      <span className="whitespace-nowrap">{label || t("common.back")}</span>
    </Button>
  );
}

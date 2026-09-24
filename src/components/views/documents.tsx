"use client";
/**
 * المستندات — توليد آلي لوثائق المركز مع تصدير PDF عبر الطباعة
 * 1. تقرير نفسي (Compte rendu psychologique)
 * 2. شهادة حضور (Certificat de présence)
 * 3. مبرر غياب مدرسي (Justification d'absence scolaire)
 * 4. شهادة متابعة (Attestation de suivi)
 * تُملأ تلقائياً من بيانات المريض وملفه وإعدادات المركز
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileBadge2, Printer, FileDown, RefreshCw, UserRound } from "lucide-react";
import { toast } from "sonner";
import type { Navigate } from "@/lib/nav";
import { localeOf, pickTri } from "@/components/tri-input";

type DocType = "compte_rendu" | "certificat_presence" | "absence_scolaire" | "attestation_suivi";
type PatientRow = { user: { _id: string; name: string; phone: string } };
type Specialist = {
  _id: string; name: string; title: string; titleFr: string; titleEn: string;
  bio: string; bioFr: string; bioEn: string; phone: string;
};
type Rec = {
  birthDate?: string; gender?: string; motive?: string; symptoms?: string;
  motiveFr?: string; motiveEn?: string; symptomsFr?: string; symptomsEn?: string;
  diagnosis?: string; diagnosisFr?: string; diagnosisEn?: string;
  diagnosisSystem?: string; diagnosisCode?: string;
  treatmentPlan?: string; treatmentPlanFr?: string; treatmentPlanEn?: string;
  medicalInfo?: string; psychologicalInfo?: string;
  sessionNotes?: { date: string; text: string }[];
};

const DOC_TYPES: DocType[] = ["compte_rendu", "certificat_presence", "absence_scolaire", "attestation_suivi"];

export default function Documents({ navigate }: { navigate: Navigate }) {
  const { t, settings, lang } = useApp();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [patientId, setPatientId] = useState("");
  const [docType, setDocType] = useState<DocType>("compte_rendu");
  const [rec, setRec] = useState<Rec | null>(null);
  const [specialist, setSpecialist] = useState<Specialist | null>(null);
  /** ★ v3.5: اسم العميل في الوثيقة قابل للتعديل — الإدارة تختار العميل ثم تعدّل الاسم
   *  حسب لغة الوثيقة و حسب ما يريد العميل */
  const [displayName, setDisplayName] = useState("");
  const [extra, setExtra] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState("1");
  const [busy, setBusy] = useState(false);

  const s = settings;
  /* التاريخ بلغة الواجهة الحالية (الإنجليزية كانت تُعرض بتاريخ فرنسي — أُصلح) */
  const today = new Date().toLocaleDateString(
    localeOf(lang),
    { year: "numeric", month: "long", day: "numeric" }
  );

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/records", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          setPatients(j.patients || []);
        }
      } catch {}
    })();
  }, []);

  const loadRecord = useCallback(async (pid: string) => {
    setRec(null);
    setSpecialist(null);
    setDisplayName("");
    if (!pid) return;
    try {
      const r = await fetch(`/api/records?patientId=${pid}`, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setRec(j.record || {});
        setSpecialist(j.specialist || null);
        /* الاسم الحقيقي للعميل يملأ حقل الاسم المعروض في الوثيقة — قابل للتعديل */
        setDisplayName(j.patient?.name || "");
      }
    } catch {}
  }, []);

  useEffect(() => { loadRecord(patientId); }, [patientId, loadRecord]);

  const patient = patients.find((p) => p.user._id === patientId)?.user;
  const age = rec?.birthDate
    ? Math.max(0, Math.floor((Date.now() - new Date(rec.birthDate + "T00:00:00").getTime()) / (365.25 * 86400_000)))
    : null;

  const docTitle = t(`doc.${docType}`);

  /* اسم المركز بلغة الوثيقة — النصوص في الوثيقة كلها تتبع الترجمة الشاملة */
  const centerName =
    (lang === "ar"
      ? s?.centerName
      : pickTri(s as unknown as Record<string, unknown>, "centerName", lang)) || t("app.name");
  const centerSub = lang === "ar" ? t("app.subLine") : t("app.subLine");
  const centerAddress = lang === "ar" ? s?.address : (s?.addressFr || s?.addressEn || s?.address || "");

  /* الأخصائي المعالج بلغة الوثيقة — يظهر في الوثائق السريرية المناسبة */
  const specTitle = specialist
    ? pickTri(specialist as unknown as Record<string, unknown>, "title", lang) || specialist.title
    : "";

  /* توليد النص التلقائي حسب نوع الوثيقة — الحقول مترجمة بالكامل حسب لغة الواجهة */
  const body = (() => {
    const name = displayName.trim() || patient?.name || "—";
    const diagText = pickTri(rec, "diagnosis", lang);
    const diag = diagText ? `${diagText}${rec?.diagnosisCode ? ` (${rec.diagnosisSystem === "dsm5" ? "DSM-5" : rec.diagnosisSystem === "icd10" ? "CIM-10" : ""} ${rec.diagnosisCode})` : ""}` : "";
    switch (docType) {
      case "compte_rendu":
        return [
          { h: t("doc.motive"), p: pickTri(rec, "motive", lang) || extra || "—" },
          { h: t("pat.symptoms"), p: pickTri(rec, "symptoms", lang) || "—" },
          { h: t("pat.diagnosis"), p: diag || "—" },
          { h: t("pat.planBlock"), p: pickTri(rec, "treatmentPlan", lang) || "—" },
        ];
      case "certificat_presence":
        return [{ h: "", p: t("doc.presenceBody", { date: sessionDate }) + (extra ? ` — ${extra}` : "") }];
      case "absence_scolaire":
        return [{ h: "", p: t("doc.absenceBody", { days }) + (extra ? ` — ${extra}` : "") }];
      case "attestation_suivi":
        return [{ h: "", p: t("doc.suiviBody") + (diag ? ` — ${t("pat.diagnosis")}: ${diag}` : "") + (extra ? ` — ${extra}` : "") }];
    }
  })();

  const printDoc = () => {
    if (!patient) { toast.error(t("doc.needPatient")); return; }
    window.print();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BackButton onBack={() => navigate("home")} />
        <h1 className="text-xl sm:text-2xl font-black">{t("doc.title")}</h1>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-primary/6 border border-primary/15 px-4 py-2.5 text-sm text-primary leading-relaxed no-print">
        <FileBadge2 className="h-4 w-4 shrink-0 mt-0.5" />
        {t("doc.hint")}
      </p>

      <div className="grid gap-5 lg:grid-cols-[22rem_1fr] items-start">
        {/* لوحة الإعداد */}
        <Card className="rounded-3xl shadow-sm no-print">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5 text-primary" /> {t("doc.patient")}</Label>
              <Select value={patientId || "none"} onValueChange={setPatientId}>
                <SelectTrigger className="h-12"><SelectValue placeholder={t("doc.choosePatient")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>{t("doc.choosePatient")}</SelectItem>
                  {patients.map((p) => (
                    <SelectItem key={p.user._id} value={p.user._id}>{p.user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ★ v3.5: اسم العميل في الوثيقة — الإدارة تعدّله بعد اختيار العميل
                ليظهر في الوثيقة حسب لغتها و حسب ما يريده العميل */}
            {patientId && (
              <div className="space-y-1.5">
                <Label>{t("doc.displayName")}</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-11" placeholder={patient?.name || ""} />
                <p className="text-[11px] text-muted-foreground leading-relaxed">{t("doc.displayNameHint")}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{t("doc.type")}</Label>
              <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((d) => (
                    <SelectItem key={d} value={d}>{t(`doc.${d}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(docType === "certificat_presence") && (
              <div className="space-y-1.5">
                <Label>{t("doc.sessionDate")}</Label>
                <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className="h-11" />
              </div>
            )}
            {docType === "absence_scolaire" && (
              <div className="space-y-1.5">
                <Label>{t("doc.days")}</Label>
                <Input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} className="h-11" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{t("doc.extra")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
              <Textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={3} placeholder={t("doc.extraHint")} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={printDoc} className="h-12 rounded-xl gap-2">
                <Printer className="h-4.5 w-4.5" /> {t("doc.print")}
              </Button>
              <Button onClick={printDoc} variant="outline" className="h-12 rounded-xl gap-2">
                <FileDown className="h-4.5 w-4.5" /> PDF
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{t("doc.pdfHint")}</p>
          </CardContent>
        </Card>

        {/* معاينة الوثيقة — منطقة الطباعة */}
        <div className="print-area bg-background text-foreground rounded-3xl border shadow-sm p-6 sm:p-10 min-h-[28rem]">
          {/* ترويسة المركز — كل نصوصها تتبع لغة الوثيقة */}
          <div className="flex items-start justify-between gap-4 border-b-2 border-primary/60 pb-4">
            <div className="min-w-0">
              <p className="font-black text-lg leading-snug break-words">{centerName}</p>
              <p className="text-xs text-muted-foreground break-words">{centerSub}</p>
              {centerAddress && <p className="text-xs text-muted-foreground mt-1 break-words">{centerAddress}</p>}
              {s?.phone && <p className="text-xs text-muted-foreground" dir="ltr">{s.phone}</p>}
            </div>
            <div className="text-end shrink-0">
              <p className="text-xs text-muted-foreground">{t("doc.date")}</p>
              <p className="text-sm font-bold">{today}</p>
            </div>
          </div>

          {/* عنوان الوثيقة */}
          <h2 className="text-center font-black text-xl sm:text-2xl my-8 underline underline-offset-8 decoration-primary/40 break-words">
            {docTitle}
          </h2>

          {!patient ? (
            <p className="text-center text-muted-foreground py-16">{t("doc.previewEmpty")}</p>
          ) : (
            <div className="space-y-6 text-[15px] leading-loose">
              <p className="font-bold">
                {t("doc.concerns")} : <span className="font-black">{displayName.trim() || patient.name}</span>
                {age !== null ? ` — ${age} ${t("pat.years")}` : ""}
              </p>

              {Array.isArray(body) && body.map((sec, i) =>
                sec.h ? (
                  <div key={i} className="space-y-1">
                    <p className="font-black text-primary/90">{sec.h}</p>
                    <p className="whitespace-pre-wrap break-words">{sec.p}</p>
                  </div>
                ) : (
                  <p key={i} className="whitespace-pre-wrap break-words">{sec.p}</p>
                )
              )}

              {/* ★ v3.5: الأخصائي المعالج وتفاصيله — في الوثائق السريرية المناسبة */}
              {(docType === "compte_rendu" || docType === "attestation_suivi") && specialist && (
                <div className="rounded-xl border border-border px-4 py-3 space-y-1 text-sm">
                  <p className="font-black">{t("doc.specialist")} : {specialist.name}</p>
                  {specTitle && <p className="text-muted-foreground">{specTitle}</p>}
                  {specialist.phone && <p className="text-muted-foreground" dir="ltr">{specialist.phone}</p>}
                </div>
              )}

              {/* التوقيع والخاتم — بلا خط أفقي تحته: المكان يُترك يدوياً للختم والتوقيع بعد الطباعة */}
              <div className="pt-10 flex justify-between items-end">
                <div />
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold">{t("doc.signature")}</p>
                  <p className="text-xs text-muted-foreground">{centerName}</p>
                </div>
              </div>
            </div>
          )}

          {busy && <p className="text-xs text-muted-foreground mt-4"><RefreshCw className="inline h-3 w-3" /> {t("common.loading")}</p>}
        </div>
      </div>
    </div>
  );
}

"use client";
/**
 * ملف المريض الكامل — Dossier complet du patient
 * الهوية (الاسم، الولادة، النوع، الولي) + المعلومات الطبية والنفسية
 * + الأعراض وسبب الاستشارة + التشخيص (DSM-5 / CIM-10) + الخطة العلاجية
 * + ملاحظات سريرية للجلسات (سجل زمني) — الحفظ يمر عبر /api/records
 * 🔒 الأخصائي يفتح ملفات مرضاه فقط (يفرضه الخادم)
 */
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { BrandSkeleton, RowsSkeleton } from "@/components/brand-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  UserRound, Cake, VenusAndMars, Home as HomeIcon, Users, HeartPulse, Brain,
  MessageCircleQuestion, Stethoscope, ClipboardList, NotebookPen, Plus, Trash2, Save, Lock, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import type { Navigate } from "@/lib/nav";
import { TriInput, TriTextarea, type Tri } from "@/components/tri-input";

type RecordData = {
  patientId: string;
  specialistId?: string | null;
  birthDate: string;
  gender: "" | "male" | "female";
  address: string;
  guardianName: string;
  guardianPhone: string;
  medicalInfo: string;
  psychologicalInfo: string;
  symptoms: string;
  symptomsFr: string;
  symptomsEn: string;
  motive: string;
  motiveFr: string;
  motiveEn: string;
  diagnosis: string;
  diagnosisFr: string;
  diagnosisEn: string;
  diagnosisSystem: "" | "dsm5" | "icd10";
  diagnosisCode: string;
  treatmentPlan: string;
  treatmentPlanFr: string;
  treatmentPlanEn: string;
  sessionNotes: { date: string; text: string }[];
};

const EMPTY: RecordData = {
  patientId: "", birthDate: "", gender: "", address: "", guardianName: "", guardianPhone: "",
  medicalInfo: "", psychologicalInfo: "", symptoms: "", symptomsFr: "", symptomsEn: "", motive: "",
  motiveFr: "", motiveEn: "", diagnosis: "", diagnosisFr: "", diagnosisEn: "", diagnosisSystem: "",
  diagnosisCode: "", treatmentPlan: "", treatmentPlanFr: "", treatmentPlanEn: "", sessionNotes: [],
};

/* ★ v3.6 — إصلاح «كتابة حرف واحد ثم فقدان التركيز»:
   كان هذا المكوّن معرَّفاً داخل جسم RecordEditorInner، فمع كل ضغطة حرف
   تُعاد بنية المكوّن بمعرّف جديد فيُفصل تركيب الحقول ويُركَّب من جديد
   ويضيع التركيز. رفعناه إلى مستوى الوحدة — بقي ثابتاً والكتابة تسيل
   بلا انقطاع في كل حقول ملف المريض (والتواريخ أيضاً). */
function SectionCard({ icon: Icon, title, children }: { icon: typeof HeartPulse; title: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-3xl shadow-sm">
      <CardContent className="p-5 space-y-4">
        <h2 className="font-black flex items-center gap-2 text-primary">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-4.5 w-4.5" />
          </span>
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

export default function RecordEditor({ patientId, onBack, navigate }: { patientId?: string; onBack?: () => void; navigate: Navigate }) {
  const { t } = useApp();
  const [patient, setPatient] = useState<{ name: string; phone: string } | null>(null);
  const [data, setData] = useState<RecordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [delNote, setDelNote] = useState<number | null>(null);

  /* ★ حارس: الوصول المباشر لـ ?view=record بلا مريض — لا نداء خاطئ للـ API */
  if (!patientId) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <BackButton onBack={onBack || (() => navigate("home"))} />
          <h1 className="text-xl sm:text-2xl font-black">{t("pat.title")}</h1>
        </div>
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-12 text-center space-y-3 text-muted-foreground">
            <UserRound className="mx-auto h-10 w-10 text-primary/40" />
            <p>{t("doc.needPatient")}</p>
            <Button variant="outline" onClick={() => navigate("patients")} className="rounded-full">
              {t("nav.patients")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <RecordEditorInner patientId={patientId} onBack={onBack} navigate={navigate} />;
}

function RecordEditorInner({ patientId, onBack, navigate }: { patientId: string; onBack?: () => void; navigate: Navigate }) {
  const { t } = useApp();
  const [patient, setPatient] = useState<{ name: string; phone: string } | null>(null);
  const [data, setData] = useState<RecordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [delNote, setDelNote] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/records?patientId=${patientId}`, { cache: "no-store" });
        const j = await r.json();
        if (r.ok) {
          setPatient(j.patient);
          setData({ ...EMPTY, ...(j.record || {}), patientId });
        } else {
          toast.error(j.error || t("common.error"));
        }
      } catch {
        toast.error(t("err.conn"));
      }
      setLoading(false);
    })();
  }, [patientId, t]);

  const upd = (patch: Partial<RecordData>) => setData((d) => (d ? { ...d, ...patch } : d));

  /* حقول ثلاثية اللغة (عربي/فرنسي/إنجليزي) — الوثائق المطبوعة تختار اللغة تلقائياً */
  const triOf = (base: keyof RecordData): Tri => ({
    ar: (data?.[base] as string) || "",
    fr: (data?.[`${base}Fr`] as string) || "",
    en: (data?.[`${base}En`] as string) || "",
  });
  const updTri = (base: keyof RecordData, v: Tri) =>
    upd({ [base]: v.ar, [`${base}Fr`]: v.fr, [`${base}En`]: v.en } as unknown as Partial<RecordData>);

  const save = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const r = await fetch("/api/records", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success(t("toast.recordSaved"));
        setData({ ...data, ...(j.record || {}) });
      } else toast.error(j.error || t("common.error"));
    } catch {
      toast.error(t("err.conn"));
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <BrandSkeleton compact label={t("common.loading")} />
        <RowsSkeleton count={4} />
      </div>
    );
  }

  if (!data || !patient) {
    return (
      <div className="py-16 text-center space-y-4">
        <Lock className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">{t("pat.accessDenied")}</p>
        <Button onClick={onBack} variant="outline">{t("common.back")}</Button>
      </div>
    );
  }

  const age = data.birthDate
    ? Math.max(0, Math.floor((Date.now() - new Date(data.birthDate + "T00:00:00").getTime()) / (365.25 * 86400_000)))
    : null;

  return (
    <div className="space-y-5">
      {/* الترويسة */}
      <div className="flex items-center gap-2 flex-wrap">
        <BackButton onBack={onBack} />
        <h1 className="text-xl sm:text-2xl font-black min-w-0 break-words">{patient.name}</h1>
        {age !== null && <Badge variant="secondary" className="shrink-0">{age} {t("pat.years")}</Badge>}
      </div>

      {/* ── الهوية ── */}
      <SectionCard icon={UserRound} title={t("pat.identity")}>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Cake className="h-3.5 w-3.5 text-primary" /> {t("pat.birthDate")}</Label>
            <Input type="date" value={data.birthDate} onChange={(e) => upd({ birthDate: e.target.value })} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><VenusAndMars className="h-3.5 w-3.5 text-primary" /> {t("pat.gender")}</Label>
            <Select value={data.gender || "none"} onValueChange={(v) => upd({ gender: v === "none" ? "" : v as RecordData["gender"] })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("common.none")}</SelectItem>
                <SelectItem value="male">{t("pat.male")}</SelectItem>
                <SelectItem value="female">{t("pat.female")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><HomeIcon className="h-3.5 w-3.5 text-primary" /> {t("pat.address")}</Label>
            <Input value={data.address} onChange={(e) => upd({ address: e.target.value })} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary" /> {t("pat.guardian")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input value={data.guardianName} onChange={(e) => upd({ guardianName: e.target.value })} placeholder={t("pat.guardianName")} className="h-11" />
              <Input value={data.guardianPhone} onChange={(e) => upd({ guardianPhone: e.target.value })} dir="ltr" inputMode="tel" placeholder={t("common.phone")} className="h-11 text-start" />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── المعلومات الطبية والنفسية ── */}
      <SectionCard icon={HeartPulse} title={t("pat.medicalBlock")}>
        <div className="space-y-1.5">
          <Label>{t("pat.medicalInfo")}</Label>
          <Textarea value={data.medicalInfo} onChange={(e) => upd({ medicalInfo: e.target.value })}
            rows={3} placeholder={t("pat.medicalInfoHint")} />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Brain className="h-3.5 w-3.5 text-primary" /> {t("pat.psychInfo")}</Label>
          <Textarea value={data.psychologicalInfo} onChange={(e) => upd({ psychologicalInfo: e.target.value })}
            rows={3} placeholder={t("pat.psychInfoHint")} />
        </div>
      </SectionCard>

      {/* ── الأعراض وسبب الاستشارة ── */}
      <SectionCard icon={MessageCircleQuestion} title={t("pat.consultBlock")}>
        <div className="space-y-1.5">
          <Label>{t("pat.symptoms")}</Label>
          <TriTextarea
            value={triOf("symptoms")}
            onChange={(v) => updTri("symptoms", v)}
            rows={3}
            placeholder={t("pat.symptomsHint")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("pat.motive")}</Label>
          <TriTextarea
            value={triOf("motive")}
            onChange={(v) => updTri("motive", v)}
            rows={2}
            placeholder={t("pat.motiveHint")}
          />
        </div>
      </SectionCard>

      {/* ── التشخيص ── */}
      <SectionCard icon={Stethoscope} title={t("pat.diagnosisBlock")}>
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-start">
          <div className="space-y-1.5">
            <Label>{t("pat.diagnosis")}</Label>
            <TriInput value={triOf("diagnosis")} onChange={(v) => updTri("diagnosis", v)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("pat.system")}</Label>
            <Select value={data.diagnosisSystem || "none"} onValueChange={(v) => upd({ diagnosisSystem: v === "none" ? "" : v as RecordData["diagnosisSystem"] })}>
              <SelectTrigger className="h-11 w-full sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="dsm5">DSM-5</SelectItem>
                <SelectItem value="icd10">CIM-10</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("pat.code")}</Label>
            <Input value={data.diagnosisCode} onChange={(e) => upd({ diagnosisCode: e.target.value })} placeholder="F84.0" className="h-11 sm:w-28" dir="ltr" />
          </div>
        </div>
      </SectionCard>

      {/* ── الخطة العلاجية ── */}
      <SectionCard icon={ClipboardList} title={t("pat.planBlock")}>
        <TriTextarea
          value={triOf("treatmentPlan")}
          onChange={(v) => updTri("treatmentPlan", v)}
          rows={4}
          placeholder={t("pat.planHint")}
        />
      </SectionCard>

      {/* ── ملاحظات الجلسات ── */}
      <SectionCard icon={NotebookPen} title={t("pat.notesBlock")}>
        <div className="space-y-3">
          {data.sessionNotes.map((n, i) => (
            <div key={i} className="rounded-2xl border bg-muted/20 p-3.5 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="gap-1">
                  <CalendarDays className="h-3 w-3" /> {n.date || "—"}
                </Badge>
                <Button
                  size="icon" variant="ghost"
                  className="ms-auto h-8 w-8 text-destructive"
                  onClick={() => setDelNote(i)}
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                value={n.text}
                onChange={(e) => upd({ sessionNotes: data.sessionNotes.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })}
                rows={3}
              />
            </div>
          ))}
          <Button
            type="button" variant="outline"
            onClick={() => upd({ sessionNotes: [{ date: new Date().toISOString().slice(0, 10), text: "" }, ...data.sessionNotes] })}
            className="w-full rounded-xl gap-2 border-dashed border-primary/40 text-primary"
          >
            <Plus className="h-4 w-4" /> {t("pat.addNote")}
          </Button>
        </div>
      </SectionCard>

      {/* الحفظ */}
      <div className="sticky bottom-4 z-10">
        <Button onClick={save} disabled={busy} className="w-full h-13 rounded-2xl text-base shadow-xl gap-2">
          <Save className="h-5 w-5" />
          {busy ? t("common.saving") : t("common.save")}
        </Button>
      </div>

      <AlertDialog open={delNote !== null} onOpenChange={(v) => !v && setDelNote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                upd({ sessionNotes: data.sessionNotes.filter((_, k) => k !== delNote) });
                setDelNote(null);
              }}
            >
              {t("common.yes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";
/**
 * المرضى — قائمة مرضى المركز مع ملفاتهم الطبية والنفسية
 * • الإدارة/المساعد: كل عملاء المركز
 * • الأخصائي: مرضاه فقط (المعيَّنون له + من لهم مواعيد معه) — يفرضه الخادم أيضاً
 * • فتح/إنشاء الملف الكامل: هوية، معلومات طبية ونفسية، أعراض، تشخيص DSM-5/CIM-10، خطة، ملاحظات الجلسات
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { PageSkeleton } from "@/components/brand-skeleton";
import RecordEditor from "@/components/views/record";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, FolderHeart, FilePlus2, FileText, Phone, Stethoscope, RefreshCw, AlertTriangle, Droplet } from "lucide-react";
import Pagination from "@/components/pagination";
import type { Navigate } from "@/lib/nav";

const PAT_PAGE_SIZE = 12;

type PatientRow = {
  user: { _id: string; name: string; phone: string; photoBase64?: string; assignedSpecialistId?: string | null; bloodType?: string | null };
  hasRecord: boolean;
  diagnosis: string;
  birthDate: string;
  specialistId: string;
};

export default function Patients({ navigate }: { navigate: Navigate }) {
  const { t, me } = useApp();
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [query, setQuery] = useState("");
  const [openPatient, setOpenPatient] = useState<string | null>(null);
  /* ترقيم الصفحات الاحترافي */
  const [page, setPage] = useState(1);
  const isSpec = me?.role === "specialist" || me?.role === "trainer";

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr(false);
    try {
      const r = await fetch("/api/records", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const j = await r.json();
      setRows(j.patients || []);
    } catch {
      setLoadErr(true);
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(
    () => rows.filter((r) => !query || r.user.name.includes(query) || r.user.phone.includes(query) || (r.diagnosis || "").includes(query)),
    [rows, query]
  );
  const patPageCount = Math.max(1, Math.ceil(filtered.length / PAT_PAGE_SIZE));
  const pageFiltered = filtered.slice((page - 1) * PAT_PAGE_SIZE, page * PAT_PAGE_SIZE);
  useEffect(() => { setPage(1); }, [query, rows.length]);

  if (openPatient) {
    return (
      <RecordEditor
        patientId={openPatient}
        onBack={() => { setOpenPatient(null); load(); }}
        navigate={navigate}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <BackButton onBack={() => navigate("home")} />
          <h1 className="text-xl sm:text-2xl font-black">{t("pat.title")}</h1>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-primary/6 border border-primary/15 px-4 py-2.5 text-sm text-primary leading-relaxed">
        <Stethoscope className="h-4 w-4 shrink-0 mt-0.5" />
        {isSpec ? t("pat.specHint") : t("pat.staffHint")}
      </p>

      <div className="relative max-w-md">
        <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("common.search")} className="ps-9 h-10" />
      </div>

      {loading ? (
        <PageSkeleton kind="rows" count={4} label={t("common.loading")} className="pt-2" />
      ) : loadErr ? (
        <Card className="rounded-3xl border-destructive/30 bg-destructive/5">
          <CardContent className="py-12 text-center flex flex-col items-center gap-3">
            <AlertTriangle className="h-10 w-10 text-destructive/70" />
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{t("common.loadFailed")}</p>
            <Button variant="outline" onClick={load} className="gap-2 rounded-xl">
              <RefreshCw className="h-4 w-4" /> {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <FolderHeart className="h-10 w-10 opacity-40" />
            {t("pat.noPatients")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2.5">
          {pageFiltered.map((p) => (
            <Card key={p.user._id} className="ait-card rounded-2xl shadow-sm">
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-black text-primary overflow-hidden">
                  {p.user.photoBase64 ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.user.photoBase64} alt={p.user.name} className="h-full w-full object-cover" />
                  ) : p.user.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-bold text-sm break-words whitespace-normal leading-snug">{p.user.name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5" dir="ltr">
                      <Phone className="h-3 w-3" /> {p.user.phone}
                    </p>
                    {/* ★ v3.19: زمرة الدم — بجانب معلومات العميل في قائمة المرضى */}
                    {p.user.bloodType && (
                      <Badge variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25 gap-0.5 px-1.5 py-0">
                        <Droplet className="h-2.5 w-2.5" aria-hidden="true" />
                        <span dir="ltr" className="text-[10px] font-bold tabular-nums">{p.user.bloodType}</span>
                      </Badge>
                    )}
                  </div>
                  {p.diagnosis && (
                    <p className="text-xs text-muted-foreground break-words">
                      <span className="font-semibold text-foreground/70">{t("pat.diagnosis")}: </span>
                      {p.diagnosis}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 w-full sm:w-auto sm:flex-row sm:items-center">
                  {p.hasRecord ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 gap-1">
                      <FileText className="h-3 w-3" /> {t("pat.fileOpen")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25 gap-1">
                      <FilePlus2 className="h-3 w-3" /> {t("pat.noFile")}
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setOpenPatient(p.user._id)}
                    className="gap-1.5 rounded-lg"
                  >
                    <FolderHeart className="h-3.5 w-3.5" />
                    {p.hasRecord ? t("pat.openFile") : t("pat.createFile")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <Pagination page={page} pageCount={patPageCount} onPage={setPage} total={filtered.length} pageSize={PAT_PAGE_SIZE} />
      )}
    </div>
  );
}

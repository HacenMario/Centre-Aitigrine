"use client";
/** اقتراحات وبلاغات — نموذج للجميع + إدارة الرسائل للإدارة */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { RowsSkeleton } from "@/components/brand-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, MessageSquareHeart, Lightbulb, TriangleAlert, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Pagination from "@/components/pagination";
import type { Navigate } from "@/lib/nav";

type Fb = { _id: string; name: string; type: string; message: string; contact: string; status: string; reply: string; createdAt: string };

export default function Feedback({ navigate }: { navigate: Navigate }) {
  const { t, me } = useApp();
  const isStaff = me?.role === "admin" || me?.role === "assistant";
  const [type, setType] = useState("suggestion");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Fb[]>([]);
  const [filter, setFilter] = useState("all");
  /* v3.6: حالة تحميل لقائمة رسائل الإدارة — Skeleton بشعار المركز */
  const [loading, setLoading] = useState(true);
  /* ترقيم الصفحات الاحترافي */
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!isStaff) { setLoading(false); return; }
    try {
      const r = await fetch("/api/feedback", { cache: "no-store" });
      const j = await r.json();
      setItems(j.feedback || []);
    } catch {}
    setLoading(false);
  }, [isStaff]);

  useEffect(() => { load(); }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 5) { toast.error(t("err.required")); return; }
    setBusy(true);
    const r = await fetch("/api/feedback", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, message, contact }),
    });
    setBusy(false);
    if (r.ok) {
      toast.success(t("fb.sent"));
      setMessage(""); setContact("");
    } else toast.error(t("common.error"));
  };

  const setStatus = async (id: string, status: string) => {
    const r = await fetch(`/api/feedback/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (r.ok) load();
  };

  const filtered = items.filter((i) => filter === "all" || i.status === filter);
  const FB_PAGE_SIZE = 8;
  const fbPageCount = Math.max(1, Math.ceil(filtered.length / FB_PAGE_SIZE));
  const pageFiltered = filtered.slice((page - 1) * FB_PAGE_SIZE, page * FB_PAGE_SIZE);
  useEffect(() => { setPage(1); }, [filter, items.length]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BackButton onBack={() => navigate("home")} />
        <h1 className="text-xl sm:text-2xl font-black">{t("fb.title")}</h1>
      </div>
      <p className="text-sm text-muted-foreground">{t("fb.sub")}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* نموذج الإرسال */}
        <Card className="rounded-3xl h-fit">
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {([
                { k: "suggestion", label: t("fb.suggestion"), icon: Lightbulb },
                { k: "report", label: t("fb.report"), icon: TriangleAlert },
              ]).map((o) => (
                <button key={o.k} type="button" onClick={() => setType(o.k)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border-2 p-4 font-bold text-sm transition-all",
                    type === o.k
                      ? o.k === "suggestion"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-amber-500 bg-amber-500/5 text-amber-600"
                      : "border-border text-muted-foreground hover:border-muted-foreground/40"
                  )}>
                  <o.icon className="h-6 w-6" />
                  {o.label}
                </button>
              ))}
            </div>
            <form onSubmit={send} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("fb.message")}</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} required minLength={5} />
              </div>
              <div className="space-y-2">
                <Label>{t("fb.contact")}</Label>
                <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t("common.phone")} className="h-11" />
              </div>
              <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl gap-2 text-base">
                <Send className="h-4.5 w-4.5" />
                {busy ? t("common.loading") : t("common.send")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* إدارة الرسائل */}
        {isStaff && (
          <Card className="rounded-3xl">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-black flex items-center gap-2">
                <MessageSquareHeart className="h-5 w-5 text-primary" />
                {t("fb.manage")} ({items.length})
              </h2>
              <Tabs value={filter} onValueChange={setFilter}>
                <TabsList className="w-full">
                  <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
                  <TabsTrigger value="new">{t("fb.new")}</TabsTrigger>
                  <TabsTrigger value="read">{t("fb.read")}</TabsTrigger>
                  <TabsTrigger value="resolved">{t("fb.resolved")}</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="space-y-3 max-h-[28rem] overflow-y-auto pe-1">
                {loading ? (
                  <RowsSkeleton count={3} />
                ) : filtered.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">{t("common.noData")}</p>
                ) : (
                  pageFiltered.map((f) => (
                    <div key={f._id} className="rounded-2xl border p-4 space-y-2 bg-card">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={f.type === "report" ? "border-amber-500/30 text-amber-600" : "border-primary/30 text-primary"}>
                          {f.type === "report" ? t("fb.report") : t("fb.suggestion")}
                        </Badge>
                        <span className="font-bold text-sm">{f.name}</span>
                        {f.contact && <span className="text-xs text-muted-foreground" dir="ltr">{f.contact}</span>}
                        <Badge variant="secondary" className="ms-auto">
                          {f.status === "new" ? t("fb.new") : f.status === "read" ? t("fb.read") : t("fb.resolved")}
                        </Badge>
                      </div>
                      <p className="text-sm leading-relaxed">{f.message}</p>
                      <div className="flex items-center gap-1.5 pt-1 border-t flex-wrap">
                        {f.status === "new" && (
                          <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={() => setStatus(f._id, "read")}>
                            <Check className="h-3.5 w-3.5" /> {t("fb.read")}
                          </Button>
                        )}
                        {f.status !== "resolved" && (
                          <Button size="sm" variant="ghost" className="text-xs gap-1.5 text-emerald-600" onClick={() => setStatus(f._id, "resolved")}>
                            <Check className="h-3.5 w-3.5" /> {t("fb.resolve")}
                          </Button>
                        )}
                        {me?.role === "admin" && (
                          <Button size="sm" variant="ghost" className="text-xs gap-1.5 text-destructive ms-auto"
                            onClick={async () => {
                              const r = await fetch(`/api/feedback/${f._id}`, { method: "DELETE" });
                              if (r.ok) load();
                            }}>
                            <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {filtered.length > 0 && (
                <Pagination page={page} pageCount={fbPageCount} onPage={setPage} total={filtered.length} pageSize={FB_PAGE_SIZE} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

"use client";
/**
 * شريط عدادات المركز في الرئيسية — أرقام حقيقية من قاعدة البيانات مع عدّ تصاعدي سلس
 */
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { UsersRound, Stethoscope, Video, Building2, CalendarDays, Languages } from "lucide-react";

type Stats = {
  clients: number;
  specialists: number;
  remote: number;
  onsite: number;
  workingDays: number;
  languages: number;
};

/** عدّ تصاعدي يبدأ عند ظهور العنصر في الشاشة */
function useCountUp(target: number, active: boolean, duration = 1400): number {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return val;
}

function StatCell({
  icon: Icon, value, label, active, delay, plus = false,
}: {
  icon: typeof UsersRound; value: number; label: string; active: boolean; delay: number; plus?: boolean;
}) {
  const n = useCountUp(value, active);
  return (
    <div
      className="ait-stat group flex flex-col items-center gap-2 rounded-2xl px-3 py-5 text-center"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/18 to-accent/25 text-primary shadow-sm group-hover:scale-110 transition-transform">
        <Icon className="h-6 w-6" />
      </span>
      <span className="text-2xl sm:text-3xl font-black tabular-nums leading-none text-foreground" dir="ltr">
        {n.toLocaleString("en-US")}
        {plus && value > 0 && <span className="text-primary">+</span>}
      </span>
      <span className="text-[12px] sm:text-[13px] font-bold text-muted-foreground leading-snug">{label}</span>
    </div>
  );
}

export default function StatsBand() {
  const { t } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/stats", { cache: "no-store" });
        const j = await r.json();
        setStats(j.stats || null);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    /* يُعاد الربط عند وصول البيانات — لأن القسم لا يُعرض قبل تحميل stats */
    if (!stats) return;
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setVisible(true)),
      { threshold: 0.25 }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [stats]);

  if (!stats) return null;

  const cells = [
    { icon: UsersRound, value: stats.clients, label: t("stats.clients"), plus: true },
    { icon: Stethoscope, value: stats.specialists, label: t("stats.specialists"), plus: true },
    { icon: Video, value: stats.remote, label: t("stats.remote"), plus: true },
    { icon: Building2, value: stats.onsite, label: t("stats.onsite"), plus: true },
    { icon: CalendarDays, value: stats.centerDays ?? stats.workingDays ?? 0, label: t("stats.days"), plus: false },
    { icon: Languages, value: stats.languages, label: t("stats.langs"), plus: false },
  ];

  return (
    <section ref={ref} className="space-y-6">
      <div className="text-center space-y-1.5 mx-auto max-w-xl">
        <h2 className="text-2xl sm:text-3xl font-black">{t("stats.title")}</h2>
        <p className="text-muted-foreground">{t("stats.sub")}</p>
      </div>
      <div className="ait-stats-band grid grid-cols-2 gap-2 rounded-[2rem] p-3 sm:p-5 sm:grid-cols-3 lg:grid-cols-6">
        {cells.map((c, i) => (
          <StatCell key={i} icon={c.icon} value={c.value} label={c.label} active={visible} delay={i * 70} plus={c.plus} />
        ))}
      </div>
    </section>
  );
}

/**
 * نغمة تنبيه بسيطة (v3.20) — نافذة طلبات الكتب للإدارة
 * WebAudio بلا ملفات صوتية: نغمتان صاعدتان قصيرتان (ding-dong) هادئتان وواضحتان
 * لا تفشل أبداً: أي خطأ (سياسات التشغيل التلقائي/غياب الدعم) يُبتعع بصمت
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** نغمة وصول طلب جديد — نغمتان متتاليتان (E5 ثم G5) بحجم لطيف */
export function playOrderChime(): void {
  try {
    const ac = getCtx();
    if (!ac) return;
    const now = ac.currentTime;
    const notes: { f: number; at: number }[] = [
      { f: 659.25, at: 0 }, // E5
      { f: 783.99, at: 0.18 }, // G5
    ];
    for (const { f, at } of notes) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      const t0 = now + at;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.22, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.45);
    }
  } catch {}
}

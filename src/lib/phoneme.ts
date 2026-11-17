/**
 * ★ v3.24.4 — محرك المقارنة الصوتية الحتمية (Deterministic phoneme comparison)
 * يعمل بلا أي خدمة خارجية: يطبّع النص العربي ثم يقارن الكلمة المستهدفة بما فُهم
 * من النطق حرفاً حرفاً وبترتيب الظهور، ويحدد موضع كل صوت (أول/وسط/آخر الكلمة)،
 * ويحسب نسبة التشابه (Levenshtein) — فيقدّر الحذف/الإبدال/التشويه تقديراً صادقاً
 * حتى بغياب طبقة الذكاء الاصطناعي السحابية. الأساس الذي يضمن ألا يفشل التحليل أبداً.
 */
import { normalizeArabic } from "./wordbank";

export type PhonemePos = "start" | "mid" | "end";

export type SpeechCompare = {
  matched: { letter: string; pos: PhonemePos }[];
  missing: { letter: string; pos: PhonemePos }[];
  extra: string[];
  similarity: number; /* 0..1 — نسبة تشابه الهدف بالنطق المفهوم */
  wordAchieved: boolean; /* الكلمة المستهدفة ظهرت كاملة */
  letterAchieved: boolean; /* الحرف المدروس ظهر */
  letterInTarget: boolean;
};

function posOf(i: number, len: number): PhonemePos {
  if (len <= 1 || i === 0) return "start";
  if (i === len - 1) return "end";
  return "mid";
}

function levenshteinRatio(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const m = [...a], n = [...b];
  const dp = Array.from({ length: n.length + 1 }, (_, j) => j);
  for (let i = 1; i <= m.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n.length; j++) {
      const cur = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (m[i - 1] === n[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  const dist = dp[n.length];
  return Math.max(0, Math.min(1, 1 - dist / Math.max(m.length, n.length)));
}

export function compareSpeech(target: string, transcript: string, letter: string): SpeechCompare {
  const t = normalizeArabic(target);
  const s = normalizeArabic(transcript);
  const L = normalizeArabic(letter || t.charAt(0));
  const tl = [...t], sl = [...s];

  /* مطابقة متسلسلة: كل حرف هدف يُبحث بالترتيب في النطق المفهوم —
     يحاكي سماع الحروف بترتيب النطق الفعلي ويكشف الحذف/الخلط */
  const matched: { letter: string; pos: PhonemePos }[] = [];
  const missing: { letter: string; pos: PhonemePos }[] = [];
  let j = 0;
  for (let i = 0; i < tl.length; i++) {
    const ch = tl[i];
    const k = sl.findIndex((c, idx) => idx >= j && c === ch);
    if (k >= 0) { matched.push({ letter: ch, pos: posOf(i, tl.length) }); j = k + 1; }
    else missing.push({ letter: ch, pos: posOf(i, tl.length) });
  }

  const extra = [...new Set(sl.filter((c) => !tl.includes(c) && /\S/.test(c)))].slice(0, 4);
  const similarity = levenshteinRatio(t, s);
  const wordAchieved = t.length > 0 && s.includes(t);
  const letterInTarget = !!L && t.includes(L);
  const letterAchieved = letterInTarget
    ? wordAchieved || !!L && s.includes(L)
    : wordAchieved;

  return { matched, missing, extra, similarity, wordAchieved, letterAchieved, letterInTarget };
}

/* تسميات المواضع — تُركَّب في نص الملاحظات لكل لغة واجهة */
export const POS_KEY: Record<PhonemePos, string> = { start: "start", mid: "mid", end: "end" };

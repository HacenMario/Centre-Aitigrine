/**
 * محلل النطق الذكي — AI Speech Analyzer (★ v3.24.4) — للأخصائي فقط
 * POST { audio?, transcript?, transcriptSource?, browserAsr?, targetWord, targetLetter, age?, gender?, lang? }
 *
 * ★ v3.24.4 — مسار صادق مضمون النجاح (تشخيص مؤكد بالاختبار الفعلي):
 *  — مسار SDK القديم /audio/asr كان 404 على api.z.ai (غير موجود) — سبب رسالة
 *    «لم يُكتشف كلام واضح» رغم وضوح الصوت. أُزيل كلياً.
 *  — النص أولاً من التعرف الصوتي داخل متصفح الجهاز (Web Speech) أو كتابة الأخصائي،
 *    ثم محاولة ASR خادمية احتياطية على المسار الرسمي /audio/transcriptions
 *    (تعمل تلقائياً متى صار مفتاح المركز مستحقاً لنموذج ASR).
 *  — المقارنة الحتمية رُفعت: تفكيك الحروف بمواضعها (أول/وسط/آخر) + نسبة تشابه
 *    Levenshtein → ملاحظات وتوجيهات مفصلة بلا أي خدمة خارجية (lib/phoneme.ts).
 *  — طبقة LLM النصية بنموذج صريح من القائمة المؤكدة للمفتاح + مهلة 40 ثانية:
 *    تعمل فوراً عند توفر الرصيد، وعند أي فشل يعود التحليل الحتمي بلا انقطاع.
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth";
import { disorderLabelAr, severityLabelAr } from "@/lib/wordbank";
import { compareSpeech } from "@/lib/phoneme";
import { createZai, serverTranscribe, ZAI_MODEL } from "@/lib/zai-config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Suspicion = "stutter" | "lisp" | "deletion" | "substitution" | "distortion" | "none";
type Severity = "low" | "mid" | "high";
type UiLang = "ar" | "fr" | "en" | "tr" | "es";

/* ★ v3.24.1: لغة الواجهة — التعليقات والتوجيهات تُصاغ بلغة الأخصائي نفسه */
const LANGS: UiLang[] = ["ar", "fr", "en", "tr", "es"];
const LLM_OUTPUT_LANG: Record<UiLang, string> = {
  ar: "العربية",
  fr: "الفرنسية",
  en: "الإنجليزية",
  tr: "التركية",
  es: "الإسبانية",
};

const LLM_SYSTEM = `أنت مساعد أخصائي أرطوفونية خبير في تشخيص اضطرابات النطق العربية عند الأطفال.
مهمتك: تحليل ما فهمه نظام التعرف على الصوت من نطق مريض لكلمة مستهدفة، وتقدير انحرافات المخارج.
القواعد:
- أجب بـ JSON صارم فقط بدون أي نص حوله — بهذا الشكل:
{"achieved": true|false, "suspicion": ["stutter"|"lisp"|"deletion"|"substitution"|"distortion"|"none"], "severity": "low"|"mid"|"high", "findings": ["..."], "advice": ["..."]}
- findings: ملاحظات قصيرة عن مخارج الحروف المرصودة (فقط ما يمكن استنتاجه من المقارنة بين الكلمة المستهدفة والنطق المفهوم).
- advice: توجيهات علاجية مبدئية قصيرة للأخصائي.
- اكتب findings وadvice باللغة المحددة أدناه (المقارنة نفسها تبقى على الكلمة العربية الأصلية).
- انتبه: النص المفهوم قد يخطئ — لا تُصرح بتشخيص قاطع، استخدم عبارات اشتباه مبدئي.
- إذا كان النطق المفهوم مطابقاً للكلمة المستهدفة: achieved=true و suspicion=["none"].`;

/* نصوص التحليل الحتمي الاحتياطي — بكل لغات الواجهة حتى لا تتوقف الميزة مترجمة */
const POS_LABEL: Record<UiLang, Record<"start" | "mid" | "end", string>> = {
  ar: { start: "في أول الكلمة", mid: "في وسطها", end: "في آخرها" },
  fr: { start: "au début du mot", mid: "au milieu", end: "à la fin" },
  en: { start: "at the word start", mid: "in the middle", end: "at the end" },
  tr: { start: "kelimenin başında", mid: "ortasında", end: "sonunda" },
  es: { start: "al inicio de la palabra", mid: "en medio", end: "al final" },
};

const HEURISTIC_TEXT: Record<UiLang, {
  okAll: string; missWord: (sim: number) => string;
  letterOk: (l: string) => string; letterMiss: (l: string, pos: string) => string;
  missingList: (ls: string) => string; extraList: (ls: string) => string;
  advice1: string; advice2: string; adviceTarget: (ls: string) => string;
}> = {
  ar: {
    okAll: "الكلمة المستهدفة ظهرت كاملة في النطق المفهوم.",
    missWord: (sim) => `الكلمة المستهدفة لم تظهر كاملة في النطق المفهوم (تشابه ${sim}%).`,
    letterOk: (l) => `الحرف المدروس (${l}) وُجد في النطق المفهوم.`,
    letterMiss: (l, pos) => `الحرف المدروس (${l}) لم يُسمع ${pos} — حذف أو إبدال محتمل.`,
    missingList: (ls) => `أصوات لم تُسمع في النطق: ${ls}.`,
    extraList: (ls) => `أصوات ظهرت زائدة عن الهدف: ${ls}.`,
    advice1: "أعد التسجيل في بيئة هادئة وطالب المريض بالنطق ببطء ووضوح.",
    advice2: "قارن النتيجة بمقابلة سريرية مباشرة للفم والمخارج قبل أي قرار.",
    adviceTarget: (ls) => `ركّز التدريب على مخارج الأصوات غير المسموعة (${ls}) في سياق كلمات قصيرة ثم أطِل تدريجياً.`,
  },
  fr: {
    okAll: "Le mot cible a été entièrement reconnu dans la prononciation.",
    missWord: (sim) => `Le mot cible n'a pas été reconnu entièrement (similarité ${sim}%).`,
    letterOk: (l) => `La lettre étudiée (${l}) est apparue dans la prononciation reconnue.`,
    letterMiss: (l, pos) => `La lettre étudiée (${l}) n'est pas audible ${pos} — omission ou substitution possible.`,
    missingList: (ls) => `Sons non entendus : ${ls}.`,
    extraList: (ls) => `Sons supplémentaires : ${ls}.`,
    advice1: "Refaites l'enregistrement au calme et demandez une prononciation lente et claire.",
    advice2: "Comparez ce résultat à un examen clinique direct avant toute décision.",
    adviceTarget: (ls) => `Concentrez l'entraînement sur les sons non entendus (${ls}) dans des mots courts puis allongez progressivement.`,
  },
  en: {
    okAll: "The target word was fully recognized in the pronunciation.",
    missWord: (sim) => `The target word was not fully recognized (${sim}% similarity).`,
    letterOk: (l) => `The studied letter (${l}) appeared in the recognized pronunciation.`,
    letterMiss: (l, pos) => `The studied letter (${l}) was not audible ${pos} — possible omission or substitution.`,
    missingList: (ls) => `Sounds not heard: ${ls}.`,
    extraList: (ls) => `Extra sounds beyond the target: ${ls}.`,
    advice1: "Re-record in a quiet setting and ask the patient to speak slowly and clearly.",
    advice2: "Compare this result with a direct clinical examination before any decision.",
    adviceTarget: (ls) => `Focus training on the unheard sounds (${ls}) in short words, then lengthen gradually.`,
  },
  tr: {
    okAll: "Hedef kelime konuşmada tam olarak algılandı.",
    missWord: (sim) => `Hedef kelime tam algılanmadı (benzerlik %${sim}).`,
    letterOk: (l) => `Çalışılan harf (${l}) algılanan konuşmada görüldü.`,
    letterMiss: (l, pos) => `Çalışılan harf (${l}) ${pos} duyulmadı — atma veya değiştirme olası.`,
    missingList: (ls) => `Duyulmayan sesler: ${ls}.`,
    extraList: (ls) => `Hedefte olmayan fazladan sesler: ${ls}.`,
    advice1: "Sessiz bir ortamda yeniden kaydedin ve hastaya yavaş ve net konuşmasını isteyin.",
    advice2: "Karar vermeden önce sonucu doğrudan klinik muayeneyle karşılaştırın.",
    adviceTarget: (ls) => `Duyulmayan seslerin (${ls}) çıkarımı üzerine kısa kelimelerle çalışın ve kademeli olarak uzatın.`,
  },
  es: {
    okAll: "La palabra objetivo se reconoció completamente en la pronunciación.",
    missWord: (sim) => `La palabra objetivo no se reconoció por completo (similitud ${sim}%).`,
    letterOk: (l) => `La letra estudiada (${l}) apareció en la pronunciación reconocida.`,
    letterMiss: (l, pos) => `La letra estudiada (${l}) no se oyó ${pos} — posible omisión o sustitución.`,
    missingList: (ls) => `Sonidos no escuchados: ${ls}.`,
    extraList: (ls) => `Sonidos adicionales fuera del objetivo: ${ls}.`,
    advice1: "Vuelva a grabar en un lugar silencioso y pida hablar lento y claro.",
    advice2: "Compare este resultado con un examen clínico directo antes de decidir.",
    adviceTarget: (ls) => `Concentre el entrenamiento en los sonidos no escuchados (${ls}) con palabras cortas y alargue gradualmente.`,
  },
};

function parseLLMJson(text: string): {
  achieved: boolean; suspicion: Suspicion[]; severity: Severity; findings: string[]; advice: string[];
} | null {
  try {
    const cleaned = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    const j = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const ALLOWED: Suspicion[] = ["stutter", "lisp", "deletion", "substitution", "distortion", "none"];
    const suspicion = Array.isArray(j.suspicion)
      ? (j.suspicion as string[]).filter((x): x is Suspicion => ALLOWED.includes(x as Suspicion)).slice(0, 4)
      : ["none"];
    const severity: Severity = j.severity === "high" ? "high" : j.severity === "mid" ? "mid" : "low";
    return {
      achieved: !!j.achieved,
      suspicion: suspicion.length ? suspicion : ["none"],
      severity,
      findings: (Array.isArray(j.findings) ? j.findings : []).map(String).slice(0, 6),
      advice: (Array.isArray(j.advice) ? j.advice : []).map(String).slice(0, 6),
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(["specialist"]);
    const b = await req.json().catch(() => ({}));

    const targetWord = String(b.targetWord || "").trim();
    const targetLetter = String(b.targetLetter || "").trim();
    if (!targetWord) return fail(400, "الكلمة المستهدفة مطلوبة");
    const lang: UiLang = LANGS.includes(b.lang as UiLang) ? (b.lang as UiLang) : "ar";
    const targetDisplay = String(b.targetDisplay || "").trim() || targetWord;
    const age = Number(b.age);
    const ageCtx = Number.isFinite(age) && age > 0 ? Math.min(120, Math.round(age)) : null;
    const genderCtx = b.gender === "male" || b.gender === "female" ? b.gender : null;

    /* الصوت اختياري الآن — النص المفهوم (من متصفح الجهاز أو كتابةً) يكفي للتحليل */
    let audioB64 = String(b.audio || "");
    const m = /^data:audio\/[a-zA-Z0-9.+-]+;base64,([\s\S]+)$/.exec(audioB64);
    if (m) audioB64 = m[1];
    audioB64 = audioB64.replace(/\s+/g, "");
    const hasAudio = !!audioB64 && audioB64.length >= 256;
    if (audioB64.length > 10 * 1024 * 1024) return fail(400, "التسجيل كبير جداً — أعد التسجيل بمدة أقصر");
    const clientTranscript = String(b.transcript || "").trim();
    const clientSource = String(b.transcriptSource || "");
    const browserAsr = b.browserAsr === true;
    if (!hasAudio && !clientTranscript) return fail(400, "التسجيل الصوتي أو النص المفهوم مطلوب");

    /* ═══ 1) النص المفهوم: المتصفح/الكتابة أولاً — ثم ASR خادمي احتياطي ═══ */
    let transcript = clientTranscript;
    let asrSource: "browser" | "server" | "manual" | "none" =
      clientTranscript ? (clientSource === "browser" ? "browser" : "manual") : "none";
    let serverAsrOk = false;
    if (!transcript && hasAudio) {
      const r = await serverTranscribe(audioB64, "audio/wav");
      serverAsrOk = r.ok;
      if (r.text) { transcript = r.text; asrSource = "server"; }
    }

    if (!transcript) {
      /* صادق ومحدد: لا نص إطلاقاً — هل المتصفح يدعم التعرف أصلاً؟ */
      return ok({
        ok: false,
        noSpeech: true,
        manualNeeded: !browserAsr && !serverAsrOk,
        transcript: "",
        targetWord: targetDisplay,
        engine: "none",
        asrSource,
      });
    }

    /* ═══ 2) المقارنة الحتمية المفصلة (lib/phoneme.ts) ═══ */
    const normLetter = targetLetter || targetWord.charAt(0);
    const cmp = compareSpeech(targetWord, transcript, normLetter);
    const simPct = Math.round(cmp.similarity * 100);

    /* ═══ 3) تحليل LLM — إن تعذر نرجع الحتمي المفصل وحده ═══ */
    let result: {
      achieved: boolean; suspicion: Suspicion[]; severity: Severity; findings: string[]; advice: string[];
    } | null = null;
    let usedLLM = false;
    try {
      const zai = await createZai();
      if (zai) {
        const userPrompt = [
          `الكلمة المستهدفة (عربية): ${targetWord}`,
          `الاسم المعروض للأخصائي بلغته: ${targetDisplay}`,
          targetLetter && targetLetter !== targetWord ? `الحرف المدروس: ${targetLetter}` : "",
          `الحرف موجود في الكلمة المستهدفة: ${cmp.letterInTarget ? "نعم" : "لا"}`,
          `ما فُهم من نطق المريض: "${transcript}" (المصدر: ${asrSource === "browser" ? "تعرف صوتي داخل متصفح الجهاز" : asrSource === "manual" ? "كتابة الأخصائي" : "خدمة تعرف خادمية"})`,
          `ملاحظة مهمة: النص المفهوم قد يكون بأي لغة من لغات التطبيق أو بلهجة عامية — قارن ما فُهم بالكلمة المستهدفة بلغتها المناسبة، واهتم بجودة الأصوات (أصوات العلة/التشوه/الإبدال) لا بالتطابق الحرفي للكتابة.`,
          `فحص حتمي مبدئي: الكلمة كاملة مفهومة؟ ${cmp.wordAchieved ? "نعم" : "لا"} — الحرف المدروس ظهر؟ ${cmp.letterAchieved ? "نعم" : "لا"} — تشابه ${simPct}%${cmp.missing.length ? ` — أصوات غير مسموعة: ${cmp.missing.map((x) => x.letter).join(" ")}` : ""}`,
          ageCtx ? `سن المريض التقريبي: ${ageCtx} سنة` : "",
          genderCtx ? `جنس المريض: ${genderCtx === "male" ? "ذكر" : "أنثى"}` : "",
          `لغة كتابة findings وadvice المطلوبة: ${LLM_OUTPUT_LANG[lang]}`,
        ].filter(Boolean).join("\n");
        const p = zai.chat.completions.create({
          model: ZAI_MODEL,
          messages: [
            { role: "system", content: LLM_SYSTEM },
            { role: "user", content: userPrompt },
          ],
        });
        p.catch(() => { /* يمنع unhandledRejection عند فوز مهلة الانتظار */ });
        const completion = await Promise.race([
          p,
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("llm-timeout")), 40000)),
        ]) as { choices: { message?: { content?: string } }[] };
        result = parseLLMJson(completion.choices[0]?.message?.content || "");
        usedLLM = !!result;
      }
    } catch {
      result = null;
    }

    /* حتمي مفصل — بلا LLM: نتيجة محافظة صادقة بلغة الواجهة */
    if (!result) {
      const HT = HEURISTIC_TEXT[lang];
      const P = POS_LABEL[lang];
      const findings: string[] = [
        cmp.wordAchieved ? HT.okAll : HT.missWord(simPct),
      ];
      if (cmp.letterInTarget) {
        findings.push(cmp.letterAchieved
          ? HT.letterOk(normLetter)
          : HT.letterMiss(normLetter, P.start));
      }
      if (cmp.missing.length) {
        const withPos = cmp.missing.slice(0, 3)
          .map((x) => `${x.letter} (${P[x.pos]})`).join("، ");
        findings.push(HT.missingList(withPos));
      }
      if (cmp.extra.length) findings.push(HT.extraList(cmp.extra.join(" ")));
      const advice = [HT.advice1, HT.advice2];
      if (cmp.missing.length) advice.push(HT.adviceTarget(cmp.missing.map((x) => x.letter).join(" ")));

      const suspicion: Suspicion[] = [];
      if (cmp.missing.length) suspicion.push("deletion");
      if (!cmp.wordAchieved && !cmp.missing.length) suspicion.push("distortion");
      if (!cmp.wordAchieved && cmp.missing.length && cmp.similarity < 0.6) suspicion.push("substitution");
      if (cmp.extra.length && !cmp.wordAchieved && !suspicion.includes("substitution")) suspicion.push("substitution");
      if (!cmp.wordAchieved && suspicion.length >= 2) suspicion.push(cmp.similarity < 0.4 ? "distortion" : "stutter");
      if (!suspicion.length) suspicion.push("none");

      result = {
        achieved: cmp.wordAchieved,
        suspicion: cmp.wordAchieved && cmp.letterAchieved ? ["none"] : suspicion.slice(0, 3),
        severity: cmp.wordAchieved ? "low" : cmp.similarity >= 0.6 ? "mid" : "high",
        findings: findings.slice(0, 5),
        advice: advice.slice(0, 3),
      };
    }

    return ok({
      ok: true,
      noSpeech: false,
      transcript,
      targetWord: targetDisplay,
      targetLetter: normLetter,
      achieved: result.achieved,
      /* الأكواد ثابتة والواجهة تترجمها بالقاموس — label عربي احتياطاً للتوافق */
      suspicion: result.suspicion.map((s) => ({ code: s, label: disorderLabelAr(s) })),
      severity: { code: result.severity, label: severityLabelAr(result.severity) },
      findings: result.findings,
      advice: result.advice,
      engine: usedLLM ? "ai" : "heuristic",
      asrSource,
      context: { age: ageCtx, gender: genderCtx },
    });
  });
}

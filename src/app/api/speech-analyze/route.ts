/**
 * محلل النطق الذكي — AI Speech Analyzer (★ v3.24) — للأخصائي فقط
 * POST { audio: base64 | dataURL, targetWord, targetLetter, age?, gender? }
 *
 * المنطق الاحترافي بثلاث طبقات:
 *  1) تحويل الكلام إلى نص (ASR) عبر z-ai-web-dev-sdk — بلا تكلفة على صاحب المركز
 *  2) مقارنة حتمية دقيقة: تطبيع عربي ثم فحص الكلمة والحرف المدروس في النطق المفهوم
 *  3) تحليل ذكاء اصطناعي (LLM) بسياق أرطوفوني: يحدد الاشتباه المبدئي (لثغة/تأتأة/حذف/
 *     إبدال/تشويه) وشدة الاشتباه وملاحظات المخارج وتوجيهات مقترحة — بJSON صارم
 * إن تعذر الذكاء الاصطناعي (بلا مفاتيح أو انقطاع): يرجع التحليل الحتمي وحده
 * مع engine:"heuristic" فلا تتوقف الميزة أبداً — والنتيجة مبدئية للتوجيه فقط.
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth";
import { normalizeArabic, disorderLabelAr, severityLabelAr } from "@/lib/wordbank";
import { createZai } from "@/lib/zai-config";

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
- انتبه: التعرف الصوتي قد يخطئ — لا تُصرح بتشخيص قاطع، استخدم عبارات اشتباه مبدئي.
- إذا كان النطق المفهوم مطابقاً للكلمة المستهدفة: achieved=true و suspicion=["none"].`;

/* نصوص التحليل الحتمي الاحتياطي — بكل لغات الواجهة حتى لا تتوقف الميزة مترجمة */
const HEURISTIC_TEXT: Record<UiLang, {
  wordOk: string; wordMiss: string; letterOk: (l: string) => string; letterMiss: (l: string) => string;
  advice1: string; advice2: string;
}> = {
  ar: {
    wordOk: "الكلمة المستهدفة ظهرت كاملة في النطق المفهوم.",
    wordMiss: "الكلمة المستهدفة لم تظهر كاملة في النطق المفهوم.",
    letterOk: (l) => `الحرف المدروس (${l}) ظهر في النطق المفهوم.`,
    letterMiss: (l) => `الحرف المدروس (${l}) لم يظهر في النطق المفهوم — حذف أو إبدال محتمل.`,
    advice1: "أعد التسجيل في بيئة هادئة وطالب المريض بالنطق ببطء ووضوح.",
    advice2: "قارن النتيجة بمقابلة سريرية مباشرة للفم والمخارج قبل أي قرار.",
  },
  fr: {
    wordOk: "Le mot cible a été entièrement reconnu dans la prononciation.",
    wordMiss: "Le mot cible n'a pas été reconnu entièrement dans la prononciation.",
    letterOk: (l) => `La lettre étudiée (${l}) est apparue dans la prononciation reconnue.`,
    letterMiss: (l) => `La lettre étudiée (${l}) n'est pas apparue — omission ou substitution possible.`,
    advice1: "Refaites l'enregistrement au calme et demandez une prononciation lente et claire.",
    advice2: "Comparez ce résultat à un examen clinique direct avant toute décision.",
  },
  en: {
    wordOk: "The target word was fully recognized in the pronunciation.",
    wordMiss: "The target word was not fully recognized in the pronunciation.",
    letterOk: (l) => `The studied letter (${l}) appeared in the recognized pronunciation.`,
    letterMiss: (l) => `The studied letter (${l}) did not appear — possible omission or substitution.`,
    advice1: "Re-record in a quiet setting and ask the patient to speak slowly and clearly.",
    advice2: "Compare this result with a direct clinical examination before any decision.",
  },
  tr: {
    wordOk: "Hedef kelime konuşmada tam olarak algılandı.",
    wordMiss: "Hedef kelime konuşmada tam olarak algılanmadı.",
    letterOk: (l) => `Çalışılan harf (${l}) algılanan konuşmada görüldü.`,
    letterMiss: (l) => `Çalışılan harf (${l}) algılanan konuşmada görülmedi — atma veya değiştirme olası.`,
    advice1: "Sessiz bir ortamda yeniden kaydedin ve hastaya yavaş ve net konuşmasını isteyin.",
    advice2: "Karar vermeden önce sonucu doğrudan klinik muayeneyle karşılaştırın.",
  },
  es: {
    wordOk: "La palabra objetivo se reconoció completamente en la pronunciación.",
    wordMiss: "La palabra objetivo no se reconoció completamente en la pronunciación.",
    letterOk: (l) => `La letra estudiada (${l}) apareció en la pronunciación reconocida.`,
    letterMiss: (l) => `La letra estudiada (${l}) no apareció — posible omisión o sustitución.`,
    advice1: "Vuelva a grabar en un lugar silencioso y pida hablar lento y claro.",
    advice2: "Compare este resultado con un examen clínico directo antes de decidir.",
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
    /* ★ v3.24.1: لغة واجهة الأخصائي — النتائج والتوجيهات تُصاغ بها */
    const lang: UiLang = LANGS.includes(b.lang as UiLang) ? (b.lang as UiLang) : "ar";
    /* الاسم المعروض في النتيجة — الكلمة بلغة الواجهة إن وردت (العربية تبقى مرجع المقارنة) */
    const targetDisplay = String(b.targetDisplay || "").trim() || targetWord;
    const age = Number(b.age);
    const ageCtx = Number.isFinite(age) && age > 0 ? Math.min(120, Math.round(age)) : null;
    const genderCtx = b.gender === "male" || b.gender === "female" ? b.gender : null;

    /* الصوت: dataURL أو base64 خام — حد 10MB */
    let audioB64 = String(b.audio || "");
    const m = /^data:audio\/[a-zA-Z0-9.+-]+;base64,([\s\S]+)$/.exec(audioB64);
    if (m) audioB64 = m[1];
    audioB64 = audioB64.replace(/\s+/g, "");
    if (!audioB64 || audioB64.length < 256) return fail(400, "التسجيل الصوتي مفقود أو قصير جداً");
    if (audioB64.length > 10 * 1024 * 1024) return fail(400, "التسجيل كبير جداً — أعد التسجيل بمدة أقصر");

    /* ═══ 1) ASR — تحويل الكلام لنص (★ v3.24.3: إعداد المفتاح من الكود مباشرة — يعمل في كل بيئة) ═══ */
    let transcript = "";
    let aiOk = true;
    let zai: { audio: { asr: { create: (a: { file_base64: string }) => Promise<{ text: string }> } }; chat: { completions: { create: (a: unknown) => Promise<{ choices: { message?: { content?: string } }[] }> } } } | null = null;
    try {
      zai = await createZai();
      if (!zai) throw new Error("no-zai");
      const r = await zai.audio.asr.create({ file_base64: audioB64 });
      transcript = String(r.text || "").trim();
      if (!transcript) aiOk = false;
    } catch {
      aiOk = false;
    }

    /* ═══ 2) المقارنة الحتمية ═══ */
    const normTarget = normalizeArabic(targetWord);
    const normSpeech = normalizeArabic(transcript);
    const normLetter = normalizeArabic(targetLetter || targetWord.charAt(0));
    const letterInTarget = normTarget.includes(normLetter);
    const wordAchieved = normSpeech.includes(normTarget);
    const letterAchieved = normLetter ? normSpeech.includes(normLetter) : wordAchieved;

    if (!transcript) {
      return ok({
        ok: false,
        noSpeech: true,
        transcript: "",
        targetWord: targetDisplay,
        engine: aiOk ? "ai" : "heuristic",
      });
    }

    /* ═══ 3) تحليل LLM — إن تعذر نرجع الحتمي وحده ═══ */
    let result: {
      achieved: boolean; suspicion: Suspicion[]; severity: Severity; findings: string[]; advice: string[];
    } | null = null;
    if (aiOk && zai) {
      try {
        const userPrompt = [
          `الكلمة المستهدفة (عربية): ${targetWord}`,
          `الاسم المعروض للأخصائي بلغته: ${targetDisplay}`,
          targetLetter && targetLetter !== targetWord ? `الحرف المدروس: ${targetLetter}` : "",
          `الحرف موجود في الكلمة المستهدفة: ${letterInTarget ? "نعم" : "لا"}`,
          `ما فهمه التعرف الصوتي من نطق المريض: "${transcript}"`,
          `ملاحظة مهمة: التعرف الصوتي متعدد اللغات والنطق قد يكون بأي لغة من لغات التطبيق (العربية أو الفرنسية أو الإنجليزية أو التركية أو الإسبانية) أو بلهجة عامية — قارن ما فُهم بالكلمة المستهدفة بلغتها المناسبة، واهتم بجودة الأصوات (أصوات العلة/التشوه/الإبدال) لا بالتطابق الحرفي للكتابة.`,
          `فحص حتمي: الكلمة كاملة مفهومة؟ ${wordAchieved ? "نعم" : "لا"} — الحرف المدروس ظهر في النطق المفهوم؟ ${letterAchieved ? "نعم" : "لا"}`,
          ageCtx ? `سن المريض التقريبي: ${ageCtx} سنة` : "",
          genderCtx ? `جنس المريض: ${genderCtx === "male" ? "ذكر" : "أنثى"}` : "",
          `لغة كتابة findings وadvice المطلوبة: ${LLM_OUTPUT_LANG[lang]}`,
        ].filter(Boolean).join("\n");
        const completion = await zai.chat.completions.create({
          messages: [
            { role: "assistant", content: LLM_SYSTEM },
            { role: "user", content: userPrompt },
          ],
          thinking: { type: "disabled" },
        });
        result = parseLLMJson(completion.choices[0]?.message?.content || "");
      } catch {
        result = null;
      }
    }

    /* حتمي فقط — بلا LLM: نتيجة محافظة صادقة — ★ v3.24.1 بلغة الواجهة */
    if (!result) {
      const HT = HEURISTIC_TEXT[lang];
      const suspicion: Suspicion[] = wordAchieved
        ? letterAchieved ? ["none"] : ["substitution"]
        : letterAchieved
          ? ["deletion"]
          : ["deletion", "substitution"];
      result = {
        achieved: wordAchieved,
        suspicion: wordAchieved && letterAchieved ? ["none"] : suspicion,
        severity: wordAchieved ? "low" : "mid",
        findings: [
          wordAchieved ? HT.wordOk : HT.wordMiss,
          letterAchieved ? HT.letterOk(normLetter) : HT.letterMiss(normLetter),
        ],
        advice: [HT.advice1, HT.advice2],
      };
    }

    return ok({
      ok: true,
      noSpeech: false,
      transcript,
      targetWord: targetDisplay,
      targetLetter: targetLetter || targetWord.charAt(0),
      achieved: result.achieved,
      /* الأكواد ثابتة والواجهة تترجمها بالقاموس — label عربي احتياطاً للتوافق */
      suspicion: result.suspicion.map((s) => ({ code: s, label: disorderLabelAr(s) })),
      severity: { code: result.severity, label: severityLabelAr(result.severity) },
      findings: result.findings,
      advice: result.advice,
      engine: aiOk && result ? "ai" : "heuristic",
      context: { age: ageCtx, gender: genderCtx },
    });
  });
}

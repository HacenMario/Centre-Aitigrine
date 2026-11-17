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

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Suspicion = "stutter" | "lisp" | "deletion" | "substitution" | "distortion" | "none";
type Severity = "low" | "mid" | "high";

const LLM_SYSTEM = `أنت مساعد أخصائي أرطوفونية خبير في تشخيص اضطرابات النطق العربية عند الأطفال.
مهمتك: تحليل ما فهمه نظام التعرف على الصوت من نطق مريض لكلمة مستهدفة، وتقدير انحرافات المخارج.
القواعد:
- أجب بـ JSON صارم فقط بدون أي نص حوله — بهذا الشكل:
{"achieved": true|false, "suspicion": ["stutter"|"lisp"|"deletion"|"substitution"|"distortion"|"none"], "severity": "low"|"mid"|"high", "findings": ["..."], "advice": ["..."]}
- findings: ملاحظات قصيرة بالعربية عن مخارج الحروف المرصودة (فقط ما يمكن استنتاجه من المقارنة بين الكلمة المستهدفة والنطق المفهوم).
- advice: توجيهات علاجية مبدئية قصيرة بالعربية للأخصائي.
- انتبه: التعرف الصوتي قد يخطئ — لا تُصرح بتشخيص قاطع، استخدم عبارات اشتباه مبدئي.
- إذا كان النطق المفهوم مطابقاً للكلمة المستهدفة: achieved=true و suspicion=["none"].`;

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

    /* ═══ 1) ASR — تحويل الكلام لنص ═══ */
    let transcript = "";
    let aiOk = true;
    let zai: { audio: { asr: { create: (a: { file_base64: string }) => Promise<{ text: string }> } }; chat: { completions: { create: (a: unknown) => Promise<{ choices: { message?: { content?: string } }[] }> } } } | null = null;
    try {
      const mod = await import("z-ai-web-dev-sdk");
      zai = (await mod.default.create()) as unknown as typeof zai;
      const r = await zai.audio.asr.create({ file_base64: audioB64 });
      transcript = String(r.text || "").trim();
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
        targetWord,
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
          `الكلمة المستهدفة: ${targetWord}`,
          targetLetter && targetLetter !== targetWord ? `الحرف المدروس: ${targetLetter}` : "",
          `الحرف موجود في الكلمة المستهدفة: ${letterInTarget ? "نعم" : "لا"}`,
          `ما فهمه التعرف الصوتي من نطق المريض: "${transcript}"`,
          `فحص حتمي: الكلمة كاملة مفهومة؟ ${wordAchieved ? "نعم" : "لا"} — الحرف المدروس ظهر في النطق المفهوم؟ ${letterAchieved ? "نعم" : "لا"}`,
          ageCtx ? `سن المريض التقريبي: ${ageCtx} سنة` : "",
          genderCtx ? `جنس المريض: ${genderCtx === "male" ? "ذكر" : "أنثى"}` : "",
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

    /* حتمي فقط — بلا LLM: نتيجة محافظة صادقة */
    if (!result) {
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
          wordAchieved ? "الكلمة المستهدفة ظهرت كاملة في النطق المفهوم." : "الكلمة المستهدفة لم تظهر كاملة في النطق المفهوم.",
          letterAchieved
            ? `الحرف المدروس (${normLetter}) ظهر في النطق المفهوم.`
            : `الحرف المدروس (${normLetter}) لم يظهر في النطق المفهوم — حذف أو إبدال محتمل.`,
        ],
        advice: [
          "أعد التسجيل في بيئة هادئة وطالب المريض بالنطق ببطء ووضوح.",
          "قارن النتيجة بمقابلة سريرية مباشرة للفم والمخارج قبل أي قرار.",
        ],
      };
    }

    return ok({
      ok: true,
      noSpeech: false,
      transcript,
      targetWord,
      targetLetter: targetLetter || targetWord.charAt(0),
      achieved: result.achieved,
      suspicion: result.suspicion.map((s) => ({ code: s, label: disorderLabelAr(s) })),
      severity: { code: result.severity, label: severityLabelAr(result.severity) },
      findings: result.findings,
      advice: result.advice,
      engine: aiOk && result ? "ai" : "heuristic",
      context: { age: ageCtx, gender: genderCtx },
    });
  });
}

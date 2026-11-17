/**
 * ★ v3.24.4 — طبقة الذكاء الاصطناعي بمفتاح المركز المدمج (بطلب صاحب المركز)
 *
 * تشخيص مؤكد بالاختبار الفعلي (v3.24.4):
 *  — مسار SDK القديم /audio/asr غير موجود على api.z.ai إطلاقاً (404) — كان سبب فشل
 *    ASR الخادمي دائماً ورسالة «لم يُكتشف كلام واضح» رغم وضوح الصوت.
 *  — مفتاح المركز النصي فقط (glm-4.5 → glm-5.3-flashx) ولا يملك نماذج صوت،
 *    لذا التعرف الصوتي الفعلي يتم داخل متصفح الجهاز (Web Speech) أو كتابةً.
 *  — طبقة تحليل LLM النصية تعمل بالمفتاح عند توفر الرصيد (429 عند النفاد) —
 *    نموذج صريح من القائمة المتاحة، وتُستبدل تلقائياً بالمحرك الحتمي عند أي فشل.
 * لذلك: العميل مُخزَّن (عمولة واحدة)، ومسار transcriptions الرسمي يُجرَّب مرة
 * واحدة ثم يُعلَّم «معطلاً» لتفادي نداءات بلا جدوى في كل طلب.
 */
const EMBEDDED_ZAI_CONFIG = {
  baseUrl: "https://api.z.ai/api/paas/v4",
  apiKey: "e564580dc296471fa45acd809eb87dac.YYLRlQAvgEylnfPe",
};

/* نموذج نصي من القائمة المؤكدة لهذا المفتاح (اختبار /models فعلي) */
export const ZAI_MODEL = "glm-5.3-flash";
/* نموذج ASR المرشح على مسار transcriptions الرسمي — يُجرَّب مرة واحدة ثم كاش */
export const ASR_MODEL = "glm-asr";

export type ZaiLite = {
  chat: { completions: { create: (a: unknown) => Promise<{ choices: { message?: { content?: string } }[] }> } };
};

let clientPromise: Promise<ZaiLite | null> | null = null;

export async function createZai(): Promise<ZaiLite | null> {
  if (clientPromise) return clientPromise;
  clientPromise = (async () => {
    try {
      const mod = await import("z-ai-web-dev-sdk");
      /* 1) الملف المحلي إن وُجد (أولوية الإعداد الموضعي) */
      try {
        return (await mod.default.create()) as unknown as ZaiLite;
      } catch {
        /* 2) المفتاح المضمّن — بناء العميل مباشرة (constructor يقبل baseUrl+apiKey) */
        const Ctor = mod.default as unknown as new (c: typeof EMBEDDED_ZAI_CONFIG) => ZaiLite;
        return new Ctor(EMBEDDED_ZAI_CONFIG);
      }
    } catch {
      return null;
    }
  })();
  return clientPromise;
}

/* ── ASR خادمي احتياطي على المسار الرسمي (OpenAI-style multipart) ──
   يعمل فقط إن كان مفتاح المركز مستحقاً لنموذج ASR؛ خلاف ذلك يُعلَّم معطلاً
   بعد أول محاولة ولا يُعاد تجريبها (بلا إبطاء لكل طلب). */
let serverAsrDown = false;

export async function serverTranscribe(fileB64: string, mime: string):
  Promise<{ ok: boolean; text: string; reason: string }> {
  if (serverAsrDown) return { ok: false, text: "", reason: "down-cached" };
  try {
    const fd = new FormData();
    fd.append("file", new Blob([Buffer.from(fileB64, "base64")], { type: mime || "audio/wav" }), "audio");
    fd.append("model", ASR_MODEL);
    const res = await Promise.race([
      fetch(`${EMBEDDED_ZAI_CONFIG.baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${EMBEDDED_ZAI_CONFIG.apiKey}`, "X-Z-AI-From": "Z" },
        body: fd,
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("asr-timeout")), 20000)),
    ]) as Response;
    const bodyText = await res.text();
    if (!res.ok) {
      /* نموذج غير مستحق/غير موجود/رصيد نافد → معطّل لهذه الجلسة */
      serverAsrDown = true;
      console.error("[speech-analyze] server ASR unavailable:", res.status, bodyText.slice(0, 160));
      return { ok: false, text: "", reason: `http-${res.status}` };
    }
    const j = JSON.parse(bodyText) as { text?: string };
    return { ok: true, text: String(j.text || "").trim(), reason: "" };
  } catch (e) {
    serverAsrDown = true;
    console.error("[speech-analyze] server ASR error:", String((e as Error)?.message || e).slice(0, 160));
    return { ok: false, text: "", reason: "error" };
  }
}

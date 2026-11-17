/**
 * ★ v3.24.3 — إعداد z-ai-web-dev-sdk من الكود مباشرة (بطلب صاحب المركز)
 * كان SDK يقرأ ملف .z-ai-config من القرص — غير متوفر في النشر السحابي،
 * فكان ASR يفشل دائماً ويقع التحليل على الحتمي «سجّل في مكان هادئ» رغم صوت واضح.
 * الآن: محاولة الملف أولاً (بيئات مهيأة)، وإن غاب يُبنى العميل مباشرة بالمفتاح المضمّن —
 * فتصبح المكالمات السحابية فعلياً في كل بيئة. (المفتاح من صاحب المركز بنفسه)
 */
const EMBEDDED_ZAI_CONFIG = {
  baseUrl: "https://api.z.ai/api/paas/v4",
  apiKey: "e564580dc296471fa45acd809eb87dac.YYLRlQAvgEylnfPe",
};

export type ZaiLite = {
  audio: { asr: { create: (a: { file_base64: string }) => Promise<{ text: string }> } };
  chat: { completions: { create: (a: unknown) => Promise<{ choices: { message?: { content?: string } }[] }> } };
};

export async function createZai(): Promise<ZaiLite | null> {
  try {
    const mod = await import("z-ai-web-dev-sdk");
    /* 1) الملف المحلي إن وُجد (أولوية الإعداد الموضعي) */
    try {
      return (await mod.default.create()) as unknown as ZaiLite;
    } catch {
      /* 2) المفتاح المضمّن — بناء العميل مباشرة (constructor يعمل وقت التشغيل) */
      const Ctor = mod.default as unknown as new (c: typeof EMBEDDED_ZAI_CONFIG) => ZaiLite;
      return new Ctor(EMBEDDED_ZAI_CONFIG);
    }
  } catch {
    return null;
  }
}

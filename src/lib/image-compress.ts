/**
 * ضغط الصور في المتصفح قبل الرفع — v3.17
 * ═══════════════════════════════════════════════════════════════
 * لماذا؟ صور الهاتف الخام 3-8MB تُخزن في GridFS كما هي — وكل ملف
 * يعني بايتات Origin عند أول مشاهدة (وVercel المجاني محدود النطاق).
 * الضغط هنا يقلص الرفع 10-20× بلا فرق يُلاحظ على الشاشات:
 *  - تخفيض الأبعاد إلى حد أقصى 1920px على الضلع الأطول
 *  - إعادة ترميز JPEG بجودة 0.85 (PNG الشفاف يبقى PNG لحفظ الشفافية)
 *  - الفيديو وGIF المتحرك والصور الصغيرة (≤512KB) تمر كما هي
 *  - أي فشل (canvas/توافق/ترميز) → يُعاد الملف الأصلي — الرفع لا يتعطل أبداً
 * ⚠️ لا يغير شيئاً في الخادم ولا في الواجهات — مسار الرفع نفسه تماماً
 */
export async function compressImageFile(file: File): Promise<File> {
  try {
    /* ليست صورة (فيديو) أو GIF متحرك — تمر كما هي */
    if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
    /* صغيرة أصلاً — لا داعي لأي معالجة */
    if (file.size <= 512 * 1024) return file;

    const bitmap = await createImageBitmap(file);
    const maxDim = 1920;
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxDim / longest);
    /* صغيرة الأبعاد وحجمها معقول (≤2MB) — إعادة الترميز قد لا تفيد */
    if (scale >= 1 && file.size <= 2 * 1024 * 1024) {
      bitmap.close?.();
      return file;
    }

    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    /* JPEG بلا قناة شفافية — نملأ أبيض قبل الرسم لتفادي خلفية سوداء */
    if (file.type !== "image/png") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    /* PNG يبقى PNG (شفافية) — البقية JPEG */
    const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, 0.85)
    );
    /* الضغط لم يفد (صورة مفهرسة/شفافية واسعة…) — الأصل أفضل */
    if (!blob || blob.size >= file.size) return file;

    /* امتداد متوافق مع النوع الناتج (الخادم يسمي الملف من MIME على أي حال) */
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    const ext = outType === "image/png" ? "png" : "jpg";
    return new File([blob], `${base}.${ext}`, {
      type: outType,
      lastModified: Date.now(),
    });
  } catch {
    /* أي عطل — الملف الأصلي كما هو */
    return file;
  }
}

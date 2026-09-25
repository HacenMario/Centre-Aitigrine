/**
 * مركز أيت تقرين — نماذج MongoDB (mongoose)
 * كل بيانات المركز: حسابات، خدمات، تكوينات، مواعيد، كتب إلكترونية، إعدادات، إشعارات
 */
import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

/* ─────────────── الحسابات ─────────────── */
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "assistant", "specialist", "client"],
      required: true,
      index: true,
    },
    /** للأخصائي: نفسي / أرطوفوني / كلاهما */
    specialty: {
      type: String,
      enum: ["psychological", "art_therapy", "both"],
      default: undefined,
    },
    /** لغات الأخصائي (عربية دائماً + فرنسية/إنجليزية اختيارياً) */
    langs: { type: [String], default: ["ar"] },
    title: { type: String, default: "" }, // اللقب المهني (عربي)
    titleFr: { type: String, default: "" }, // اللقب المهني بالفرنسية
    titleEn: { type: String, default: "" }, // اللقب المهني بالإنجليزية
    bio: { type: String, default: "" },
    bioFr: { type: String, default: "" },
    bioEn: { type: String, default: "" },
    photoBase64: { type: String, default: "" },
    /** سنوات الخبرة (للأخصائي) */
    yearsExperience: { type: Number, default: 0, min: 0, max: 70 },
    /** التخصصات المرتبطة بالأخصائي — مراجع مجموعة التخصصات */
    specialties: [{ type: Schema.Types.ObjectId, ref: "Specialty" }],
    /** ساعات العمل الأسبوعية — تُحدد بالنقر: { "0": ["09:00","10:00"], ... } */
    weeklyHours: { type: Map, of: [String], default: {} },
    /** الأخصائي المعالج للعميل (يضبطه الأدمين) */
    assignedSpecialistId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    /** عبارة الاسترجاع (نمط طمأنينة) — تُحفظ مشفّرة SHA-256 + ملح، لا تُرسل أبداً للواجهة
     *  العميل يستعيد حسابه فورياً بها دون انتظار الإدارة */
    recoveryHash: { type: String, default: null },
    recoverySalt: { type: String, default: null },
    /* v3.8: دخول Google — مرتبط بالحساب بعد أول دخول ناجح */
    googleId: { type: String, default: "", index: true },
    googleEmail: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: mongoose.Types.ObjectId };
export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>("User", UserSchema);

/* ─────────────── التخصصات (افتراضية دائمة + مخصصة) ───────────────
 * قائمة مرجعية ثابتة تُبذر مرة واحدة عند أول تشغيل (ليست بيانات تجريبية)
 * يمكن للإدارة إضافة تخصصات أخرى بثلاث لغات — الافتراضية لا تُحذف
 */
const SpecialtySchema = new Schema(
  {
    /** رمز ثابت للتخصصات الافتراضية — يمنع إعادة زرع المحذوفة ويحمي الأسماء المعدلة */
    code: { type: String, default: "", index: true },
    name: {
      ar: { type: String, required: true },
      fr: { type: String, default: "" },
      en: { type: String, default: "" },
      tr: { type: String, default: "" },
      es: { type: String, default: "" },
    },
    builtin: { type: Boolean, default: false, index: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export type SpecialtyDoc = InferSchemaType<typeof SpecialtySchema> & { _id: mongoose.Types.ObjectId };
export const Specialty: Model<SpecialtyDoc> =
  (mongoose.models.Specialty as Model<SpecialtyDoc>) ||
  mongoose.model<SpecialtyDoc>("Specialty", SpecialtySchema);

/* ─────────────── الجلسات ─────────────── */
const SessionSchema = new Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);
export const Session =
  (mongoose.models.Session as Model<InferSchemaType<typeof SessionSchema>>) ||
  mongoose.model("Session", SessionSchema);

/* ─────────────── إعدادات المركز (مستند وحيد) ─────────────── */
const SettingsSchema = new Schema(
  {
    key: { type: String, default: "center", unique: true },
    centerName: { type: String, default: "مركز أيت تقرين" },
    centerNameFr: { type: String, default: "" },
    centerNameEn: { type: String, default: "" },
    /** ★ v3.10: تركي/إسباني — كل حقول الواجهة بخمس لغات */
    centerNameTr: { type: String, default: "" },
    centerNameEs: { type: String, default: "" },
    tagline: { type: String, default: "" },
    taglineFr: { type: String, default: "" },
    taglineEn: { type: String, default: "" },
    taglineTr: { type: String, default: "" },
    taglineEs: { type: String, default: "" },
    aboutShort: { type: String, default: "" },
    aboutShortFr: { type: String, default: "" },
    aboutShortEn: { type: String, default: "" },
    aboutShortTr: { type: String, default: "" },
    aboutShortEs: { type: String, default: "" },
    phone: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    addressFr: { type: String, default: "" },
    addressEn: { type: String, default: "" },
    addressTr: { type: String, default: "" },
    addressEs: { type: String, default: "" },
    lat: { type: Number, default: 36.7538 }, // الجزائر العاصمة افتراضياً
    lng: { type: Number, default: 3.0588 },
    /** رابط الموقع على خرائط Google — يوجّه الزوار للمركز مباشرة */
    mapsUrl: { type: String, default: "" },
    logoBase64: { type: String, default: "" },
    /** تفعيل اللغات FR/EN/TR/ES (العربية دائماً) */
    langFr: { type: Boolean, default: true },
    langEn: { type: Boolean, default: true },
    langTr: { type: Boolean, default: true },
    langEs: { type: Boolean, default: true },
    /** خيارات الحقول تُدار من الإدارة */
    options: {
      specialties: { type: [String], default: [] },
      /** ★ v3.10: رموز التخصصات الافتراضية التي حذفتها الإدارة — تمنع إعادة زرعها عند الإقلاع */
      deletedBuiltinSpecialties: { type: [String], default: [] },
      /** v3.5: التصنفات ثلاثية اللغة — كل عنصر { ar, fr, en } (القديمة نصوص تُطبَّع تلقائياً) */
      serviceCategories: { type: [Schema.Types.Mixed], default: [] },
      courseCategories: { type: [Schema.Types.Mixed], default: [] },
      slotMinutes: { type: Number, default: 60 },
      dayStart: { type: String, default: "09:00" },
      dayEnd: { type: String, default: "17:00" },
      /** v3.5: أوقات كل يوم من الأسبوع — { "0": { start, end, closed }, … }
       *  0 = الأحد … 6 = السبت — اليوم بلا إدخال يسقط على dayStart/dayEnd العام */
      dayHours: { type: Schema.Types.Mixed, default: {} },
    },
    social: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      tiktok: { type: String, default: "" },
      youtube: { type: String, default: "" },
      telegram: { type: String, default: "" },
    },
    /** سلايدر الوسائط في الرئيسية — صور/فيديو (url = ملف مرفوع على القرص، data = base64 قديم) */
    sliderMedia: [
      {
        type: { type: String, enum: ["image", "video"] },
        url: { type: String, default: "" }, // /api/media/<file> — النظام الجديد v3
        data: { type: String, default: "" }, // dataURL base64 — توافق قديم
        title: { type: String, default: "" },
      },
    ],
    /** مفاتيح VAPID لإشعارات الويب */
    vapidPublic: { type: String, default: "" },
    vapidPrivate: { type: String, default: "" },
  },
  { timestamps: true }
);
export type SettingsDoc = InferSchemaType<typeof SettingsSchema> & { _id: mongoose.Types.ObjectId };
export const Settings: Model<SettingsDoc> =
  (mongoose.models.Settings as Model<SettingsDoc>) || mongoose.model<SettingsDoc>("Settings", SettingsSchema);

/* ─────────────── الخدمات ─────────────── */
const ServiceSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    titleFr: { type: String, default: "" },
    titleEn: { type: String, default: "" },
    description: { type: String, default: "" },
    descriptionFr: { type: String, default: "" },
    descriptionEn: { type: String, default: "" },
    icon: { type: String, default: "✨" }, // أيقونة إيموجي من كيبورد الهاتف
    category: { type: String, default: "" },
    price: { type: Number, default: 0 },
    durationMin: { type: Number, default: 60 },
    coverBase64: { type: String, default: "" },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
export type ServiceDoc = InferSchemaType<typeof ServiceSchema> & { _id: mongoose.Types.ObjectId };
export const Service: Model<ServiceDoc> =
  (mongoose.models.Service as Model<ServiceDoc>) || mongoose.model<ServiceDoc>("Service", ServiceSchema);

/* ─────────────── التكوينات ─────────────── */
const CourseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    titleFr: { type: String, default: "" },
    titleEn: { type: String, default: "" },
    description: { type: String, default: "" },
    descriptionFr: { type: String, default: "" },
    descriptionEn: { type: String, default: "" },
    category: { type: String, default: "" },
    trainerName: { type: String, default: "" },
    price: { type: Number, default: 0 },
    capacity: { type: Number, default: 0 }, // 0 = بلا حد
    /** المسجّلون في التكوين — لحساب المقاعد المتبقية وشريط التقدم (نمط طمأنينة) */
    enrolledIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    coverBase64: { type: String, default: "" },
    /** صور التكوين base64 */
    images: { type: [String], default: [] },
    /** حصص التكوين — منطق أوقات حقيقي */
    sessions: [
      {
        title: { type: String, default: "" },
        date: { type: String, required: true }, // YYYY-MM-DD
        start: { type: String, required: true }, // HH:mm
        end: { type: String, required: true }, // HH:mm
      },
    ],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export type CourseDoc = InferSchemaType<typeof CourseSchema> & { _id: mongoose.Types.ObjectId };
export const Course: Model<CourseDoc> =
  (mongoose.models.Course as Model<CourseDoc>) || mongoose.model<CourseDoc>("Course", CourseSchema);

/* ─────────────── الإعلانات (نمط طمأنينة v1.15) ───────────────
 * الإدارة تنشئ الإعلانات (صور + فيديو)، المنشور منها يظهر في صفحة الإعلانات
 * العمومية والإعلان العائم وشريط الإعلانات. التفاعل: مشاهدة/إعجاب/تعليق
 * للعملاء والأخصائيين — التعليق يقبل رد المركز وحجبه.
 */
const AdSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 1500 },
    /** وسائط الإعلان: حتى 5 صور + فيديو واحد (data URLs) */
    media: {
      type: [String],
      default: [],
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length <= 6,
        message: "MAX_6_MEDIA",
      },
    },
    /** الإعلان العائم: يظهر تلقائياً للعملاء والأخصائيين في صفحات الموقع */
    float: { type: Boolean, default: false },
    /** كم مرة يظهر لكل مستخدم (حد يمنع الإزعاج) */
    floatPerUser: { type: Number, default: 3, min: 1, max: 20 },
    /** مدة الصلاحية بالأيام من لحظة النشر — بعدها يختفي تلقائياً */
    floatDays: { type: Number, default: 7, min: 1, max: 365 },
    expiresAt: { type: Date, default: null, index: true },
    /** تفاعلات الجمهور: مشاهدات فريدة + إعجابات + تعليقات (مع حجب ورد) */
    views: { type: Number, default: 0 },
    viewers: { type: [Schema.Types.ObjectId], default: [] },
    likes: { type: [Schema.Types.ObjectId], default: [] },
    comments: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        name: { type: String, default: "—", maxlength: 80 },
        text: { type: String, required: true, maxlength: 400 },
        /** حجب التعليق — يختفي من العرض العمومي */
        hidden: { type: Boolean, default: false },
        /** رد المركز على التعليق */
        reply: {
          text: { type: String, default: null, maxlength: 400 },
          at: { type: Date, default: null },
          _id: false,
        },
        createdAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    /** عدّاد مرات الظهور لكل مستخدم (حد الإزعاج للإعلان العائم) */
    impressions: [
      {
        userId: { type: Schema.Types.ObjectId },
        count: { type: Number, default: 0 },
        _id: false,
      },
    ],
    /** DRAFT = مسودة | PUBLISHED = منشور | ARCHIVED = مؤرشف */
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      default: "DRAFT",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "center_ads" }
);
AdSchema.index({ status: 1, reviewedAt: -1 });
export type AdDoc = InferSchemaType<typeof AdSchema> & { _id: mongoose.Types.ObjectId };
export const Ad: Model<AdDoc> =
  (mongoose.models.Ad as Model<AdDoc>) || mongoose.model<AdDoc>("Ad", AdSchema);

/* ─────────────── المواعيد ─────────────── */
const AppointmentSchema = new Schema(
  {
    clientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    specialistId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", default: null },
    serviceTitle: { type: String, default: "" },
    /** العنوان بثلاث لغات ليظهر الموعد مترجماً عند كل مستخدم */
    serviceTitleFr: { type: String, default: "" },
    serviceTitleEn: { type: String, default: "" },
    kind: { type: String, enum: ["psychological", "art_therapy"], default: "psychological" },
    /** طريقة الجلسة: حضورية أو عن بُعد */
    mode: { type: String, enum: ["onsite", "remote"], default: "onsite" },
    /** سعر الجلسة (يحدده المركز) وحالة الأداء */
    price: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
    /* v3.8: الكوبون والخصم والفاتورة */
    couponCode: { type: String, default: "", uppercase: true, trim: true },
    discount: { type: Number, default: 0 }, // مبلغ الخصم المطبّق (بدينار)
    invoiceNumber: { type: String, default: "", index: true },
    invoiceFile: { type: String, default: "" }, // اسم ملف PDF في GridFS
    invoiceAt: { type: Date, default: null },
    /** ★ v3.10: إصدار تخطيط الفاتورة — يُجبر إعادة توليد الفواتير القديمة للتخطيط الجديد (صفحة واحدة) */
    invoiceVersion: { type: String, default: "" },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    time: { type: String, required: true }, // HH:mm
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    remindedDay: { type: Boolean, default: false },
    remindedHour: { type: Boolean, default: false },
  },
  { timestamps: true }
);
AppointmentSchema.index({ date: 1, time: 1, specialistId: 1 }, { unique: true });
export type AppointmentDoc = InferSchemaType<typeof AppointmentSchema> & { _id: mongoose.Types.ObjectId };
export const Appointment: Model<AppointmentDoc> =
  (mongoose.models.Appointment as Model<AppointmentDoc>) ||
  mongoose.model<AppointmentDoc>("Appointment", AppointmentSchema);

/* ─────────────── الكتب الإلكترونية ─────────────── */
const EbookSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    titleFr: { type: String, default: "" },
    titleEn: { type: String, default: "" },
    summary: { type: String, default: "" },
    summaryFr: { type: String, default: "" },
    summaryEn: { type: String, default: "" },
    author: { type: String, default: "" },
    coverBase64: { type: String, default: "" },
    /** محتوى: فقرات نصية + أسطر إجابات تفاعلية */
    blocks: [
      {
        type: { type: String, enum: ["text", "answer"] }, // text = فقرة، answer = سطر إجابة
        text: { type: String, default: "" },
        lines: { type: Number, default: 1 }, // عدد أسطر الإجابة
      },
    ],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export type EbookDoc = InferSchemaType<typeof EbookSchema> & { _id: mongoose.Types.ObjectId };
export const Ebook: Model<EbookDoc> =
  (mongoose.models.Ebook as Model<EbookDoc>) || mongoose.model<EbookDoc>("Ebook", EbookSchema);

/* إجابات العميل على أسطر الكتاب — تظهر للإدارة وللأخصائي المعالج فقط */
const EbookAnswerSchema = new Schema(
  {
    ebookId: { type: Schema.Types.ObjectId, ref: "Ebook", required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** { "3": "نص الإجابة على السطر رقم 3" } */
    answers: { type: Map, of: String, default: {} },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
EbookAnswerSchema.index({ ebookId: 1, clientId: 1 }, { unique: true });
export const EbookAnswer =
  (mongoose.models.EbookAnswer as Model<InferSchemaType<typeof EbookAnswerSchema>>) ||
  mongoose.model("EbookAnswer", EbookAnswerSchema);

/* ─────────────── المقالات (v3.6.0) ───────────────
 * مقالات علمية في علم النفس والأرطفونية ينشرها الأخصائيون وإدارة المركز فقط.
 * القراءة عامة للجميع (زوار ومستخدمون) — النشر/التعديل بصلاحيات.
 * العنوان والنبذة والمتن ثلاثية اللغة: يقرأ كل زائر المقال بلغته
 * (إن فارغت الترجمة سقطت تلقائياً إلى العربية في الواجهة).
 */
const ArticleSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    titleFr: { type: String, default: "", trim: true, maxlength: 200 },
    titleEn: { type: String, default: "", trim: true, maxlength: 200 },
    summary: { type: String, default: "", trim: true, maxlength: 600 },
    summaryFr: { type: String, default: "", trim: true, maxlength: 600 },
    summaryEn: { type: String, default: "", trim: true, maxlength: 600 },
    /** متن المقال — فقرات نصية تفصل بينها أسطر فارغة */
    content: { type: String, required: true, maxlength: 30000 },
    contentFr: { type: String, default: "", maxlength: 30000 },
    contentEn: { type: String, default: "", maxlength: 30000 },
    /** مجال المقال */
    category: {
      type: String,
      enum: ["psychology", "orthophony", "general"],
      default: "general",
      index: true,
    },
    coverBase64: { type: String, default: "" },
    /** بطاقة الكاتب — لقطة محفوظة لحظة النشر (لا تتأثر بتغيّر الحساب لاحقاً) */
    authorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    authorName: { type: String, default: "", maxlength: 120 },
    authorRole: { type: String, default: "", enum: ["", "admin", "assistant", "specialist"] },
    authorTitle: { type: String, default: "", maxlength: 120 },
    authorTitleFr: { type: String, default: "", maxlength: 120 },
    authorTitleEn: { type: String, default: "", maxlength: 120 },
    /** المعطّل يختفي من العرض العمومي — يبقى مرئياً للإدارة */
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: "articles" }
);
ArticleSchema.index({ active: 1, createdAt: -1 });
export type ArticleDoc = InferSchemaType<typeof ArticleSchema> & { _id: mongoose.Types.ObjectId };
export const Article: Model<ArticleDoc> =
  (mongoose.models.Article as Model<ArticleDoc>) || mongoose.model<ArticleDoc>("Article", ArticleSchema);

/* ─────────────── صفحات المحتوى (FAQ / عن المركز / خصوصية / شروط) ─────────────── */
const PageContentSchema = new Schema(
  {
    key: { type: String, enum: ["faq", "about", "privacy", "terms"], unique: true },
    /** faq: [{q,a}] — البقية: [{title, text}] */
    items: { type: [], default: [] },
    /** النسخ المترجمة — بنفس بنية items، وإن فارغتُ استُخدمت العربية */
    itemsFr: { type: [], default: [] },
    itemsEn: { type: [], default: [] },
    itemsTr: { type: [], default: [] },
    itemsEs: { type: [], default: [] },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
export const PageContent =
  (mongoose.models.PageContent as Model<InferSchemaType<typeof PageContentSchema>>) ||
  mongoose.model("PageContent", PageContentSchema);

/* ─────────────── طلبات استعادة كلمة المرور ─────────────── */
const ResetRequestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    phone: { type: String, required: true },
    status: { type: String, enum: ["pending", "done"], default: "pending", index: true },
  },
  { timestamps: true }
);
export const ResetRequest =
  (mongoose.models.ResetRequest as Model<InferSchemaType<typeof ResetRequestSchema>>) ||
  mongoose.model("ResetRequest", ResetRequestSchema);

/* ─────────────── الاقتراحات والبلاغات ─────────────── */
const FeedbackSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, default: "زائر" },
    type: { type: String, enum: ["suggestion", "report"], default: "suggestion" },
    message: { type: String, required: true },
    contact: { type: String, default: "" },
    status: { type: String, enum: ["new", "read", "resolved"], default: "new", index: true },
    reply: { type: String, default: "" },
  },
  { timestamps: true }
);
export type FeedbackDoc = InferSchemaType<typeof FeedbackSchema> & { _id: mongoose.Types.ObjectId };
export const Feedback: Model<FeedbackDoc> =
  (mongoose.models.Feedback as Model<FeedbackDoc>) || mongoose.model<FeedbackDoc>("Feedback", FeedbackSchema);

/* ─────────────── الإشعارات الداخلية (ثلاثية اللغة) ───────────────
 * titles/bodies = { ar, fr, en } — الواجهة تعرض حسب لغة المستخدم
 * title/body = النص العربي (توافق قديم + احتياط)
 */
const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    titles: {
      ar: { type: String, default: "" },
      fr: { type: String, default: "" },
      en: { type: String, default: "" },
      tr: { type: String, default: "" },
      es: { type: String, default: "" },
    },
    bodies: {
      ar: { type: String, default: "" },
      fr: { type: String, default: "" },
      en: { type: String, default: "" },
      tr: { type: String, default: "" },
      es: { type: String, default: "" },
    },
    kind: { type: String, default: "general" }, // reminder_day | reminder_hour | booking | status | general
    /* ★ وجهة الإشعار: الضغط عليه ينقل المستخدم للموضع المناسب (نمط طمأنينة)
       صيغة: "view" أو "view:id" — مثال: appointments / accounts / login:client */
    link: { type: String, default: "" },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);
export type NotificationDoc = InferSchemaType<typeof NotificationSchema> & { _id: mongoose.Types.ObjectId };
export const Notification: Model<NotificationDoc> =
  (mongoose.models.Notification as Model<NotificationDoc>) ||
  mongoose.model<NotificationDoc>("Notification", NotificationSchema);

/* ─────────────── تقييمات الأخصائيين ───────────────
 * العميل يقيّم الأخصائي بعد جلسة مكتملة (تقييم واحد لكل جلسة)
 * التقييم عام: يظهر متوسطه على بطاقات الأخصائيين
 */
const RatingSchema = new Schema(
  {
    specialistId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", default: null },
    stars: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 600 },
  },
  { timestamps: true }
);
RatingSchema.index({ specialistId: 1, clientId: 1, appointmentId: 1 }, { unique: true });
export type RatingDoc = InferSchemaType<typeof RatingSchema> & { _id: mongoose.Types.ObjectId };
export const Rating: Model<RatingDoc> =
  (mongoose.models.Rating as Model<RatingDoc>) || mongoose.model<RatingDoc>("Rating", RatingSchema);

/* ─────────────── الملفات الطبية والنفسية للمرضى ─────────────── */
const MedicalRecordSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    specialistId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    birthDate: { type: String, default: "" },
    gender: { type: String, enum: ["male", "female", ""], default: "" },
    address: { type: String, default: "" },
    guardianName: { type: String, default: "" },
    guardianPhone: { type: String, default: "" },
    medicalInfo: { type: String, default: "" },
    psychologicalInfo: { type: String, default: "" },
    symptoms: { type: String, default: "" },
    symptomsFr: { type: String, default: "" },
    symptomsEn: { type: String, default: "" },
    motive: { type: String, default: "" },
    motiveFr: { type: String, default: "" },
    motiveEn: { type: String, default: "" },
    diagnosis: { type: String, default: "" },
    diagnosisFr: { type: String, default: "" },
    diagnosisEn: { type: String, default: "" },
    diagnosisSystem: { type: String, enum: ["", "dsm5", "icd10"], default: "" },
    diagnosisCode: { type: String, default: "" },
    treatmentPlan: { type: String, default: "" },
    treatmentPlanFr: { type: String, default: "" },
    treatmentPlanEn: { type: String, default: "" },
    sessionNotes: [{ date: { type: String, default: "" }, text: { type: String, default: "" } }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
export type MedicalRecordDoc = InferSchemaType<typeof MedicalRecordSchema> & { _id: mongoose.Types.ObjectId };
export const MedicalRecord: Model<MedicalRecordDoc> =
  (mongoose.models.MedicalRecord as Model<MedicalRecordDoc>) ||
  mongoose.model<MedicalRecordDoc>("MedicalRecord", MedicalRecordSchema);

/* ─────────────── العبارات الترحيبية (لحظة اطمئنان — نمط طمأنينة) ───────────────
 * الإدارة تدير مكتبة العبارات بثلاث لغات من إعدادات المركز،
 * والزوار/المستخدمون ترى كل واحد منها بلغته عند ولوج الرئيسية.
 * تُبذر مرة واحدة من المكتبة المدمجة عندما يكون الجدول فارغاً.
 */
const WelcomeQuoteSchema = new Schema(
  {
    textAr: { type: String, required: true, trim: true, maxlength: 500 },
    textFr: { type: String, default: "", trim: true, maxlength: 500 },
    textEn: { type: String, default: "", trim: true, maxlength: 500 },
    /** ★ v3.10: تركي/إسباني — كل حقول الإعدادات بخمس لغات */
    textTr: { type: String, default: "", trim: true, maxlength: 500 },
    textEs: { type: String, default: "", trim: true, maxlength: 500 },
    author: { type: String, default: "", trim: true, maxlength: 120 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export type WelcomeQuoteDoc = InferSchemaType<typeof WelcomeQuoteSchema> & { _id: mongoose.Types.ObjectId };
export const WelcomeQuote: Model<WelcomeQuoteDoc> =
  (mongoose.models.WelcomeQuote as Model<WelcomeQuoteDoc>) ||
  mongoose.model<WelcomeQuoteDoc>("WelcomeQuote", WelcomeQuoteSchema);

/* ─────────────── سجل التدقيق (v3.8) ───────────────
 * توثيق كل عملية حساسة: من فعل ماذا ومتى ومن أي جهاز
 * يُكتب من logAudit() — ★ v3.10: يُحذف تلقائياً بعد 3 أيام (TTL index بطلب صاحب المركز)،
 * مع زر تفريغ فوري في واجهة سجل التدقيق — العرض للإدارة فقط
 */
const AuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    actorName: { type: String, default: "" },
    actorRole: { type: String, default: "" },
    action: { type: String, required: true, index: true }, // auth.login | appointment.status | ...
    target: { type: String, default: "" }, // وصف الهدف: "مستخدم: اسم" / "موعد: 2025-01-01 10:00"
    targetId: { type: String, default: "" },
    meta: { type: String, default: "" }, // تفاصيل إضافية نصية
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true, collection: "auditlogs" }
);
AuditLogSchema.index({ createdAt: -1 });
/* ★ v3.10 حذف تلقائي بعد 3 أيام — TTL index (MongoDB يفحص كل دقيقة) */
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 });
export const AuditLog =
  (mongoose.models.AuditLog as Model<InferSchemaType<typeof AuditLogSchema>>) ||
  mongoose.model("AuditLog", AuditLogSchema);

/* ─────────────── كوبونات الخصم (v3.8) ───────────────
 * الإدارة تنشئ كوبونات نسبة مئوية أو مبلغ ثابت مع سقف وتاريخ انتهاء
 * ويُطبّقها العميل عند الحجز فيخصم من سعر الجلسة
 */
const CouponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 24 },
    kind: { type: String, enum: ["percent", "fixed"], default: "percent" },
    value: { type: Number, required: true, min: 1 }, // نسبة % أو مبلغ بالدينار
    description: { type: String, default: "", maxlength: 300 },
    descriptionFr: { type: String, default: "", maxlength: 300 },
    descriptionEn: { type: String, default: "", maxlength: 300 },
    maxUses: { type: Number, default: 0, min: 0 }, // 0 = بلا حد
    usedCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, default: null },
    minPrice: { type: Number, default: 0, min: 0 }, // أدنى سعر جلسة لتطبيق الكوبون
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);
export type CouponDoc = InferSchemaType<typeof CouponSchema> & { _id: mongoose.Types.ObjectId };
export const Coupon: Model<CouponDoc> =
  (mongoose.models.Coupon as Model<CouponDoc>) || mongoose.model<CouponDoc>("Coupon", CouponSchema);

/* ─────────────── شهادات وقصص نجاح (v3.8) ───────────────
 * الإدارة تكتب/توافق على الشهادات — تُنشر بدون أسماء كاملة (الاسم الأول + الحرف الأول)
 * العرض عام في صفحة الشهادات، والكتابة والتحرير للإدارة فقط
 */
const TestimonialSchema = new Schema(
  {
    /** الاسم الحقيقي يبقى سرياً في الإدارة — المنشور يُحتسب تلقائياً بلا أسماء كاملة */
    authorReal: { type: String, default: "", maxlength: 120 },
    authorPublic: { type: String, default: "", maxlength: 40 }, // إن أرادت الإدارة صيغة خاصة مثل "أم ي.", وإلا يُحتسب
    text: { type: String, required: true, maxlength: 2000 },
    textFr: { type: String, default: "", maxlength: 2000 },
    textEn: { type: String, default: "", maxlength: 2000 },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    /** نوع القصة: شهادة قصيرة أو قصة نجاح مفصلة */
    kind: { type: String, enum: ["testimonial", "story"], default: "testimonial" },
    approved: { type: Boolean, default: false, index: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);
export type TestimonialDoc = InferSchemaType<typeof TestimonialSchema> & { _id: mongoose.Types.ObjectId };
export const Testimonial: Model<TestimonialDoc> =
  (mongoose.models.Testimonial as Model<TestimonialDoc>) ||
  mongoose.model<TestimonialDoc>("Testimonial", TestimonialSchema);

/* ─────────────── اشتراكات Web Push ─────────────── */
const PushSubSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  { timestamps: true }
);
export const PushSub =
  (mongoose.models.PushSub as Model<InferSchemaType<typeof PushSubSchema>>) ||
  mongoose.model("PushSub", PushSubSchema);

/**
 * تصدير البيانات Excel/CSV (v3.8.1) — للإدارة والمساعد
 * GET /api/export?type=appointments|clients|invoices&lang=ar|fr|en|tr|es
 * ★ v3.8.1:
 *  - أعمدة وقيم التصدير بلغة واجهة المستخدم المختارة (وليس العربية حصراً)
 *  - كل التواريخ بتوقيت الجزائر (GMT+1 — Africa/Algiers) بدل GMT+0
 * ★ CSV بترميز UTF-8 + BOM — يفتح مباشرة في Excel بأعمدة سليمة
 */
import { NextRequest, NextResponse } from "next/server";
import { fail, handle } from "@/lib/api-helpers";
import { Appointment, User } from "@/lib/models";
import { requireUser, isStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

type Lang = "ar" | "fr" | "en" | "tr" | "es";

/** قواميس أعمدة/قيم التصدير — الخمس لغات */
const DICT: Record<Lang, Record<string, string>> = {
  ar: {
    fullName: "الاسم الكامل", phone: "الهاتف", role: "الدور", status: "الحالة",
    createdAt: "تاريخ التسجيل", invoiceNumber: "رقم الفاتورة", apptDate: "تاريخ الجلسة",
    time: "التوقيت", client: "العميل", specialist: "الأخصائي", service: "الخدمة",
    price: "السعر", discount: "الخصم", total: "الصافي", payment: "الدفع",
    issuedAt: "تاريخ الإصدار", kind: "النوع", mode: "الطريقة", coupon: "الكوبون",
    notes: "ملاحظات", clientPhone: "هاتف العميل",
    active: "نشط", inactive: "معطل",
    paid: "مدفوع", unpaid: "غير مدفوع",
    psych: "نفسي", art: "علاج فني", remote: "عن بُعد", onsite: "حضورية",
    pending: "بانتظار التأكيد", confirmed: "مؤكد", completed: "منتهي", cancelled: "ملغى",
    none: "—",
  },
  fr: {
    fullName: "Nom complet", phone: "Téléphone", role: "Rôle", status: "Statut",
    createdAt: "Date d'inscription", invoiceNumber: "N° de facture", apptDate: "Date de séance",
    time: "Heure", client: "Client", specialist: "Spécialiste", service: "Service",
    price: "Prix", discount: "Remise", total: "Net", payment: "Paiement",
    issuedAt: "Date d'émission", kind: "Type", mode: "Mode", coupon: "Coupon",
    notes: "Notes", clientPhone: "Tél. client",
    active: "Actif", inactive: "Désactivé",
    paid: "Payé", unpaid: "Non payé",
    psych: "Psychologique", art: "Art-thérapie", remote: "À distance", onsite: "Présentiel",
    pending: "En attente", confirmed: "Confirmé", completed: "Terminé", cancelled: "Annulé",
    none: "—",
  },
  en: {
    fullName: "Full name", phone: "Phone", role: "Role", status: "Status",
    createdAt: "Registration date", invoiceNumber: "Invoice no.", apptDate: "Session date",
    time: "Time", client: "Client", specialist: "Specialist", service: "Service",
    price: "Price", discount: "Discount", total: "Net", payment: "Payment",
    issuedAt: "Issued at", kind: "Type", mode: "Mode", coupon: "Coupon",
    notes: "Notes", clientPhone: "Client phone",
    active: "Active", inactive: "Disabled",
    paid: "Paid", unpaid: "Unpaid",
    psych: "Psychological", art: "Art therapy", remote: "Remote", onsite: "In-person",
    pending: "Pending", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled",
    none: "—",
  },
  tr: {
    fullName: "Ad soyad", phone: "Telefon", role: "Rol", status: "Durum",
    createdAt: "Kayıt tarihi", invoiceNumber: "Fatura no", apptDate: "Seans tarihi",
    time: "Saat", client: "Danışan", specialist: "Uzman", service: "Hizmet",
    price: "Fiyat", discount: "İndirim", total: "Net", payment: "Ödeme",
    issuedAt: "Düzenleme tarihi", kind: "Tür", mode: "Yöntem", coupon: "Kupon",
    notes: "Notlar", clientPhone: "Danışan telefonu",
    active: "Aktif", inactive: "Devre dışı",
    paid: "Ödendi", unpaid: "Ödenmedi",
    psych: "Psikolojik", art: "Sanat terapisi", remote: "Uzaktan", onsite: "Yüz yüze",
    pending: "Onay bekliyor", confirmed: "Onaylandı", completed: "Tamamlandı", cancelled: "İptal",
    none: "—",
  },
  es: {
    fullName: "Nombre completo", phone: "Teléfono", role: "Rol", status: "Estado",
    createdAt: "Fecha de registro", invoiceNumber: "N.º de factura", apptDate: "Fecha de sesión",
    time: "Hora", client: "Cliente", specialist: "Especialista", service: "Servicio",
    price: "Precio", discount: "Descuento", total: "Neto", payment: "Pago",
    issuedAt: "Fecha de emisión", kind: "Tipo", mode: "Modalidad", coupon: "Cupón",
    notes: "Notas", clientPhone: "Tel. del cliente",
    active: "Activo", inactive: "Desactivado",
    paid: "Pagado", unpaid: "No pagado",
    psych: "Psicológica", art: "Arteterapia", remote: "A distancia", onsite: "Presencial",
    pending: "Pendiente", confirmed: "Confirmada", completed: "Finalizada", cancelled: "Cancelada",
    none: "—",
  },
};

const ROLES: Record<Lang, Record<string, string>> = {
  ar: { admin: "إدارة", assistant: "مساعد", specialist: "أخصائي", client: "عميل" },
  fr: { admin: "Administration", assistant: "Assistant", specialist: "Spécialiste", client: "Client" },
  en: { admin: "Admin", assistant: "Assistant", specialist: "Specialist", client: "Client" },
  tr: { admin: "İdare", assistant: "Asistan", specialist: "Uzman", client: "Danışan" },
  es: { admin: "Administración", assistant: "Asistente", specialist: "Especialista", client: "Cliente" },
};

function csvCell(v: unknown): string {
  const s = String(v ?? "").replace(/"/g, '""');
  return `"${s}"`;
}
function csv(rows: (string | number)[][]): string {
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** ★ التاريخ/الوقت بتوقيت الجزائر GMT+1 — صيغة واضحة مستقرة في Excel */
function algiersDateTime(d: unknown): string {
  const date = d instanceof Date ? d : new Date(String(d || ""));
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Algiers",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date).replace("T", " ");
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    if (!isStaff(me.role)) return fail(403, "لا تملك صلاحية لتصدير البيانات");
    const type = req.nextUrl.searchParams.get("type") || "appointments";
    const langParam = (req.nextUrl.searchParams.get("lang") || "ar").slice(0, 2);
    const lang: Lang = (["ar", "fr", "en", "tr", "es"].includes(langParam) ? langParam : "ar") as Lang;
    const t = DICT[lang];

    /* خط واحد في كل صف — بلا فواصل أسطر داخل الخلايا */
    const flat = (s: string) => (s || "").replace(/[\r\n]+/g, " ").trim();
    const payOf = (v: unknown) => (v === "paid" ? t.paid : t.unpaid);
    const statusOf = (v: unknown) => (t as Record<string, string>)[String(v)] || String(v ?? "");
    const modeOf = (v: unknown) => (v === "remote" ? t.remote : t.onsite);
    const kindOf = (v: unknown) => (v === "art_therapy" ? t.art : t.psych);

    if (type === "clients") {
      const users = await User.find({ role: { $in: ["client", "specialist", "assistant", "admin"] } })
        .sort({ createdAt: -1 })
        .lean<Record<string, unknown>[]>();
      const rows: (string | number)[][] = [
        [t.fullName, t.phone, t.role, t.status, t.createdAt],
      ];
      for (const u of users) {
        rows.push([
          flat(String(u.name || "")),
          flat(String(u.phone || "")),
          ROLES[lang][String(u.role || "client")] || String(u.role || ""),
          u.active === false ? t.inactive : t.active,
          algiersDateTime(u.createdAt),
        ]);
      }
      await logAudit({ _id: me._id, name: me.name, role: me.role }, "export.clients", lang === "ar" ? "الحسابات" : "Accounts", `${users.length}`);
      return new NextResponse(csv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="clients-${Date.now()}.csv"`,
        },
      });
    }

    if (type === "invoices") {
      const appts = await Appointment.find({ invoiceNumber: { $ne: "" } })
        .sort({ createdAt: -1 })
        .lean<Record<string, unknown>[]>();
      const clientIds = [...new Set(appts.map((a) => String(a.clientId)))];
      const specIds = [...new Set(appts.map((a) => String(a.specialistId)))];
      const users = await User.find({ _id: { $in: [...clientIds, ...specIds] } })
        .select("name")
        .lean<Record<string, unknown>[]>();
      const nameOf = new Map(users.map((u) => [String(u._id), String(u.name || "")]));
      const rows: (string | number)[][] = [
        [t.invoiceNumber, t.apptDate, t.time, t.client, t.specialist, t.service, t.price, t.discount, t.total, t.payment, t.issuedAt],
      ];
      for (const a of appts) {
        const price = Number(a.price || 0);
        const disc = Number(a.discount || 0);
        rows.push([
          flat(String(a.invoiceNumber || "")),
          flat(String(a.date || "")),
          flat(String(a.time || "")),
          flat(nameOf.get(String(a.clientId)) || t.none),
          flat(nameOf.get(String(a.specialistId)) || t.none),
          flat(String(a.serviceTitle || a.kind || "")),
          price,
          disc,
          Math.max(0, price - disc),
          payOf(a.paymentStatus),
          algiersDateTime(a.invoiceAt),
        ]);
      }
      await logAudit({ _id: me._id, name: me.name, role: me.role }, "export.invoices", lang === "ar" ? "الفواتير" : "Invoices", `${appts.length}`);
      return new NextResponse(csv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="invoices-${Date.now()}.csv"`,
        },
      });
    }

    /* افتراضي: الحجوزات */
    const appts = await Appointment.find({})
      .sort({ date: -1, time: -1 })
      .limit(5000)
      .lean<Record<string, unknown>[]>();
    const clientIds = [...new Set(appts.map((a) => String(a.clientId)))];
    const specIds = [...new Set(appts.map((a) => String(a.specialistId)))];
    const users = await User.find({ _id: { $in: [...clientIds, ...specIds] } })
      .select("name phone")
      .lean<Record<string, unknown>[]>();
    const nameOf = new Map(users.map((u) => [String(u._id), String(u.name || "")]));
    const phoneOf = new Map(users.map((u) => [String(u._id), String(u.phone || "")]));
    const rows: (string | number)[][] = [
      [t.apptDate, t.time, t.client, t.clientPhone, t.specialist, t.service, t.kind, t.mode, t.status, t.price, t.discount, t.total, t.payment, t.coupon, t.notes],
    ];
    for (const a of appts) {
      const price = Number(a.price || 0);
      const disc = Number(a.discount || 0);
      rows.push([
        flat(String(a.date || "")),
        flat(String(a.time || "")),
        flat(nameOf.get(String(a.clientId)) || t.none),
        flat(phoneOf.get(String(a.clientId)) || ""),
        flat(nameOf.get(String(a.specialistId)) || t.none),
        flat(String(a.serviceTitle || "")),
        kindOf(a.kind),
        modeOf(a.mode),
        statusOf(a.status),
        price,
        disc,
        Math.max(0, price - disc),
        payOf(a.paymentStatus),
        flat(String(a.couponCode || "")),
        flat(String(a.notes || "")),
      ]);
    }
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "export.appointments", lang === "ar" ? "الحجوزات" : "Appointments", `${appts.length}`);
    return new NextResponse(csv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="appointments-${Date.now()}.csv"`,
      },
    });
  });
}

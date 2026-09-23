/**
 * مركز أيت تقرين — نصوص الإشعارات خماسية اللغة (عربي / فرنسي / إنجليزي / تركي / إسباني)
 * كل إشعار يُبنى بخمس لغات فيصله للمستخدم بلغته المختارة
 * (الواجهة تختار titles[lang]، وService Worker يختار من نفس الخريطة)
 * v3.7: إضافة التركية والإسبانية لكل الإشعارات
 */

export type TriText = {
  ar: string;
  fr: string;
  en: string;
  tr: string;
  es: string;
};

export type TriNotification = {
  titles: TriText;
  bodies: TriText;
};

/** تنسيق التاريخ والوقت حسب اللغة */
function fmtDate(date: string, lang: "ar" | "fr" | "en" | "tr" | "es"): string {
  try {
    const d = new Date(`${date}T00:00:00`);
    const locale =
      lang === "ar" ? "ar-DZ" : lang === "fr" ? "fr-FR" : lang === "tr" ? "tr-TR" : lang === "es" ? "es-ES" : "en-GB";
    return d.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

/** الغد بصيغة التاريخ الخام */
function tomorrowDate(tomorrowStr: string, lang: "ar" | "fr" | "en" | "tr" | "es"): string {
  return fmtDate(tomorrowStr, lang);
}

/* ─────────── تذكير بموعد الغد ─────────── */
export function reminderDayText(opts: {
  tomorrowStr: string;
  time: string;
  serviceTitle?: string;
  forClient: boolean;
  otherName?: string; // اسم الأخصائي (للعميل) أو اسم العميل (للأخصائي)
}): TriNotification {
  const { tomorrowStr, time, serviceTitle, forClient, otherName } = opts;
  if (forClient) {
    const svc = serviceTitle || "";
    return {
      titles: {
        ar: "تذكير بموعد الغد",
        fr: "Rappel de votre rendez-vous de demain",
        en: "Tomorrow's appointment reminder",
        tr: "Yarınki randevu hatırlatması",
        es: "Recordatorio de su cita de mañana",
      },
      bodies: {
        ar: `لديك موعد${svc ? ` «${svc}»` : ""} غداً ${tomorrowDate(tomorrowStr, "ar")} على الساعة ${time}${otherName ? ` مع ${otherName}` : ""}.`,
        fr: `Vous avez un rendez-vous${svc ? ` « ${svc} »` : ""} demain ${tomorrowDate(tomorrowStr, "fr")} à ${time}${otherName ? ` avec ${otherName}` : ""}.`,
        en: `You have an appointment${svc ? ` "${svc}"` : ""} tomorrow, ${tomorrowDate(tomorrowStr, "en")} at ${time}${otherName ? ` with ${otherName}` : ""}.`,
        tr: `Yarın ${tomorrowDate(tomorrowStr, "tr")} saat ${time}${svc ? ` «${svc}»` : ""} randevunuz bulunmaktadır${otherName ? ` — ${otherName} ile` : ""}.`,
        es: `Tiene una cita${svc ? ` «${svc}»` : ""} mañana ${tomorrowDate(tomorrowStr, "es")} a las ${time}${otherName ? ` con ${otherName}` : ""}.`,
      },
    };
  }
  return {
    titles: {
      ar: "تذكير بجلسة الغد",
      fr: "Rappel de la séance de demain",
      en: "Tomorrow's session reminder",
      tr: "Yarınki seans hatırlatması",
      es: "Recordatorio de la sesión de mañana",
    },
    bodies: {
      ar: `لديك جلسة غداً ${tomorrowDate(tomorrowStr, "ar")} على الساعة ${time}${otherName ? ` مع العميل ${otherName}` : ""}.`,
      fr: `Vous avez une séance demain ${tomorrowDate(tomorrowStr, "fr")} à ${time}${otherName ? ` avec le client ${otherName}` : ""}.`,
      en: `You have a session tomorrow, ${tomorrowDate(tomorrowStr, "en")} at ${time}${otherName ? ` with client ${otherName}` : ""}.`,
      tr: `Yarın ${tomorrowDate(tomorrowStr, "tr")} saat ${time} bir seansınız bulunmaktadır${otherName ? ` — danışan ${otherName} ile` : ""}.`,
      es: `Tiene una sesión mañana ${tomorrowDate(tomorrowStr, "es")} a las ${time}${otherName ? ` con el cliente ${otherName}` : ""}.`,
    },
  };
}

/* ─────────── تذكير قبل ساعة ─────────── */
export function reminderHourText(opts: {
  time: string;
  serviceTitle?: string;
  forClient: boolean;
  otherName?: string;
}): TriNotification {
  const { time, serviceTitle, forClient, otherName } = opts;
  if (forClient) {
    const svc = serviceTitle || "";
    return {
      titles: {
        ar: "موعدك بعد قليل",
        fr: "Votre rendez-vous approche",
        en: "Your appointment is coming up",
        tr: "Randevunuz yaklaşıyor",
        es: "Su cita se acerca",
      },
      bodies: {
        ar: `موعدك${svc ? ` «${svc}»` : ""} على الساعة ${time} — بعد أقل من ساعة.`,
        fr: `Votre rendez-vous${svc ? ` « ${svc} »` : ""} à ${time} — dans moins d'une heure.`,
        en: `Your appointment${svc ? ` "${svc}"` : ""} at ${time} — in less than an hour.`,
        tr: `Saat ${time}${svc ? ` «${svc}»` : ""} randevunuz — bir saatten az kaldı.`,
        es: `Su cita${svc ? ` «${svc}»` : ""} a las ${time} — en menos de una hora.`,
      },
    };
  }
  return {
    titles: {
      ar: "جلسة بعد قليل",
      fr: "Séance dans peu de temps",
      en: "Session coming up",
      tr: "Seans yaklaşıyor",
      es: "Sesión a punto de comenzar",
    },
    bodies: {
      ar: `جلسة على الساعة ${time}${otherName ? ` مع العميل ${otherName}` : ""} — بعد أقل من ساعة.`,
      fr: `Séance à ${time}${otherName ? ` avec le client ${otherName}` : ""} — dans moins d'une heure.`,
      en: `Session at ${time}${otherName ? ` with client ${otherName}` : ""} — in less than an hour.`,
      tr: `Saat ${time} seans${otherName ? ` — danışan ${otherName} ile` : ""} — bir saatten az kaldı.`,
      es: `Sesión a las ${time}${otherName ? ` con el cliente ${otherName}` : ""} — en menos de una hora.`,
    },
  };
}

/* ─────────── حجز جديد ─────────── */
export function bookingCreatedText(opts: {
  date: string;
  time: string;
  serviceTitle?: string;
  viewer: "client" | "specialist" | "staff";
  otherName?: string;
  clientName?: string;
}): TriNotification {
  const { date, time, serviceTitle, viewer, otherName, clientName } = opts;
  if (viewer === "client") {
    return {
      titles: {
        ar: "تم تسجيل حجزك",
        fr: "Votre réservation est enregistrée",
        en: "Your booking is registered",
        tr: "Rezervasyonunuz kaydedildi",
        es: "Su reserva quedó registrada",
      },
      bodies: {
        ar: `موعدك يوم ${fmtDate(date, "ar")} على الساعة ${time}${otherName ? ` مع ${otherName}` : ""} — بانتظار التأكيد.`,
        fr: `Votre rendez-vous le ${fmtDate(date, "fr")} à ${time}${otherName ? ` avec ${otherName}` : ""} — en attente de confirmation.`,
        en: `Your appointment on ${fmtDate(date, "en")} at ${time}${otherName ? ` with ${otherName}` : ""} — awaiting confirmation.`,
        tr: `${fmtDate(date, "tr")} saat ${time} randevunuz${otherName ? ` — ${otherName} ile` : ""} — onay bekleniyor.`,
        es: `Su cita del ${fmtDate(date, "es")} a las ${time}${otherName ? ` con ${otherName}` : ""} — pendiente de confirmación.`,
      },
    };
  }
  if (viewer === "specialist") {
    return {
      titles: {
        ar: "موعد جديد",
        fr: "Nouveau rendez-vous",
        en: "New appointment",
        tr: "Yeni randevu",
        es: "Nueva cita",
      },
      bodies: {
        ar: `حجز جديد يوم ${fmtDate(date, "ar")} على الساعة ${time}${clientName ? ` للعميل ${clientName}` : ""}.`,
        fr: `Nouvelle réservation le ${fmtDate(date, "fr")} à ${time}${clientName ? ` pour le client ${clientName}` : ""}.`,
        en: `New booking on ${fmtDate(date, "en")} at ${time}${clientName ? ` for client ${clientName}` : ""}.`,
        tr: `${fmtDate(date, "tr")} saat ${time} yeni bir rezervasyon${clientName ? ` — danışan: ${clientName}` : ""}.`,
        es: `Nueva reserva el ${fmtDate(date, "es")} a las ${time}${clientName ? ` para el cliente ${clientName}` : ""}.`,
      },
    };
  }
  /* الإدارة: ملخص إداري — ليست رسالة موجهة للأخصائي */
  return {
    titles: {
      ar: "حجز جديد في المركز",
      fr: "Nouvelle réservation au centre",
      en: "New booking at the center",
      tr: "Merkezde yeni rezervasyon",
      es: "Nueva reserva en el centro",
    },
    bodies: {
      ar: `حجز جديد بتاريخ ${fmtDate(date, "ar")} على الساعة ${time}${otherName ? ` مع ${otherName}` : ""}${clientName ? ` — العميل: ${clientName}` : ""}.`,
      fr: `Nouvelle réservation le ${fmtDate(date, "fr")} à ${time}${otherName ? ` avec ${otherName}` : ""}${clientName ? ` — client : ${clientName}` : ""}.`,
      en: `New booking on ${fmtDate(date, "en")} at ${time}${otherName ? ` with ${otherName}` : ""}${clientName ? ` — client: ${clientName}` : ""}.`,
      tr: `${fmtDate(date, "tr")} saat ${time} yeni rezervasyon${otherName ? ` — ${otherName} ile` : ""}${clientName ? ` — danışan: ${clientName}` : ""}.`,
      es: `Nueva reserva el ${fmtDate(date, "es")} a las ${time}${otherName ? ` con ${otherName}` : ""}${clientName ? ` — cliente: ${clientName}` : ""}.`,
    },
  };
}

/* ─────────── تغيير حالة الموعد ─────────── */
export function statusChangedText(opts: {
  status: "pending" | "confirmed" | "completed" | "cancelled";
  date: string;
  time: string;
  toClient: boolean;
  actorIsClient?: boolean;
}): TriNotification {
  const { status, date, time, toClient } = opts;
  const d = {
    ar: fmtDate(date, "ar"),
    fr: fmtDate(date, "fr"),
    en: fmtDate(date, "en"),
    tr: fmtDate(date, "tr"),
    es: fmtDate(date, "es"),
  };
  if (toClient) {
    switch (status) {
      case "confirmed":
        return {
          titles: {
            ar: "تم تأكيد موعدك",
            fr: "Votre rendez-vous est confirmé",
            en: "Your appointment is confirmed",
            tr: "Randevunuz onaylandı",
            es: "Su cita fue confirmada",
          },
          bodies: {
            ar: `تم تأكيد موعدك يوم ${d.ar} على الساعة ${time}.`,
            fr: `Votre rendez-vous du ${d.fr} à ${time} a été confirmé.`,
            en: `Your appointment on ${d.en} at ${time} has been confirmed.`,
            tr: `${d.tr} saat ${time} randevunuz onaylandı.`,
            es: `Su cita del ${d.es} a las ${time} fue confirmada.`,
          },
        };
      case "completed":
        return {
          titles: {
            ar: "انتهت جلستك",
            fr: "Votre séance est terminée",
            en: "Your session is completed",
            tr: "Seansınız tamamlandı",
            es: "Su sesión finalizó",
          },
          bodies: {
            ar: `انتهت جلستك يوم ${d.ar} على الساعة ${time}. نتمنى لك دوام الصحة.`,
            fr: `Votre séance du ${d.fr} à ${time} est terminée. Portez-vous bien.`,
            en: `Your session on ${d.en} at ${time} is completed. Take care.`,
            tr: `${d.tr} saat ${time} seansınız tamamlandı. Sağlıklı günler dileriz.`,
            es: `Su sesión del ${d.es} a las ${time} finalizó. Le deseamos buena salud.`,
          },
        };
      case "cancelled":
        return {
          titles: {
            ar: "أُلغي موعدك",
            fr: "Votre rendez-vous a été annulé",
            en: "Your appointment was cancelled",
            tr: "Randevunuz iptal edildi",
            es: "Su cita fue cancelada",
          },
          bodies: {
            ar: `أُلغي موعدك يوم ${d.ar} على الساعة ${time}. يمكنك حجز موعد آخر في أي وقت.`,
            fr: `Votre rendez-vous du ${d.fr} à ${time} a été annulé. Vous pouvez réserver un autre moment à tout instant.`,
            en: `Your appointment on ${d.en} at ${time} was cancelled. You can book another one anytime.`,
            tr: `${d.tr} saat ${time} randevunuz iptal edildi. Dilediğiniz zaman yeni bir randevu alabilirsiniz.`,
            es: `Su cita del ${d.es} a las ${time} fue cancelada. Puede reservar otra en cualquier momento.`,
          },
        };
      default:
        return {
          titles: {
            ar: "تحديث على موعدك",
            fr: "Mise à jour de votre rendez-vous",
            en: "Appointment update",
            tr: "Randevunuz güncellendi",
            es: "Actualización de su cita",
          },
          bodies: {
            ar: `موعدك يوم ${d.ar} على الساعة ${time} بانتظار التأكيد.`,
            fr: `Votre rendez-vous du ${d.fr} à ${time} est en attente de confirmation.`,
            en: `Your appointment on ${d.en} at ${time} is awaiting confirmation.`,
            tr: `${d.tr} saat ${time} randevunuz onay beklemektedir.`,
            es: `Su cita del ${d.es} a las ${time} está pendiente de confirmación.`,
          },
        };
    }
  }
  /* إشعار للأخصائي أو للإدارة */
  if (status === "cancelled") {
    return {
      titles: {
        ar: "أُلغي موعد",
        fr: "Rendez-vous annulé",
        en: "Appointment cancelled",
        tr: "Randevu iptal edildi",
        es: "Cita cancelada",
      },
      bodies: {
        ar: `أُلغي موعد يوم ${d.ar} على الساعة ${time}.`,
        fr: `Le rendez-vous du ${d.fr} à ${time} a été annulé.`,
        en: `The appointment on ${d.en} at ${time} was cancelled.`,
        tr: `${d.tr} saat ${time} randevu iptal edildi.`,
        es: `La cita del ${d.es} a las ${time} fue cancelada.`,
      },
    };
  }
  return {
    titles: {
      ar: "تحديث على موعد",
      fr: "Mise à jour d'un rendez-vous",
      en: "Appointment update",
      tr: "Randevu güncellendi",
      es: "Actualización de una cita",
    },
    bodies: {
      ar: `تحديث على الموعد يوم ${d.ar} على الساعة ${time} — الحالة: ${status === "confirmed" ? "مؤكد" : status === "completed" ? "منتهٍ" : "بانتظار التأكيد"}.`,
      fr: `Mise à jour du rendez-vous du ${d.fr} à ${time} — statut : ${status === "confirmed" ? "confirmé" : status === "completed" ? "terminé" : "en attente"}.`,
      en: `Update for the appointment on ${d.en} at ${time} — status: ${status === "confirmed" ? "confirmed" : status === "completed" ? "completed" : "pending"}.`,
      tr: `${d.tr} saat ${time} randevu güncellemesi — durum: ${status === "confirmed" ? "onaylandı" : status === "completed" ? "tamamlandı" : "onay bekliyor"}.`,
      es: `Actualización de la cita del ${d.es} a las ${time} — estado: ${status === "confirmed" ? "confirmada" : status === "completed" ? "finalizada" : "pendiente"}.`,
    },
  };
}

/* ─────────── إشعار عام ─────────── */
export function generalText(ar: string, fr: string, en: string, tr = "", es = ""): TriNotification {
  return {
    titles: { ar, fr, en, tr, es },
    bodies: { ar: "", fr: "", en: "", tr: "", es: "" },
  };
}

/* ─────────── الترحيب بعميل جديد (للعميل نفسه) ─────────── */
export function welcomeText(opts: { name: string }): TriNotification {
  const { name } = opts;
  return {
    titles: {
      ar: "مرحباً بك في مركز آيت تقرين",
      fr: "Bienvenue au centre Ait-Tegrine",
      en: "Welcome to Ait-Tegrine Center",
      tr: "Ait Tegrine Merkezi'ne hoş geldiniz",
      es: "Bienvenido al Centro Ait Tegrine",
    },
    bodies: {
      ar: `أهلاً ${name}! تم إنشاء حسابك بنجاح. احجز جلستك الأولى الآن وابدأ طريقك نحو راحة البال. احتفظ بعبارة الاسترجاع — تحتاجها لاستعادة حسابك.`,
      fr: `Bonjour ${name} ! Votre compte a été créé avec succès. Réservez votre première séance et commencez votre chemin vers la sérénité. Conservez votre phrase de récupération — elle vous servira à retrouver votre compte.`,
      en: `Hello ${name}! Your account has been created successfully. Book your first session and start your journey to peace of mind. Keep your recovery phrase — you will need it to recover your account.`,
      tr: `Merhaba ${name}! Hesabınız başarıyla oluşturuldu. İlk seansınızı alın ve iç huzura giden yolculuğunuza başlayın. Kurtarma ifadenizi saklayın — hesabınızı kurtarmak için gerekecek.`,
      es: `¡Hola ${name}! Su cuenta se creó correctamente. Reserve su primera sesión y comience su camino hacia la tranquilidad. Conserve su frase de recuperación — la necesitará para recuperar su cuenta.`,
    },
  };
}

/* ─────────── انضمام عميل جديد (للإدارة) ─────────── */
export function newClientText(opts: { name: string; phone: string }): TriNotification {
  const { name, phone } = opts;
  return {
    titles: {
      ar: "عميل جديد انضم للمركز",
      fr: "Nouveau client au centre",
      en: "New client joined the center",
      tr: "Merkeze yeni danışan katıldı",
      es: "Nuevo cliente en el centro",
    },
    bodies: {
      ar: `الاسم: ${name} — الهاتف: ${phone}. تم إنشاء الحساب ذاتياً بوابة العميل.`,
      fr: `Nom : ${name} — Téléphone : ${phone}. Le compte a été créé via le portail client.`,
      en: `Name: ${name} — Phone: ${phone}. The account was self-registered via the client portal.`,
      tr: `Ad: ${name} — Telefon: ${phone}. Hesap, danışan portalı üzerinden kendi kendine oluşturuldu.`,
      es: `Nombre: ${name} — Teléfono: ${phone}. La cuenta se registró automáticamente a través del portal del cliente.`,
    },
  };
}

/* ─────────── طلب استعادة كلمة مرور (للإدارة — كل التفاصيل) ─────────── */
export function resetRequestedText(opts: {
  name: string;
  phone: string;
  role: string;
}): TriNotification {
  const { name, phone, role } = opts;
  const roleAr =
    role === "specialist" ? "أخصائي" : role === "assistant" ? "مساعد" : role === "admin" ? "إدارة" : "عميل";
  const roleFr =
    role === "specialist" ? "spécialiste" : role === "assistant" ? "assistant" : role === "admin" ? "administration" : "client";
  const roleEn =
    role === "specialist" ? "specialist" : role === "assistant" ? "assistant" : role === "admin" ? "admin" : "client";
  const roleTr =
    role === "specialist" ? "uzman" : role === "assistant" ? "asistan" : role === "admin" ? "yönetim" : "danışan";
  const roleEs =
    role === "specialist" ? "especialista" : role === "assistant" ? "asistente" : role === "admin" ? "administración" : "cliente";
  return {
    titles: {
      ar: "طلب استعادة كلمة مرور",
      fr: "Demande de récupération de mot de passe",
      en: "Password recovery request",
      tr: "Şifre kurtarma talebi",
      es: "Solicitud de recuperación de contraseña",
    },
    bodies: {
      ar: `طلب من ${name} (${roleAr}) — الهاتف: ${phone} — استعادة حسابه. عالِج الطلب من صفحة «الحسابات» لتعيين كلمة مرور مؤقتة وإبلاغه.`,
      fr: `${name} (${roleFr}) — tél. : ${phone} — a demandé à récupérer son compte. Traitez la demande depuis « Comptes » pour définir un mot de passe temporaire.`,
      en: `${name} (${roleEn}) — phone: ${phone} — requested account recovery. Handle it from "Accounts" to set a temporary password and notify them.`,
      tr: `${name} (${roleTr}) — telefon: ${phone} — hesabını kurtarma talebinde bulundu. Geçici şifre belirlemek için talebi «Hesaplar» sayfasından işleyin ve kendisine bildirin.`,
      es: `${name} (${roleEs}) — teléfono: ${phone} — solicitó la recuperación de su cuenta. Procese la solicitud desde «Cuentas» para asignar una contraseña temporal y notificarle.`,
    },
  };
}

/* ─────────── استرجاع ذاتي ناجح (للإدارة — شفافية) ─────────── */
export function recoveryDoneText(opts: {
  name: string;
  phone: string;
  role: string;
}): TriNotification {
  const { name, phone, role } = opts;
  const roleAr =
    role === "specialist" ? "أخصائي" : role === "assistant" ? "مساعد" : role === "admin" ? "إدارة" : "عميل";
  const roleFr =
    role === "specialist" ? "spécialiste" : role === "assistant" ? "assistant" : role === "admin" ? "administration" : "client";
  const roleEn =
    role === "specialist" ? "specialist" : role === "assistant" ? "assistant" : role === "admin" ? "admin" : "client";
  const roleTr =
    role === "specialist" ? "uzman" : role === "assistant" ? "asistan" : role === "admin" ? "yönetim" : "danışan";
  const roleEs =
    role === "specialist" ? "especialista" : role === "assistant" ? "asistente" : role === "admin" ? "administración" : "cliente";
  return {
    titles: {
      ar: "استرجاع حساب بعبارة الاسترجاع",
      fr: "Compte récupéré via la phrase de récupération",
      en: "Account recovered via recovery phrase",
      tr: "Hesap, kurtarma ifadesiyle kurtarıldı",
      es: "Cuenta recuperada mediante la frase de recuperación",
    },
    bodies: {
      ar: `استعاد ${name} (${roleAr}) — الهاتف: ${phone} — حسابه بنفسه بعبارة الاسترجاع وأعاد تعيين كلمة المرور فوراً.`,
      fr: `${name} (${roleFr}) — tél. : ${phone} — a récupéré son compte lui-même avec sa phrase et a réinitialisé son mot de passe.`,
      en: `${name} (${roleEn}) — phone: ${phone} — recovered their account with their recovery phrase and reset the password.`,
      tr: `${name} (${roleTr}) — telefon: ${phone} — hesabını kurtarma ifadesiyle kendisi kurtardı ve şifresini hemen yeniledi.`,
      es: `${name} (${roleEs}) — teléfono: ${phone} — recuperó su cuenta con su frase de recuperación y restableció la contraseña de inmediato.`,
    },
  };
}

/* ─────────── اقتراح/بلاغ جديد (للإدارة) ─────────── */
export function feedbackText(opts: {
  kind: "suggestion" | "report";
  name: string;
  contact: string;
  message: string;
}): TriNotification {
  const { kind, name, contact, message } = opts;
  const short = message.length > 140 ? `${message.slice(0, 140)}…` : message;
  return {
    titles: {
      ar: kind === "report" ? "بلاغ جديد يحتاج مراجعة" : "اقتراح جديد من الزوار",
      fr: kind === "report" ? "Nouveau signalement à examiner" : "Nouvelle suggestion",
      en: kind === "report" ? "New report to review" : "New suggestion",
      tr: kind === "report" ? "İncellenmesi gereken yeni şikâyet" : "Ziyaretçiden yeni öneri",
      es: kind === "report" ? "Nueva queja por revisar" : "Nueva sugerencia de los visitantes",
    },
    bodies: {
      ar: `من ${name}${contact ? ` — للتواصل: ${contact}` : ""}: «${short}»`,
      fr: `De ${name}${contact ? ` — contact : ${contact}` : ""} : « ${short} »`,
      en: `From ${name}${contact ? ` — contact: ${contact}` : ""}: "${short}"`,
      tr: `${name}${contact ? ` — iletişim: ${contact}` : ""}: «${short}»`,
      es: `De ${name}${contact ? ` — contacto: ${contact}` : ""}: «${short}»`,
    },
  };
}

/* ─────────── تسجيل في تكوين (للإدارة) ─────────── */
export function enrollRequestText(opts: {
  clientName: string;
  clientPhone: string;
  courseTitle: string;
}): TriNotification {
  const { clientName, clientPhone, courseTitle } = opts;
  return {
    titles: {
      ar: "طلب تسجيل في تكوين",
      fr: "Demande d'inscription à une formation",
      en: "Course enrollment request",
      tr: "Eğitime kayıt talebi",
      es: "Solicitud de inscripción en una formación",
    },
    bodies: {
      ar: `العميل ${clientName} (${clientPhone}) يطلب التسجيل في تكوين «${courseTitle}». تواصل معه للتأكيد من صفحة التكوينات.`,
      fr: `Le client ${clientName} (${clientPhone}) demande à s'inscrire à la formation « ${courseTitle} ». Contactez-le pour confirmer.`,
      en: `Client ${clientName} (${clientPhone}) requests enrollment in "${courseTitle}". Contact them to confirm.`,
      tr: `Danışan ${clientName} (${clientPhone}), «${courseTitle}» eğitimine kayıt talep ediyor. Onaylamak için kendisiyle iletişime geçin.`,
      es: `El cliente ${clientName} (${clientPhone}) solicita inscribirse en la formación «${courseTitle}». Contacte con él para confirmar.`,
    },
  };
}

/* ─────────── إجابات كتاب محدَّثة (للأخصائي المعالج) ─────────── */
export function ebookAnswersText(opts: {
  clientName: string;
  bookTitle: string;
}): TriNotification {
  const { clientName, bookTitle } = opts;
  return {
    titles: {
      ar: "إجابات كتاب محدَّثة",
      fr: "Réponses de livre mises à jour",
      en: "Workbook answers updated",
      tr: "E-kitap cevapları güncellendi",
      es: "Respuestas del libro actualizadas",
    },
    bodies: {
      ar: `حدّث العميل ${clientName} إجاباته في كتاب «${bookTitle}» — راجعها من صفحة الكتب الإلكترونية.`,
      fr: `Le client ${clientName} a mis à jour ses réponses dans « ${bookTitle} » — consultez-les depuis les livres électroniques.`,
      en: `Client ${clientName} updated their answers in "${bookTitle}" — review them from E-books.`,
      tr: `Danışan ${clientName}, «${bookTitle}» kitabındaki cevaplarını güncelledi — E-Kitaplar sayfasından inceleyin.`,
      es: `El cliente ${clientName} actualizó sus respuestas en «${bookTitle}» — revíselas desde los Libros electrónicos.`,
    },
  };
}

/* ─────────── تفاعل مع إعلان (للإدارة) ─────────── */
export function adInteractionText(opts: {
  kind: "like" | "comment";
  name: string;
  adTitle: string;
  text?: string;
}): TriNotification {
  const { kind, name, adTitle, text } = opts;
  const short = text && text.length > 120 ? `${text.slice(0, 120)}…` : text || "";
  if (kind === "like") {
    return {
      titles: {
        ar: "إعجاب جديد بإعلان المركز",
        fr: "Nouveau j'aime sur une annonce",
        en: "New like on a center ad",
        tr: "Merkez duyurusuna yeni beğeni",
        es: "Nuevo me gusta en un anuncio del centro",
      },
      bodies: {
        ar: `أُعجب ${name} بإعلان «${adTitle}».`,
        fr: `${name} a aimé l'annonce « ${adTitle} ».`,
        en: `${name} liked the ad "${adTitle}".`,
        tr: `${name}, «${adTitle}» duyurusunu beğendi.`,
        es: `A ${name} le gustó el anuncio «${adTitle}».`,
      },
    };
  }
  return {
    titles: {
      ar: "تعليق جديد على إعلان المركز",
      fr: "Nouveau commentaire sur une annonce",
      en: "New comment on a center ad",
      tr: "Merkez duyurusuna yeni yorum",
      es: "Nuevo comentario en un anuncio del centro",
    },
    bodies: {
      ar: `علّق ${name} على «${adTitle}»: «${short}» — يمكنك الرد أو الحجب من صفحة الإعلانات.`,
      fr: `${name} a commenté « ${adTitle} » : « ${short} » — répondez ou masquez depuis la page des annonces.`,
      en: `${name} commented on "${adTitle}": "${short}" — reply or hide it from the Ads page.`,
      tr: `${name}, «${adTitle}» duyurusuna yorum yaptı: «${short}» — Duyurular sayfasından yanıtlayabilir veya gizleyebilirsiniz.`,
      es: `${name} comentó en «${adTitle}»: «${short}» — puede responder u ocultarlo desde la página de Anuncios.`,
    },
  };
}

/* ─────────── معالجة طلب الاستعادة (لصاحب الطلب) ─────────── */
export function resetHandledText(opts: { tempPassword?: string }): TriNotification {
  const { tempPassword } = opts;
  return {
    titles: {
      ar: "تمت معالجة طلب استعادة حسابك",
      fr: "Votre demande de récupération a été traitée",
      en: "Your recovery request has been processed",
      tr: "Hesap kurtarma talebiniz işlendi",
      es: "Su solicitud de recuperación fue procesada",
    },
    bodies: {
      ar: `عيّنت الإدارة كلمة مرور مؤقتة لحسابك${tempPassword ? `: ${tempPassword}` : ""} — سجّل الدخول بها وغيّرها من ملفك الشخصي فوراً.`,
      fr: `L'administration a défini un mot de passe temporaire${tempPassword ? ` : ${tempPassword}` : ""} — connectez-vous puis changez-le depuis votre profil.`,
      en: `The administration set a temporary password${tempPassword ? `: ${tempPassword}` : ""} — log in with it and change it from your profile right away.`,
      tr: `Yönetim hesabınız için geçici bir şifre belirledi${tempPassword ? `: ${tempPassword}` : ""} — bununla giriş yapın ve profilinizden hemen değiştirin.`,
      es: `La administración asignó una contraseña temporal a su cuenta${tempPassword ? `: ${tempPassword}` : ""} — inicie sesión con ella y cámbiela desde su perfil de inmediato.`,
    },
  };
}

/* ─────────── نشر مقال جديد (v3.6.0) ───────────
 * staff: أخصائي نشر مقالاً → إشعار فريق الإدارة
 * audience: إدارة نشرت مقالاً → إشعار العملاء والأخصائيين
 * العنوان يُعرض بلغة القارئ إن توفرت، وإلا سقط إلى العربية */
export function articlePublishedText(opts: {
  title: string;
  titleFr?: string;
  titleEn?: string;
  titleTr?: string;
  titleEs?: string;
  authorName: string;
  viewer: "staff" | "audience";
}): TriNotification {
  const { title, titleFr, titleEn, titleTr, titleEs, authorName, viewer } = opts;
  const t = {
    ar: title,
    fr: titleFr || title,
    en: titleEn || title,
    tr: titleTr || titleEn || title,
    es: titleEs || titleEn || title,
  };
  if (viewer === "staff") {
    return {
      titles: {
        ar: "مقال جديد من أخصائي المركز",
        fr: "Nouvel article d'un spécialiste du centre",
        en: "New article from a center specialist",
        tr: "Merkez uzmanından yeni makale",
        es: "Nuevo artículo de un especialista del centro",
      },
      bodies: {
        ar: `نشر الأخصائي ${authorName} مقالاً جديداً بعنوان «${t.ar}» — يمكن الاطلاع عليه من صفحة المقالات.`,
        fr: `Le spécialiste ${authorName} a publié un nouvel article intitulé « ${t.fr} » — consultez la page Articles.`,
        en: `Specialist ${authorName} published a new article titled "${t.en}" — see the Articles page.`,
        tr: `Uzman ${authorName}, «${t.tr}» başlıklı yeni bir makale yayınladı — Makaleler sayfasından okuyabilirsiniz.`,
        es: `El especialista ${authorName} publicó un nuevo artículo titulado «${t.es}» — consúltelo en la página de Artículos.`,
      },
    };
  }
  return {
    titles: {
      ar: "مقال جديد في مركز آيت تقرين",
      fr: "Nouvel article au centre Aït Tegrine",
      en: "New article at Aït Tegrine Center",
      tr: "Ait Tegrine Merkezi'nde yeni makale",
      es: "Nuevo artículo en el Centro Ait Tegrine",
    },
    bodies: {
      ar: `نُشر مقال جديد بعنوان «${t.ar}» في صفحة المقالات — قراءة سعيدة.`,
      fr: `Un nouvel article intitulé « ${t.fr} » a été publié dans la page Articles — bonne lecture.`,
      en: `A new article titled "${t.en}" was published on the Articles page — happy reading.`,
      tr: `«${t.tr}» başlıklı yeni bir makale, Makaleler sayfasında yayınlandı — iyi okumalar.`,
      es: `Se publicó un nuevo artículo titulado «${t.es}» en la página de Artículos — buena lectura.`,
    },
  };
}


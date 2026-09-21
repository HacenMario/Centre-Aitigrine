/**
 * مركز أيت تقرين — نصوص الإشعارات ثلاثية اللغة (عربي / فرنسي / إنجليزي)
 * كل إشعار يُبنى بثلاث لغات فيصله للمستخدم بلغته المختارة
 * (الواجهة تختار titles[lang]، وService Worker يختار من نفس الخريطة)
 */

export type TriText = {
  ar: string;
  fr: string;
  en: string;
};

export type TriNotification = {
  titles: TriText;
  bodies: TriText;
};

/** تنسيق التاريخ والوقت حسب اللغة */
function fmtDate(date: string, lang: "ar" | "fr" | "en"): string {
  try {
    const d = new Date(`${date}T00:00:00`);
    return d.toLocaleDateString(lang === "ar" ? "ar-DZ" : lang === "fr" ? "fr-FR" : "en-GB", {
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
function tomorrowDate(tomorrowStr: string, lang: "ar" | "fr" | "en"): string {
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
      },
      bodies: {
        ar: `لديك موعد${svc ? ` «${svc}»` : ""} غداً ${tomorrowDate(tomorrowStr, "ar")} على الساعة ${time}${otherName ? ` مع ${otherName}` : ""}.`,
        fr: `Vous avez un rendez-vous${svc ? ` « ${svc} »` : ""} demain ${tomorrowDate(tomorrowStr, "fr")} à ${time}${otherName ? ` avec ${otherName}` : ""}.`,
        en: `You have an appointment${svc ? ` "${svc}"` : ""} tomorrow, ${tomorrowDate(tomorrowStr, "en")} at ${time}${otherName ? ` with ${otherName}` : ""}.`,
      },
    };
  }
  return {
    titles: {
      ar: "تذكير بجلسة الغد",
      fr: "Rappel de la séance de demain",
      en: "Tomorrow's session reminder",
    },
    bodies: {
      ar: `لديك جلسة غداً ${tomorrowDate(tomorrowStr, "ar")} على الساعة ${time}${otherName ? ` مع العميل ${otherName}` : ""}.`,
      fr: `Vous avez une séance demain ${tomorrowDate(tomorrowStr, "fr")} à ${time}${otherName ? ` avec le client ${otherName}` : ""}.`,
      en: `You have a session tomorrow, ${tomorrowDate(tomorrowStr, "en")} at ${time}${otherName ? ` with client ${otherName}` : ""}.`,
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
      },
      bodies: {
        ar: `موعدك${svc ? ` «${svc}»` : ""} على الساعة ${time} — بعد أقل من ساعة.`,
        fr: `Votre rendez-vous${svc ? ` « ${svc} »` : ""} à ${time} — dans moins d'une heure.`,
        en: `Your appointment${svc ? ` "${svc}"` : ""} at ${time} — in less than an hour.`,
      },
    };
  }
  return {
    titles: {
      ar: "جلسة بعد قليل",
      fr: "Séance dans peu de temps",
      en: "Session coming up",
    },
    bodies: {
      ar: `جلسة على الساعة ${time}${otherName ? ` مع العميل ${otherName}` : ""} — بعد أقل من ساعة.`,
      fr: `Séance à ${time}${otherName ? ` avec le client ${otherName}` : ""} — dans moins d'une heure.`,
      en: `Session at ${time}${otherName ? ` with client ${otherName}` : ""} — in less than an hour.`,
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
      },
      bodies: {
        ar: `موعدك يوم ${fmtDate(date, "ar")} على الساعة ${time}${otherName ? ` مع ${otherName}` : ""} — بانتظار التأكيد.`,
        fr: `Votre rendez-vous le ${fmtDate(date, "fr")} à ${time}${otherName ? ` avec ${otherName}` : ""} — en attente de confirmation.`,
        en: `Your appointment on ${fmtDate(date, "en")} at ${time}${otherName ? ` with ${otherName}` : ""} — awaiting confirmation.`,
      },
    };
  }
  if (viewer === "specialist") {
    return {
      titles: {
        ar: "موعد جديد",
        fr: "Nouveau rendez-vous",
        en: "New appointment",
      },
      bodies: {
        ar: `حجز جديد يوم ${fmtDate(date, "ar")} على الساعة ${time}${clientName ? ` للعميل ${clientName}` : ""}.`,
        fr: `Nouvelle réservation le ${fmtDate(date, "fr")} à ${time}${clientName ? ` pour le client ${clientName}` : ""}.`,
        en: `New booking on ${fmtDate(date, "en")} at ${time}${clientName ? ` for client ${clientName}` : ""}.`,
      },
    };
  }
  /* الإدارة: ملخص إداري — ليست رسالة موجهة للأخصائي */
  return {
    titles: {
      ar: "حجز جديد في المركز",
      fr: "Nouvelle réservation au centre",
      en: "New booking at the center",
    },
    bodies: {
      ar: `حجز جديد بتاريخ ${fmtDate(date, "ar")} على الساعة ${time}${otherName ? ` مع ${otherName}` : ""}${clientName ? ` — العميل: ${clientName}` : ""}.`,
      fr: `Nouvelle réservation le ${fmtDate(date, "fr")} à ${time}${otherName ? ` avec ${otherName}` : ""}${clientName ? ` — client : ${clientName}` : ""}.`,
      en: `New booking on ${fmtDate(date, "en")} at ${time}${otherName ? ` with ${otherName}` : ""}${clientName ? ` — client: ${clientName}` : ""}.`,
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
  const d = { ar: fmtDate(date, "ar"), fr: fmtDate(date, "fr"), en: fmtDate(date, "en") };
  if (toClient) {
    switch (status) {
      case "confirmed":
        return {
          titles: { ar: "تم تأكيد موعدك", fr: "Votre rendez-vous est confirmé", en: "Your appointment is confirmed" },
          bodies: {
            ar: `تم تأكيد موعدك يوم ${d.ar} على الساعة ${time}.`,
            fr: `Votre rendez-vous du ${d.fr} à ${time} a été confirmé.`,
            en: `Your appointment on ${d.en} at ${time} has been confirmed.`,
          },
        };
      case "completed":
        return {
          titles: { ar: "انتهت جلستك", fr: "Votre séance est terminée", en: "Your session is completed" },
          bodies: {
            ar: `انتهت جلستك يوم ${d.ar} على الساعة ${time}. نتمنى لك دوام الصحة.`,
            fr: `Votre séance du ${d.fr} à ${time} est terminée. Portez-vous bien.`,
            en: `Your session on ${d.en} at ${time} is completed. Take care.`,
          },
        };
      case "cancelled":
        return {
          titles: { ar: "أُلغي موعدك", fr: "Votre rendez-vous a été annulé", en: "Your appointment was cancelled" },
          bodies: {
            ar: `أُلغي موعدك يوم ${d.ar} على الساعة ${time}. يمكنك حجز موعد آخر في أي وقت.`,
            fr: `Votre rendez-vous du ${d.fr} à ${time} a été annulé. Vous pouvez réserver un autre moment à tout instant.`,
            en: `Your appointment on ${d.en} at ${time} was cancelled. You can book another one anytime.`,
          },
        };
      default:
        return {
          titles: { ar: "تحديث على موعدك", fr: "Mise à jour de votre rendez-vous", en: "Appointment update" },
          bodies: {
            ar: `موعدك يوم ${d.ar} على الساعة ${time} بانتظار التأكيد.`,
            fr: `Votre rendez-vous du ${d.fr} à ${time} est en attente de confirmation.`,
            en: `Your appointment on ${d.en} at ${time} is awaiting confirmation.`,
          },
        };
    }
  }
  /* إشعار للأخصائي أو للإدارة */
  if (status === "cancelled") {
    return {
      titles: { ar: "أُلغي موعد", fr: "Rendez-vous annulé", en: "Appointment cancelled" },
      bodies: {
        ar: `أُلغي موعد يوم ${d.ar} على الساعة ${time}.`,
        fr: `Le rendez-vous du ${d.fr} à ${time} a été annulé.`,
        en: `The appointment on ${d.en} at ${time} was cancelled.`,
      },
    };
  }
  return {
    titles: { ar: "تحديث على موعد", fr: "Mise à jour d'un rendez-vous", en: "Appointment update" },
    bodies: {
      ar: `تحديث على الموعد يوم ${d.ar} على الساعة ${time} — الحالة: ${status === "confirmed" ? "مؤكد" : status === "completed" ? "منتهٍ" : "بانتظار التأكيد"}.`,
      fr: `Mise à jour du rendez-vous du ${d.fr} à ${time} — statut : ${status === "confirmed" ? "confirmé" : status === "completed" ? "terminé" : "en attente"}.`,
      en: `Update for the appointment on ${d.en} at ${time} — status: ${status === "confirmed" ? "confirmed" : status === "completed" ? "completed" : "pending"}.`,
    },
  };
}

/* ─────────── إشعار عام ─────────── */
export function generalText(ar: string, fr: string, en: string): TriNotification {
  return {
    titles: { ar, fr, en },
    bodies: { ar: "", fr: "", en: "" },
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
    },
    bodies: {
      ar: `أهلاً ${name}! تم إنشاء حسابك بنجاح. احجز جلستك الأولى الآن وابدأ طريقك نحو راحة البال. احتفظ بعبارة الاسترجاع — تحتاجها لاستعادة حسابك.`,
      fr: `Bonjour ${name} ! Votre compte a été créé avec succès. Réservez votre première séance et commencez votre chemin vers la sérénité. Conservez votre phrase de récupération — elle vous servira à retrouver votre compte.`,
      en: `Hello ${name}! Your account has been created successfully. Book your first session and start your journey to peace of mind. Keep your recovery phrase — you will need it to recover your account.`,
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
    },
    bodies: {
      ar: `الاسم: ${name} — الهاتف: ${phone}. تم إنشاء الحساب ذاتياً بوابة العميل.`,
      fr: `Nom : ${name} — Téléphone : ${phone}. Le compte a été créé via le portail client.`,
      en: `Name: ${name} — Phone: ${phone}. The account was self-registered via the client portal.`,
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
  return {
    titles: {
      ar: "طلب استعادة كلمة مرور",
      fr: "Demande de récupération de mot de passe",
      en: "Password recovery request",
    },
    bodies: {
      ar: `طلب من ${name} (${roleAr}) — الهاتف: ${phone} — استعادة حسابه. عالِج الطلب من صفحة «الحسابات» لتعيين كلمة مرور مؤقتة وإبلاغه.`,
      fr: `${name} (${roleFr}) — tél. : ${phone} — a demandé à récupérer son compte. Traitez la demande depuis « Comptes » pour définir un mot de passe temporaire.`,
      en: `${name} (${roleEn}) — phone: ${phone} — requested account recovery. Handle it from "Accounts" to set a temporary password and notify them.`,
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
  return {
    titles: {
      ar: "استرجاع حساب بعبارة الاسترجاع",
      fr: "Compte récupéré via la phrase de récupération",
      en: "Account recovered via recovery phrase",
    },
    bodies: {
      ar: `استعاد ${name} (${roleAr}) — الهاتف: ${phone} — حسابه بنفسه بعبارة الاسترجاع وأعاد تعيين كلمة المرور فوراً.`,
      fr: `${name} (${roleFr}) — tél. : ${phone} — a récupéré son compte lui-même avec sa phrase et a réinitialisé son mot de passe.`,
      en: `${name} (${roleEn}) — phone: ${phone} — recovered their account with their recovery phrase and reset the password.`,
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
    },
    bodies: {
      ar: `من ${name}${contact ? ` — للتواصل: ${contact}` : ""}: «${short}»`,
      fr: `De ${name}${contact ? ` — contact : ${contact}` : ""} : « ${short} »`,
      en: `From ${name}${contact ? ` — contact: ${contact}` : ""}: "${short}"`,
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
    },
    bodies: {
      ar: `العميل ${clientName} (${clientPhone}) يطلب التسجيل في تكوين «${courseTitle}». تواصل معه للتأكيد من صفحة التكوينات.`,
      fr: `Le client ${clientName} (${clientPhone}) demande à s'inscrire à la formation « ${courseTitle} ». Contactez-le pour confirmer.`,
      en: `Client ${clientName} (${clientPhone}) requests enrollment in "${courseTitle}". Contact them to confirm.`,
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
    },
    bodies: {
      ar: `حدّث العميل ${clientName} إجاباته في كتاب «${bookTitle}» — راجعها من صفحة الكتب الإلكترونية.`,
      fr: `Le client ${clientName} a mis à jour ses réponses dans « ${bookTitle} » — consultez-les depuis les livres électroniques.`,
      en: `Client ${clientName} updated their answers in "${bookTitle}" — review them from E-books.`,
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
      },
      bodies: {
        ar: `أُعجب ${name} بإعلان «${adTitle}».`,
        fr: `${name} a aimé l'annonce « ${adTitle} ».`,
        en: `${name} liked the ad "${adTitle}".`,
      },
    };
  }
  return {
    titles: {
      ar: "تعليق جديد على إعلان المركز",
      fr: "Nouveau commentaire sur une annonce",
      en: "New comment on a center ad",
    },
    bodies: {
      ar: `علّق ${name} على «${adTitle}»: «${short}» — يمكنك الرد أو الحجب من صفحة الإعلانات.`,
      fr: `${name} a commenté « ${adTitle} » : « ${short} » — répondez ou masquez depuis la page des annonces.`,
      en: `${name} commented on "${adTitle}": "${short}" — reply or hide it from the Ads page.`,
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
    },
    bodies: {
      ar: `عيّنت الإدارة كلمة مرور مؤقتة لحسابك${tempPassword ? `: ${tempPassword}` : ""} — سجّل الدخول بها وغيّرها من ملفك الشخصي فوراً.`,
      fr: `L'administration a défini un mot de passe temporaire${tempPassword ? ` : ${tempPassword}` : ""} — connectez-vous puis changez-le depuis votre profil.`,
      en: `The administration set a temporary password${tempPassword ? `: ${tempPassword}` : ""} — log in with it and change it from your profile right away.`,
    },
  };
}

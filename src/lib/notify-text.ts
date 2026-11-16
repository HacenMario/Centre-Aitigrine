/**
 * مركز أيت تقرين — نصوص الإشعارات بخمس لغات (عربي / فرنسي / إنجليزي / تركي / إسباني)
 * كل إشعار يُبنى بخمس لغات فيصله للمستخدم بلغته المختارة
 * (الواجهة تختار titles[lang]، وService Worker يختار من نفس الخريطة)
 */

export type PentaText = {
  ar: string;
  fr: string;
  en: string;
  tr: string;
  es: string;
};

export type PentaNotification = {
  titles: PentaText;
  bodies: PentaText;
};

const LOCALES: Record<string, string> = { ar: "ar-DZ", fr: "fr-FR", en: "en-GB", tr: "tr-TR", es: "es-ES" };

/** تنسيق التاريخ والوقت حسب اللغة */
function fmtDate(date: string, lang: "ar" | "fr" | "en" | "tr" | "es"): string {
  try {
    const d = new Date(`${date}T00:00:00`);
    return d.toLocaleDateString(LOCALES[lang] || "en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

const LANGS: ("ar" | "fr" | "en" | "tr" | "es")[] = ["ar", "fr", "en", "tr", "es"];

/* ─────────── تذكير بموعد الغد ─────────── */
export function reminderDayText(opts: {
  tomorrowStr: string;
  time: string;
  serviceTitle?: string;
  forClient: boolean;
  otherName?: string; // اسم الأخصائي (للعميل) أو اسم العميل (للأخصائي)
}): PentaNotification {
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
        ar: `لديك موعد${svc ? ` «${svc}»` : ""} غداً ${fmtDate(tomorrowStr, "ar")} على الساعة ${time}${otherName ? ` مع ${otherName}` : ""}.`,
        fr: `Vous avez un rendez-vous${svc ? ` « ${svc} »` : ""} demain ${fmtDate(tomorrowStr, "fr")} à ${time}${otherName ? ` avec ${otherName}` : ""}.`,
        en: `You have an appointment${svc ? ` "${svc}"` : ""} tomorrow, ${fmtDate(tomorrowStr, "en")} at ${time}${otherName ? ` with ${otherName}` : ""}.`,
        tr: `Yarın${svc ? ` «${svc}»` : ""} ${fmtDate(tomorrowStr, "tr")} saat ${time}${otherName ? ` ${otherName} ile` : ""} randevunuz var.`,
        es: `Tiene una cita${svc ? ` «${svc}»` : ""} mañana ${fmtDate(tomorrowStr, "es")} a las ${time}${otherName ? ` con ${otherName}` : ""}.`,
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
      ar: `لديك جلسة غداً ${fmtDate(tomorrowStr, "ar")} على الساعة ${time}${otherName ? ` مع العميل ${otherName}` : ""}.`,
      fr: `Vous avez une séance demain ${fmtDate(tomorrowStr, "fr")} à ${time}${otherName ? ` avec le client ${otherName}` : ""}.`,
      en: `You have a session tomorrow, ${fmtDate(tomorrowStr, "en")} at ${time}${otherName ? ` with client ${otherName}` : ""}.`,
      tr: `Yarın ${fmtDate(tomorrowStr, "tr")} saat ${time}${otherName ? ` ${otherName} adlı danışanla` : ""} seansınız var.`,
      es: `Tiene una sesión mañana ${fmtDate(tomorrowStr, "es")} a las ${time}${otherName ? ` con el cliente ${otherName}` : ""}.`,
    },
  };
}

/* ─────────── تذكير قبل ساعة ─────────── */
export function reminderHourText(opts: {
  time: string;
  serviceTitle?: string;
  forClient: boolean;
  otherName?: string;
}): PentaNotification {
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
        tr: `Randevunuz${svc ? ` «${svc}»` : ""} saat ${time} — bir saatten az kaldı.`,
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
      tr: `Saat ${time} seans${otherName ? ` — ${otherName} adlı danışan` : ""} — bir saatten az kaldı.`,
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
}): PentaNotification {
  const { date, time, serviceTitle, viewer, otherName, clientName } = opts;
  const d = Object.fromEntries(LANGS.map((l) => [l, fmtDate(date, l)])) as Record<"ar" | "fr" | "en" | "tr" | "es", string>;
  if (viewer === "client") {
    return {
      titles: {
        ar: "تم تسجيل حجزك",
        fr: "Votre réservation est enregistrée",
        en: "Your booking is registered",
        tr: "Rezervasyonunuz kaydedildi",
        es: "Su reserva está registrada",
      },
      bodies: {
        ar: `موعدك يوم ${d.ar} على الساعة ${time}${otherName ? ` مع ${otherName}` : ""} — بانتظار التأكيد.`,
        fr: `Votre rendez-vous le ${d.fr} à ${time}${otherName ? ` avec ${otherName}` : ""} — en attente de confirmation.`,
        en: `Your appointment on ${d.en} at ${time}${otherName ? ` with ${otherName}` : ""} — awaiting confirmation.`,
        tr: `Randevunuz ${d.tr} saat ${time}${otherName ? ` — ${otherName} ile` : ""} — onay bekleniyor.`,
        es: `Su cita el ${d.es} a las ${time}${otherName ? ` con ${otherName}` : ""} — pendiente de confirmación.`,
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
        ar: `حجز جديد يوم ${d.ar} على الساعة ${time}${clientName ? ` للعميل ${clientName}` : ""}.`,
        fr: `Nouvelle réservation le ${d.fr} à ${time}${clientName ? ` pour le client ${clientName}` : ""}.`,
        en: `New booking on ${d.en} at ${time}${clientName ? ` for client ${clientName}` : ""}.`,
        tr: `${d.tr} saat ${time}${clientName ? ` — ${clientName} adlı danışan için` : ""} yeni rezervasyon.`,
        es: `Nueva reserva el ${d.es} a las ${time}${clientName ? ` para el cliente ${clientName}` : ""}.`,
      },
    };
  }
  /* الإدارة: ملخص إداري — ليست رسالة موجهة للأخصائي */
  return {
    titles: {
      ar: "حجز جديد في المركز",
      fr: "Nouvelle réservation au centre",
      en: "New booking at the center",
      tr: "Merkeze yeni rezervasyon",
      es: "Nueva reserva en el centro",
    },
    bodies: {
      ar: `حجز جديد بتاريخ ${d.ar} على الساعة ${time}${otherName ? ` مع ${otherName}` : ""}${clientName ? ` — العميل: ${clientName}` : ""}.`,
      fr: `Nouvelle réservation le ${d.fr} à ${time}${otherName ? ` avec ${otherName}` : ""}${clientName ? ` — client : ${clientName}` : ""}.`,
      en: `New booking on ${d.en} at ${time}${otherName ? ` with ${otherName}` : ""}${clientName ? ` — client: ${clientName}` : ""}.`,
      tr: `${d.tr} saat ${time} tarihinde yeni rezervasyon${otherName ? ` — ${otherName} ile` : ""}${clientName ? ` — danışan: ${clientName}` : ""}.`,
      es: `Nueva reserva el ${d.es} a las ${time}${otherName ? ` con ${otherName}` : ""}${clientName ? ` — cliente: ${clientName}` : ""}.`,
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
}): PentaNotification {
  const { status, date, time, toClient } = opts;
  const d = Object.fromEntries(LANGS.map((l) => [l, fmtDate(date, l)])) as Record<"ar" | "fr" | "en" | "tr" | "es", string>;
  if (toClient) {
    switch (status) {
      case "confirmed":
        return {
          titles: {
            ar: "تم تأكيد موعدك", fr: "Votre rendez-vous est confirmé", en: "Your appointment is confirmed",
            tr: "Randevunuz onaylandı", es: "Su cita ha sido confirmada",
          },
          bodies: {
            ar: `تم تأكيد موعدك يوم ${d.ar} على الساعة ${time}.`,
            fr: `Votre rendez-vous du ${d.fr} à ${time} a été confirmé.`,
            en: `Your appointment on ${d.en} at ${time} has been confirmed.`,
            tr: `${d.tr} saat ${time} randevunuz onaylandı.`,
            es: `Su cita del ${d.es} a las ${time} ha sido confirmada.`,
          },
        };
      case "completed":
        return {
          titles: {
            ar: "انتهت جلستك", fr: "Votre séance est terminée", en: "Your session is completed",
            tr: "Seansınız tamamlandı", es: "Su sesión ha finalizado",
          },
          bodies: {
            ar: `انتهت جلستك يوم ${d.ar} على الساعة ${time}. نتمنى لك دوام الصحة.`,
            fr: `Votre séance du ${d.fr} à ${time} est terminée. Portez-vous bien.`,
            en: `Your session on ${d.en} at ${time} is completed. Take care.`,
            tr: `${d.tr} saat ${time} seansınız tamamlandı. Sağlıklı günler dileriz.`,
            es: `Su sesión del ${d.es} a las ${time} ha finalizado. Le deseamos buena salud.`,
          },
        };
      case "cancelled":
        return {
          titles: {
            ar: "أُلغي موعدك", fr: "Votre rendez-vous a été annulé", en: "Your appointment was cancelled",
            tr: "Randevunuz iptal edildi", es: "Su cita ha sido cancelada",
          },
          bodies: {
            ar: `أُلغي موعدك يوم ${d.ar} على الساعة ${time}. يمكنك حجز موعد آخر في أي وقت.`,
            fr: `Votre rendez-vous du ${d.fr} à ${time} a été annulé. Vous pouvez réserver un autre moment à tout instant.`,
            en: `Your appointment on ${d.en} at ${time} was cancelled. You can book another one anytime.`,
            tr: `${d.tr} saat ${time} randevunuz iptal edildi. Dilediğiniz zaman yeni bir randevu alabilirsiniz.`,
            es: `Su cita del ${d.es} a las ${time} ha sido cancelada. Puede reservar otra en cualquier momento.`,
          },
        };
      default:
        return {
          titles: {
            ar: "تحديث على موعدك", fr: "Mise à jour de votre rendez-vous", en: "Appointment update",
            tr: "Randevu güncellemesi", es: "Actualización de su cita",
          },
          bodies: {
            ar: `موعدك يوم ${d.ar} على الساعة ${time} بانتظار التأكيد.`,
            fr: `Votre rendez-vous du ${d.fr} à ${time} est en attente de confirmation.`,
            en: `Your appointment on ${d.en} at ${time} is awaiting confirmation.`,
            tr: `${d.tr} saat ${time} randevunuz onay bekliyor.`,
            es: `Su cita del ${d.es} a las ${time} está pendiente de confirmación.`,
          },
        };
    }
  }
  /* إشعار للأخصائي أو للإدارة */
  if (status === "cancelled") {
    return {
      titles: {
        ar: "أُلغي موعد", fr: "Rendez-vous annulé", en: "Appointment cancelled",
        tr: "Randevu iptal edildi", es: "Cita cancelada",
      },
      bodies: {
        ar: `أُلغي موعد يوم ${d.ar} على الساعة ${time}.`,
        fr: `Le rendez-vous du ${d.fr} à ${time} a été annulé.`,
        en: `The appointment on ${d.en} at ${time} was cancelled.`,
        tr: `${d.tr} saat ${time} randevusu iptal edildi.`,
        es: `La cita del ${d.es} a las ${time} ha sido cancelada.`,
      },
    };
  }
  return {
    titles: {
      ar: "تحديث على موعد", fr: "Mise à jour d'un rendez-vous", en: "Appointment update",
      tr: "Randevu güncellemesi", es: "Actualización de una cita",
    },
    bodies: {
      ar: `تحديث على الموعد يوم ${d.ar} على الساعة ${time} — الحالة: ${status === "confirmed" ? "مؤكد" : status === "completed" ? "منتهٍ" : "بانتظار التأكيد"}.`,
      fr: `Mise à jour du rendez-vous du ${d.fr} à ${time} — statut : ${status === "confirmed" ? "confirmé" : status === "completed" ? "terminé" : "en attente"}.`,
      en: `Update for the appointment on ${d.en} at ${time} — status: ${status === "confirmed" ? "confirmed" : status === "completed" ? "completed" : "pending"}.`,
      tr: `${d.tr} saat ${time} randevusu güncellendi — durum: ${status === "confirmed" ? "onaylandı" : status === "completed" ? "tamamlandı" : "onay bekliyor"}.`,
      es: `Actualización de la cita del ${d.es} a las ${time} — estado: ${status === "confirmed" ? "confirmada" : status === "completed" ? "finalizada" : "pendiente"}.`,
    },
  };
}

/* ─────────── تغيير وقت الموعد (إعادة جدولة) ★ v3.12 ─────────── */
export function rescheduledText(opts: {
  oldDate: string;
  oldTime: string;
  date: string;
  time: string;
  toClient: boolean;
  otherName?: string; // اسم الأخصائي (للعميل)
  clientName?: string; // اسم العميل (للأخصائي/الإدارة)
}): PentaNotification {
  const { oldDate, oldTime, date, time, toClient, otherName, clientName } = opts;
  const d = Object.fromEntries(LANGS.map((l) => [l, fmtDate(date, l)])) as Record<"ar" | "fr" | "en" | "tr" | "es", string>;
  const od = Object.fromEntries(LANGS.map((l) => [l, fmtDate(oldDate, l)])) as Record<"ar" | "fr" | "en" | "tr" | "es", string>;
  if (toClient) {
    return {
      titles: {
        ar: "تم تغيير موعدك",
        fr: "Votre rendez-vous a été modifié",
        en: "Your appointment has been rescheduled",
        tr: "Randevunuz değiştirildi",
        es: "Su cita ha sido cambiada",
      },
      bodies: {
        ar: `تم تغيير موعدك${otherName ? ` مع ${otherName}` : ""} من ${od.ar} على الساعة ${oldTime} إلى ${d.ar} على الساعة ${time}.`,
        fr: `Votre rendez-vous${otherName ? ` avec ${otherName}` : ""} a été déplacé du ${od.fr} à ${oldTime} au ${d.fr} à ${time}.`,
        en: `Your appointment${otherName ? ` with ${otherName}` : ""} has been moved from ${od.en} at ${oldTime} to ${d.en} at ${time}.`,
        tr: `Randevunuz${otherName ? ` — ${otherName} ile` : ""} ${od.tr} saat ${oldTime} üzerinden ${d.tr} saat ${time} saatine alındı.`,
        es: `Su cita${otherName ? ` con ${otherName}` : ""} ha sido cambiada del ${od.es} a las ${oldTime} al ${d.es} a las ${time}.`,
      },
    };
  }
  /* للأخصائي أو للإدارة */
  return {
    titles: {
      ar: "تم تغيير وقت موعد",
      fr: "L'heure d'un rendez-vous a été modifiée",
      en: "Appointment time changed",
      tr: "Randevu saati değiştirildi",
      es: "Se cambió la hora de una cita",
    },
    bodies: {
      ar: `تم تغيير الموعد من ${od.ar} على الساعة ${oldTime} إلى ${d.ar} على الساعة ${time}${clientName ? ` — العميل: ${clientName}` : ""}.`,
      fr: `Le rendez-vous est passé du ${od.fr} à ${oldTime} au ${d.fr} à ${time}${clientName ? ` — client : ${clientName}` : ""}.`,
      en: `The appointment moved from ${od.en} at ${oldTime} to ${d.en} at ${time}${clientName ? ` — client: ${clientName}` : ""}.`,
      tr: `Randevu ${od.tr} saat ${oldTime} üzerinden ${d.tr} saat ${time} saatine alındı${clientName ? ` — danışan: ${clientName}` : ""}.`,
      es: `La cita pasó del ${od.es} a las ${oldTime} al ${d.es} a las ${time}${clientName ? ` — cliente: ${clientName}` : ""}.`,
    },
  };
}

/* ─────────── تغيير الأخصائي المكلف بالموعد ★ v3.23 ───────────
 * كل طرف يتلقى نصه الخاص: العميل يتعرف على أخصائيه الجديد،
 * الأخصائي الجديد يُكلَّف بالموعد، والأخصائي السابق يُبلَّغ بأنه لم يعد مسؤولاً عنه */
export function reassignedText(opts: {
  date: string;
  time: string;
  viewer: "client" | "newSpec" | "oldSpec" | "staff";
  specName?: string; // اسم الأخصائي الجديد (للعميل)
  clientName?: string; // اسم العميل (للأخصائي/الإدارة)
  oldName?: string; // اسم الأخصائي السابق (للإدارة)
}): PentaNotification {
  const { date, time, viewer, specName, clientName, oldName } = opts;
  const d = Object.fromEntries(LANGS.map((l) => [l, fmtDate(date, l)])) as Record<"ar" | "fr" | "en" | "tr" | "es", string>;
  if (viewer === "client") {
    return {
      titles: {
        ar: "تم تغيير الأخصائي المسؤول عن موعدك",
        fr: "Le spécialiste de votre rendez-vous a changé",
        en: "Your appointment specialist has changed",
        tr: "Randevunuzun uzmanı değişti",
        es: "El especialista de su cita ha cambiado",
      },
      bodies: {
        ar: `موعدك بتاريخ ${d.ar} على الساعة ${time} أصبح مكلَّف به${specName ? ` ${specName}` : " أخصائي آخر"}.`,
        fr: `Votre rendez-vous du ${d.fr} à ${time} est désormais confié${specName ? ` à ${specName}` : " à un autre spécialiste"}.`,
        en: `Your appointment on ${d.en} at ${time} is now handled${specName ? ` by ${specName}` : " by another specialist"}.`,
        tr: `${d.tr} saat ${time} randevunuz artık${specName ? ` ${specName}` : " başka bir uzman"} tarafından yürütülecek.`,
        es: `Su cita del ${d.es} a las ${time} ahora estará a cargo${specName ? ` de ${specName}` : " de otro especialista"}.`,
      },
    };
  }
  if (viewer === "newSpec") {
    return {
      titles: {
        ar: "كُلِّفتَ بموعد جديد",
        fr: "Un nouveau rendez-vous vous a été confié",
        en: "A new appointment has been assigned to you",
        tr: "Size yeni bir randevu atandı",
        es: "Se le ha asignado una nueva cita",
      },
      bodies: {
        ar: `كُلِّفتَ بموعد بتاريخ ${d.ar} على الساعة ${time}${clientName ? ` — العميل: ${clientName}` : ""}.`,
        fr: `Un rendez-vous vous a été confié le ${d.fr} à ${time}${clientName ? ` — client : ${clientName}` : ""}.`,
        en: `You have been assigned an appointment on ${d.en} at ${time}${clientName ? ` — client: ${clientName}` : ""}.`,
        tr: `${d.tr} saat ${time} randevusu size atandı${clientName ? ` — danışan: ${clientName}` : ""}.`,
        es: `Se le ha asignado una cita el ${d.es} a las ${time}${clientName ? ` — cliente: ${clientName}` : ""}.`,
      },
    };
  }
  if (viewer === "oldSpec") {
    return {
      titles: {
        ar: "أُعيد تكليف أحد مواعيدك",
        fr: "Un de vos rendez-vous a été réattribué",
        en: "One of your appointments has been reassigned",
        tr: "Randevularınızdan biri yeniden atandı",
        es: "Una de sus citas ha sido reasignada",
      },
      bodies: {
        ar: `موعد بتاريخ ${d.ar} على الساعة ${time} أُعيد تكليفه إلى أخصائي آخر.`,
        fr: `Le rendez-vous du ${d.fr} à ${time} a été réattribué à un autre spécialiste.`,
        en: `The appointment on ${d.en} at ${time} has been reassigned to another specialist.`,
        tr: `${d.tr} saat ${time} randevusu başka bir uzmana atandı.`,
        es: `La cita del ${d.es} a las ${time} ha sido reasignada a otro especialista.`,
      },
    };
  }
  /* ملخص إداري */
  return {
    titles: {
      ar: "تغيير الأخصائي المكلف بالموعد",
      fr: "Changement de spécialiste d'un rendez-vous",
      en: "Appointment specialist changed",
      tr: "Randevu uzmanı değiştirildi",
      es: "Cambio de especialista de una cita",
    },
    bodies: {
      ar: `أُعيد تكليف موعد بتاريخ ${d.ar} على الساعة ${time}${oldName ? ` من ${oldName}` : ""}${specName ? ` إلى ${specName}` : ""}${clientName ? ` — العميل: ${clientName}` : ""}.`,
      fr: `Le rendez-vous du ${d.fr} à ${time} a été réattribué${oldName ? ` de ${oldName}` : ""}${specName ? ` à ${specName}` : ""}${clientName ? ` — client : ${clientName}` : ""}.`,
      en: `The appointment on ${d.en} at ${time} was reassigned${oldName ? ` from ${oldName}` : ""}${specName ? ` to ${specName}` : ""}${clientName ? ` — client: ${clientName}` : ""}.`,
      tr: `${d.tr} saat ${time} randevusu${oldName ? ` ${oldName}` : ""}${specName ? ` → ${specName}` : ""} yeniden atandı${clientName ? ` — danışan: ${clientName}` : ""}.`,
      es: `La cita del ${d.es} a las ${time} fue reasignada${oldName ? ` de ${oldName}` : ""}${specName ? ` a ${specName}` : ""}${clientName ? ` — cliente: ${clientName}` : ""}.`,
    },
  };
}

/* ─────────── إشعار عام ─────────── */
export function generalText(ar: string, fr: string, en: string, tr?: string, es?: string): PentaNotification {
  return {
    titles: { ar, fr, en, tr: tr || fr, es: es || fr },
    bodies: { ar: "", fr: "", en: "", tr: "", es: "" },
  };
}

/* ─────────── الترحيب بعميل جديد (للعميل نفسه) ─────────── */
export function welcomeText(opts: { name: string }): PentaNotification {
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
      tr: `Merhaba ${name}! Hesabınız başarıyla oluşturuldu. İlk seansınızı hemen ayarlayın ve huzura giden yolculuğunuza başlayın. Kurtarma ifadenizi saklayın — hesabınızı geri almak için gerekecek.`,
      es: `¡Hola ${name}! Su cuenta se ha creado con éxito. Reserve su primera sesión y comience su camino hacia la tranquilidad. Guarde su frase de recuperación — la necesitará para recuperar su cuenta.`,
    },
  };
}

/* ─────────── انضمام عميل جديد (للإدارة) ─────────── */
export function newClientText(opts: { name: string; phone: string }): PentaNotification {
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
      tr: `Ad: ${name} — Telefon: ${phone}. Hesap, danışan portalı aracılığıyla kendi kendine oluşturuldu.`,
      es: `Nombre: ${name} — Teléfono: ${phone}. La cuenta se registró por sí misma a través del portal del cliente.`,
    },
  };
}

/* ─────────── طلب استعادة كلمة مرور (للإدارة — كل التفاصيل) ─────────── */
export function resetRequestedText(opts: {
  name: string;
  phone: string;
  role: string;
}): PentaNotification {
  const { name, phone, role } = opts;
  const roleOf = (l: "ar" | "fr" | "en" | "tr" | "es") =>
    l === "ar"
      ? role === "specialist" ? "أخصائي" : role === "assistant" ? "مساعد" : role === "admin" ? "إدارة" : "عميل"
      : l === "fr"
      ? role === "specialist" ? "spécialiste" : role === "assistant" ? "assistant" : role === "admin" ? "administration" : "client"
      : l === "tr"
      ? role === "specialist" ? "uzman" : role === "assistant" ? "asistan" : role === "admin" ? "idare" : "danışan"
      : l === "es"
      ? role === "specialist" ? "especialista" : role === "assistant" ? "asistente" : role === "admin" ? "administración" : "cliente"
      : role === "specialist" ? "specialist" : role === "assistant" ? "assistant" : role === "admin" ? "admin" : "client";
  return {
    titles: {
      ar: "طلب استعادة كلمة مرور",
      fr: "Demande de récupération de mot de passe",
      en: "Password recovery request",
      tr: "Şifre kurtarma talebi",
      es: "Solicitud de recuperación de contraseña",
    },
    bodies: {
      ar: `طلب من ${name} (${roleOf("ar")}) — الهاتف: ${phone} — استعادة حسابه. عالِج الطلب من صفحة «الحسابات» لتعيين كلمة مرور مؤقتة وإبلاغه.`,
      fr: `${name} (${roleOf("fr")}) — tél. : ${phone} — a demandé à récupérer son compte. Traitez la demande depuis « Comptes » pour définir un mot de passe temporaire.`,
      en: `${name} (${roleOf("en")}) — phone: ${phone} — requested account recovery. Handle it from "Accounts" to set a temporary password and notify them.`,
      tr: `${name} (${roleOf("tr")}) — tel: ${phone} — hesabını kurtarma talebi etti. Geçici şifre belirlemek için talebi «Hesaplar» sayfasından işleme alın.`,
      es: `${name} (${roleOf("es")}) — teléfono: ${phone} — solicitó recuperar su cuenta. Procese la solicitud desde «Cuentas» para asignar una contraseña temporal.`,
    },
  };
}

/* ─────────── استرجاع ذاتي ناجح (للإدارة — شفافية) ─────────── */
export function recoveryDoneText(opts: {
  name: string;
  phone: string;
  role: string;
}): PentaNotification {
  const { name, phone, role } = opts;
  const roleOf = (l: "ar" | "fr" | "en" | "tr" | "es") =>
    l === "ar"
      ? role === "specialist" ? "أخصائي" : role === "assistant" ? "مساعد" : role === "admin" ? "إدارة" : "عميل"
      : l === "fr"
      ? role === "specialist" ? "spécialiste" : role === "assistant" ? "assistant" : role === "admin" ? "administration" : "client"
      : l === "tr"
      ? role === "specialist" ? "uzman" : role === "assistant" ? "asistan" : role === "admin" ? "idare" : "danışan"
      : l === "es"
      ? role === "specialist" ? "especialista" : role === "assistant" ? "asistente" : role === "admin" ? "administración" : "cliente"
      : role === "specialist" ? "specialist" : role === "assistant" ? "assistant" : role === "admin" ? "admin" : "client";
  return {
    titles: {
      ar: "استرجاع حساب بعبارة الاسترجاع",
      fr: "Compte récupéré via la phrase de récupération",
      en: "Account recovered via recovery phrase",
      tr: "Hesap kurtarma ifadesiyle geri alındı",
      es: "Cuenta recuperada con la frase de recuperación",
    },
    bodies: {
      ar: `استعاد ${name} (${roleOf("ar")}) — الهاتف: ${phone} — حسابه بنفسه بعبارة الاسترجاع وأعاد تعيين كلمة المرور فوراً.`,
      fr: `${name} (${roleOf("fr")}) — tél. : ${phone} — a récupéré son compte lui-même avec sa phrase et a réinitialisé son mot de passe.`,
      en: `${name} (${roleOf("en")}) — phone: ${phone} — recovered their account with their recovery phrase and reset the password.`,
      tr: `${name} (${roleOf("tr")}) — tel: ${phone} — hesabını kurtarma ifadesiyle kendi başına geri aldı ve şifresini hemen sıfırladı.`,
      es: `${name} (${roleOf("es")}) — teléfono: ${phone} — recuperó su cuenta con su frase de recuperación y restableció la contraseña de inmediato.`,
    },
  };
}

/* ─────────── اقتراح/بلاغ جديد (للإدارة) ─────────── */
export function feedbackText(opts: {
  kind: "suggestion" | "report";
  name: string;
  contact: string;
  message: string;
}): PentaNotification {
  const { kind, name, contact, message } = opts;
  const short = message.length > 140 ? `${message.slice(0, 140)}…` : message;
  return {
    titles: {
      ar: kind === "report" ? "بلاغ جديد يحتاج مراجعة" : "اقتراح جديد من الزوار",
      fr: kind === "report" ? "Nouveau signalement à examiner" : "Nouvelle suggestion",
      en: kind === "report" ? "New report to review" : "New suggestion",
      tr: kind === "report" ? "İncellenecek yeni bildirim" : "Yeni öneri",
      es: kind === "report" ? "Nuevo informe para revisar" : "Nueva sugerencia",
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
}): PentaNotification {
  const { clientName, clientPhone, courseTitle } = opts;
  return {
    titles: {
      ar: "طلب تسجيل في تكوين",
      fr: "Demande d'inscription à une formation",
      en: "Course enrollment request",
      tr: "Eğitim kayıt talebi",
      es: "Solicitud de inscripción al curso",
    },
    bodies: {
      ar: `العميل ${clientName} (${clientPhone}) يطلب التسجيل في تكوين «${courseTitle}». تواصل معه للتأكيد من صفحة التكوينات.`,
      fr: `Le client ${clientName} (${clientPhone}) demande à s'inscrire à la formation « ${courseTitle} ». Contactez-le pour confirmer.`,
      en: `Client ${clientName} (${clientPhone}) requests enrollment in "${courseTitle}". Contact them to confirm.`,
      tr: `Danışan ${clientName} (${clientPhone}), «${courseTitle}» eğitimine kayıt talep ediyor. Onaylamak için kendisiyle iletişime geçin.`,
      es: `El cliente ${clientName} (${clientPhone}) solicita inscribirse en el curso «${courseTitle}». Contacte con él para confirmar.`,
    },
  };
}

/* ─────────── إجابات كتاب محدَّثة (للأخصائي المعالج) ─────────── */
export function ebookAnswersText(opts: {
  clientName: string;
  bookTitle: string;
}): PentaNotification {
  const { clientName, bookTitle } = opts;
  return {
    titles: {
      ar: "إجابات كتاب محدَّثة",
      fr: "Réponses de livre mises à jour",
      en: "Workbook answers updated",
      tr: "Çalışma kitabı yanıtları güncellendi",
      es: "Respuestas del cuaderno actualizadas",
    },
    bodies: {
      ar: `حدّث العميل ${clientName} إجاباته في كتاب «${bookTitle}» — راجعها من صفحة الكتب الإلكترونية.`,
      fr: `Le client ${clientName} a mis à jour ses réponses dans « ${bookTitle} » — consultez-les depuis les livres électroniques.`,
      en: `Client ${clientName} updated their answers in "${bookTitle}" — review them from E-books.`,
      tr: `Danışan ${clientName}, «${bookTitle}» kitabındaki yanıtlarını güncelledi — E-kitaplar sayfasından inceleyin.`,
      es: `El cliente ${clientName} actualizó sus respuestas en «${bookTitle}» — revíselas desde los E-books.`,
    },
  };
}

/* ─────────── تفاعل مع إعلان (للإدارة) ─────────── */
export function adInteractionText(opts: {
  kind: "like" | "comment";
  name: string;
  adTitle: string;
  text?: string;
}): PentaNotification {
  const { kind, name, adTitle, text } = opts;
  const short = text && text.length > 120 ? `${text.slice(0, 120)}…` : text || "";
  if (kind === "like") {
    return {
      titles: {
        ar: "إعجاب جديد بإعلان المركز",
        fr: "Nouveau j'aime sur une annonce",
        en: "New like on a center ad",
        tr: "Merkez ilanına yeni beğeni",
        es: "Nuevo me gusta en un anuncio del centro",
      },
      bodies: {
        ar: `أُعجب ${name} بإعلان «${adTitle}».`,
        fr: `${name} a aimé l'annonce « ${adTitle} ».`,
        en: `${name} liked the ad "${adTitle}".`,
        tr: `${name}, «${adTitle}» ilanını beğendi.`,
        es: `A ${name} le gustó el anuncio «${adTitle}».`,
      },
    };
  }
  return {
    titles: {
      ar: "تعليق جديد على إعلان المركز",
      fr: "Nouveau commentaire sur une annonce",
      en: "New comment on a center ad",
      tr: "Merkez ilanına yeni yorum",
      es: "Nuevo comentario en un anuncio del centro",
    },
    bodies: {
      ar: `علّق ${name} على «${adTitle}»: «${short}» — يمكنك الرد أو الحجب من صفحة الإعلانات.`,
      fr: `${name} a commenté « ${adTitle} » : « ${short} » — répondez ou masquez depuis la page des annonces.`,
      en: `${name} commented on "${adTitle}": "${short}" — reply or hide it from the Ads page.`,
      tr: `${name}, «${adTitle}» ilanına yorum yaptı: «${short}» — İlanlar sayfasından yanıtlayabilir veya gizleyebilirsiniz.`,
      es: `${name} comentó en «${adTitle}»: «${short}» — puede responder u ocultarlo desde la página de Anuncios.`,
    },
  };
}

/* ─────────── معالجة طلب الاستعادة (لصاحب الطلب) ─────────── */
export function resetHandledText(opts: { tempPassword?: string }): PentaNotification {
  const { tempPassword } = opts;
  return {
    titles: {
      ar: "تمت معالجة طلب استعادة حسابك",
      fr: "Votre demande de récupération a été traitée",
      en: "Your recovery request has been processed",
      tr: "Hesap kurtarma talebiniz işlendi",
      es: "Su solicitud de recuperación ha sido procesada",
    },
    bodies: {
      ar: `عيّنت الإدارة كلمة مرور مؤقتة لحسابك${tempPassword ? `: ${tempPassword}` : ""} — سجّل الدخول بها وغيّرها من ملفك الشخصي فوراً.`,
      fr: `L'administration a défini un mot de passe temporaire${tempPassword ? ` : ${tempPassword}` : ""} — connectez-vous puis changez-le depuis votre profil.`,
      en: `The administration set a temporary password${tempPassword ? `: ${tempPassword}` : ""} — log in with it and change it from your profile right away.`,
      tr: `İdare hesabınıza geçici bir şifre belirledi${tempPassword ? `: ${tempPassword}` : ""} — bununla giriş yapın ve profilinizden hemen değiştirin.`,
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
  authorName: string;
  viewer: "staff" | "audience";
}): PentaNotification {
  const { title, titleFr, titleEn, authorName, viewer } = opts;
  const t = {
    ar: title,
    fr: titleFr || title,
    en: titleEn || title,
    tr: titleEn || title,
    es: titleEn || title,
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
        tr: `Uzman ${authorName}, «${t.tr}» başlıklı yeni bir makale yayımladı — Makaleler sayfasından okuyabilirsiniz.`,
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
      tr: `«${t.tr}» başlıklı yeni makale Makaleler sayfasında yayımlandı — keyifli okumalar.`,
      es: `Se publicó un nuevo artículo titulado «${t.es}» en la página de Artículos — buena lectura.`,
    },
  };
}

/* ─────────── طلبات شراء الكتب الإلكترونية (v3.20) ───────────
 * staff: عميل طلب شراء كتاب مدفوع → إشعار فريق الإدارة (نافذة الطلبات)
 * accepted: الإدارة قبِلت الطلب → إشعار العميل بالتواصل عبر واتساب لتأكيد الدفع
 * paid: تأكيد الدفع → إشعار العميل بتفعيل الكتاب مع توجيه مباشر لصفحة الكتب */
export function ebookOrderStaffText(opts: {
  clientName: string;
  clientPhone: string;
  bookTitle: string;
  price: number;
}): PentaNotification {
  const { clientName, clientPhone, bookTitle, price } = opts;
  return {
    titles: {
      ar: "طلب شراء كتاب إلكتروني",
      fr: "Demande d'achat d'un e-book",
      en: "E-book purchase request",
      tr: "E-kitap satın alma talebi",
      es: "Solicitud de compra de un e-book",
    },
    bodies: {
      ar: `العميل ${clientName} (${clientPhone}) يطلب شراء الكتاب «${bookTitle}» بسعر ${price} دج — راجع طلبات الكتب لقبوله.`,
      fr: `Le client ${clientName} (${clientPhone}) demande à acheter l'e-book « ${bookTitle} » à ${price} DA — consultez les demandes de livres pour l'accepter.`,
      en: `Client ${clientName} (${clientPhone}) requests to buy the e-book "${bookTitle}" for ${price} DZD — check book orders to accept it.`,
      tr: `Müşteri ${clientName} (${clientPhone}), «${bookTitle}» e-kitabını ${price} DZD karşılığında satın almak istiyor — kabul etmek için kitap taleplerine bakın.`,
      es: `El cliente ${clientName} (${clientPhone}) solicita comprar el e-book «${bookTitle}» por ${price} DZD — revise los pedidos de libros para aceptarlo.`,
    },
  };
}

export function ebookOrderAcceptedText(opts: {
  bookTitle: string;
  price: number;
  whatsapp: string;
}): PentaNotification {
  const { bookTitle, price, whatsapp } = opts;
  const wa = whatsapp ? ` (واتساب: ${whatsapp})` : "";
  const waFr = whatsapp ? ` (WhatsApp : ${whatsapp})` : "";
  const waEn = whatsapp ? ` (WhatsApp: ${whatsapp})` : "";
  return {
    titles: {
      ar: "تم قبول طلب شراء الكتاب",
      fr: "Votre demande d'achat a été acceptée",
      en: "Your purchase request was accepted",
      tr: "Satın alma talebiniz kabul edildi",
      es: "Su solicitud de compra fue aceptada",
    },
    bodies: {
      ar: `قُبل طلبك لشراء الكتاب «${bookTitle}» بسعر ${price} دج. تواصل مع إدارة المركز عبر واتساب${wa} لتأكيد دفع مستحقات الكتاب واستلامه.`,
      fr: `Votre demande d'achat de l'e-book « ${bookTitle} » (${price} DA) a été acceptée. Contactez l'administration du centre via WhatsApp${waFr} pour confirmer le paiement et recevoir le livre.`,
      en: `Your request to buy the e-book "${bookTitle}" (${price} DZD) was accepted. Contact the center administration via WhatsApp${waEn} to confirm payment and receive the book.`,
      tr: `«${bookTitle}» e-kitabı satın alma talebiniz (${price} DZD) kabul edildi. Ödemeyi onaylamak ve kitabı almak için merkez yönetimiyle WhatsApp üzerinden iletişime geçin${waEn}.`,
      es: `Su solicitud de compra del e-book «${bookTitle}» (${price} DZD) fue aceptada. Contacte con la administración del centro por WhatsApp${waEn} para confirmar el pago y recibir el libro.`,
    },
  };
}

export function ebookPaidText(opts: { bookTitle: string }): PentaNotification {
  const { bookTitle } = opts;
  return {
    titles: {
      ar: "تم تفعيل كتابك الإلكتروني",
      fr: "Votre e-book est activé",
      en: "Your e-book is now active",
      tr: "E-kitabınız etkinleştirildi",
      es: "Su e-book está activado",
    },
    bodies: {
      ar: `مبروك! تم تأكيد دفع الكتاب «${bookTitle}» وتفعيله — يمكنك الآن قراءته وفتح رابط Google Drive الخاص به من صفحة الكتب الإلكترونية.`,
      fr: `Félicitations ! Le paiement de l'e-book « ${bookTitle} » est confirmé et il est activé — vous pouvez maintenant le lire et ouvrir son lien Google Drive depuis la page E-books.`,
      en: `Congratulations! Payment for the e-book "${bookTitle}" is confirmed and it is now active — you can read it and open its Google Drive link from the E-books page.`,
      tr: `Tebrikler! «${bookTitle}» e-kitabının ödemesi onaylandı ve etkinleştirildi — artık E-kitaplar sayfasından okuyabilir ve Google Drive bağlantısını açabilirsiniz.`,
      es: `¡Felicidades! El pago del e-book «${bookTitle}» fue confirmado y está activado — ya puede leerlo y abrir su enlace de Google Drive desde la página de E-books.`,
    },
  };
}

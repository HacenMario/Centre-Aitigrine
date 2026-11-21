/**
 * الإشعارات الداخلية
 * GET: قائمة إشعاراتي + الإشعارات الجماعية المرئية لي — POST: تعليم كمقروء (id أو الكل)
 * DELETE v3.6: حذف إشعاراتي (الكل، أو id واحد)
 * ★ v3.29.0: الإشعار الجماعي (broadcast بلا userId) مشترك بين المستخدمين:
 *   يظهر لمن سُجِّل عند إنشائه أو بعده، وقراءته لكل مستخدم تُتتبع بمؤشر
 *   broadcastReadAt في ملفه بدل حقل read المشترك — إشعارات الأفراد بلا أي تغيير
 */
import { NextRequest } from "next/server";
import { ok, handle } from "@/lib/api-helpers";
import { Notification, User } from "@/lib/models";
import { requireUser } from "@/lib/auth";

type NotifRow = {
  _id: unknown;
  broadcast?: boolean;
  createdAt?: Date | string;
  read?: boolean;
  title?: string;
  body?: string;
  titles?: Record<string, string>;
  bodies?: Record<string, string>;
  kind?: string;
  link?: string;
};

const toDate = (v: Date | string | undefined | null): Date =>
  v ? new Date(v as unknown as string) : new Date();

/* قراءتي للجماعي: تقدم مؤشري إلى اللحظة المعطاة إن كانت أبعد */
async function markBroadcastRead(me: { _id: unknown; broadcastReadAt?: Date | null }, at: Date) {
  if (!me.broadcastReadAt || me.broadcastReadAt < at) {
    await User.updateOne({ _id: me._id }, { $set: { broadcastReadAt: at } });
  }
}

export async function GET() {
  return handle(async () => {
    const me = await requireUser();
    const rows = await Notification.find({ userId: me._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean<NotifRow[]>();
    /* الجماعي يُرى مَن سُجِّل عند إنشائه أو بعده — وصول المسجلين حالياً يحدده
       الإداري عند الإرسال (نسخ شخصية فورية) فلا تكرار ولا إشعار غير مطلوب */
    const broadcasts = await Notification.find({ broadcast: true })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean<NotifRow[]>();
    const registeredAt = me.createdAt ? toDate(me.createdAt as Date | string) : null;
    const seenAt = me.broadcastReadAt ? toDate(me.broadcastReadAt as Date | string) : null;
    let unread = await Notification.countDocuments({ userId: me._id, read: false });
    const merged: Array<NotifRow & Record<string, unknown>> = [...rows];
    for (const d of broadcasts) {
      const at = toDate(d.createdAt);
      if (registeredAt && at > registeredAt) continue;
      const isRead = Boolean(seenAt && at <= seenAt);
      if (!isRead) unread += 1;
      merged.push({ ...d, read: isRead });
    }
    merged.sort(
      (a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()
    );
    return ok({ notifications: merged.slice(0, 50), unread });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    const b = await req.json().catch(() => ({}));
    if (b.all) {
      await Notification.updateMany({ userId: me._id, read: false }, { $set: { read: true } });
      /* الجماعي المشترك يُقرأ بمؤشري — يظل ظاهراً كمقروء كما في سلوك المقروء الفردي */
      await markBroadcastRead(me, new Date());
    } else if (b.id) {
      const doc = await Notification.findById(b.id).lean<NotifRow | null>();
      if (doc?.broadcast) {
        await markBroadcastRead(me, toDate(doc.createdAt));
      } else {
        await Notification.updateOne({ _id: b.id, userId: me._id }, { $set: { read: true } });
      }
    }
    return ok();
  });
}

/* v3.6: حذف الكل أو إشعار واحد — يخص إشعارات المستخدم حصراً */
export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (id) {
      const doc = await Notification.findById(id).lean<NotifRow | null>();
      if (doc?.broadcast) {
        /* الجماعي مشترك فلا يُحذف عن الجميع — «حذفه عندي» = تعليمه مقروءاً عندي */
        await markBroadcastRead(me, toDate(doc.createdAt));
      } else {
        await Notification.deleteOne({ _id: id, userId: me._id });
      }
    } else {
      await Notification.deleteMany({ userId: me._id });
      await markBroadcastRead(me, new Date());
    }
    return ok();
  });
}

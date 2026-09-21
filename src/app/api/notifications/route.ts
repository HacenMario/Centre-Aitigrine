/**
 * الإشعارات الداخلية
 * GET: قائمة إشعاراتي — POST: تعليم كمقروء (id أو الكل)
 * DELETE v3.6: حذف إشعاراتي (الكل، أو id واحد)
 */
import { NextRequest } from "next/server";
import { ok, handle } from "@/lib/api-helpers";
import { Notification } from "@/lib/models";
import { requireUser } from "@/lib/auth";

export async function GET() {
  return handle(async () => {
    const me = await requireUser();
    const rows = await Notification.find({ userId: me._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const unread = await Notification.countDocuments({ userId: me._id, read: false });
    return ok({ notifications: rows, unread });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    const b = await req.json().catch(() => ({}));
    if (b.all) {
      await Notification.updateMany({ userId: me._id, read: false }, { $set: { read: true } });
    } else if (b.id) {
      await Notification.updateOne({ _id: b.id, userId: me._id }, { $set: { read: true } });
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
      await Notification.deleteOne({ _id: id, userId: me._id });
    } else {
      await Notification.deleteMany({ userId: me._id });
    }
    return ok();
  });
}

"use client";
/**
 * تفعيل إشعارات الجهاز (Web Push VAPID) — منطق مشترك بين جرس الإشعارات ومساعد التثبيت
 * كل الرسائل مترجمة ×3 (طلب المستخدم: نوافذ Toast مترجمة بالكامل)
 */
import { toast } from "sonner";
import { dicts } from "@/lib/app-context";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function msg(key: string): string {
  if (typeof window === "undefined") return key;
  try {
    const lang = (localStorage.getItem("ait_lang") || "ar") as "ar" | "fr" | "en" | "tr" | "es";
    const d = dicts[lang] || dicts.ar;
    return d[key] || dicts.ar[key] || key;
  } catch {
    return dicts.ar[key] || key;
  }
}

export async function enablePushNotifications(successMsg?: string): Promise<boolean> {
  try {
    if (typeof Notification === "undefined") {
      toast.error(msg("push.unsupported"));
      return false;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      toast.error(msg("push.denied"));
      return false;
    }
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const keyRes = await fetch("/api/push");
    const { publicKey } = await keyRes.json();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
    });
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    if (res.ok) {
      toast.success(successMsg || msg("header.pushOn"));
      return true;
    }
    toast.error(msg("push.failed"));
    return false;
  } catch {
    toast.error(msg("push.failed"));
    return false;
  }
}

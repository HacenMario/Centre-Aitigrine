/**
 * تسجيل الخروج — التوكن يُمحى من جهاز العميل (بلا جلسات خادم — نمط طمأنينة)
 */
import { ok, handle } from "@/lib/api-helpers";

export async function POST() {
  return handle(async () => ok());
}

/**
 * تكوين Google المشترك (توكن التوقيع + دوال الإعداد) — يفصل لتفادي الاستيراد الدائري
 */
export function tokenSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.ADMIN_PASSCODE ||
    process.env.VAPID_SUBJECT ||
    "ait-tegrine-center-secret"
  );
}

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

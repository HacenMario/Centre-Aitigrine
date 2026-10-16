#!/usr/bin/env python3
"""
عناصر اختبار مرئية للمتصفح — v3.21.0
ينشئ: مقال + تكوين + إعلان بأغلفة ملونة حقيقية (500×340)
ويحفظ المعرفات في scripts/browser-fixtures.json للتنظيف لاحقاً
"""
import json, urllib.request, io
from PIL import Image, ImageDraw

BASE = "http://localhost:3000"

def make_cover(rgb, label):
    img = Image.new("RGB", (500, 340), rgb)
    d = ImageDraw.Draw(img)
    d.rectangle([20, 20, 479, 319], outline=(255, 255, 255), width=4)
    d.text((40, 40), label, fill=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=88)
    import base64
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

def req(path, data=None, token=None, method=None):
    url = BASE + path
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, method=method or ("POST" if body else "GET"))
    r.add_header("Content-Type", "application/json")
    if token: r.add_header("x-auth-token", token)
    with urllib.request.urlopen(r, timeout=30) as res:
        return json.loads(res.read().decode())

# دخول الإدارة
tok = req("/api/auth/admin-login", {"phone": "0550000001", "password": "Pass1234!"})["token"]
print("admin token ok")

c1 = make_cover((13, 122, 111), "Article Test 321")
c2 = make_cover((180, 90, 30), "Course Test 321")
c3 = make_cover((90, 60, 160), "Ad Test 321")

art = req("/api/articles", {
    "title": "كيف يعزز الاستماع الفعّال صحة الطفل النفسية؟",
    "summary": "دليل عملي مختصر لأولياء الأمور حول تقنيات الاستماع الفعّال وأثره المباشر على التوازن النفسي للطفل.",
    "content": "الاستماع الفعّال ليس مجرد سماع للكلمات، بل هو مهارة تربوية عميقة.\n\nمن خلال إشراك الطفل في حوار حقيقي، يشعر الطفل بالأمان النفسي، ويتعلم التعبير عن مشاعره بحرية.\n\nفي هذا المقال نستعرض ثلاث تقنيات مثبتة علمياً مع أمثلة عملية من الجلسات الأرطفونية.",
    "category": "psychology",
    "coverBase64": c1,
    "active": True,
}, tok)["article"]["_id"]

crs = req("/api/courses", {
    "title": "تكوين أرطفونية تطبيقية — الدفعة 12",
    "description": "تكوين معتمد لمدة أسبوعين: أسس التشخيص، تمارين النطق، وورشات عملية مع متابعة فردية لكل مكوَّن.",
    "price": 0, "capacity": 0, "trainerName": "أ. أمينة ورتني",
    "coverBase64": c2, "images": [], "sessions": [], "active": True,
}, tok)["course"]["_id"]

ad = req("/api/ads", {
    "action": "create",
    "title": "افتتاح مجموعة النطق الجديدة للأطفال",
    "body": "تبدأ مجموعة النطق الجديدة للأطفال (6-10 سنوات) أول الشهر القادم — المقاعد محدودة والتسجيل مفتوح الآن عبر صفحة المواعيد.",
    "media": [c3], "publish": True,
}, tok)
ad_id = ad.get("ad", {}).get("_id") or ad.get("id") or ad.get("_id")

fixtures = {"token": tok, "article": art, "course": crs, "ad": ad_id}
with open("scripts/browser-fixtures.json", "w") as f:
    json.dump(fixtures, f, ensure_ascii=False)
print(json.dumps(fixtures, ensure_ascii=False))

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
تحليل تصدير Compass لمجموعة media.chunks (GridFS)
- يجمع القطع حسب files_id
- يحدد نوع كل ملف من أول بايتاته (magic bytes)
- يطبع جدول أكبر الملفات + ملخصاً حسب النوع
"""
import json, base64, sys
from collections import defaultdict

PATH = "/tmp/media-chunks.json"

def human(n):
    for u in ["B", "KB", "MB", "GB"]:
        if n < 1024 or u == "GB":
            return f"{n:,.1f} {u}" if u != "B" else f"{int(n)} B"
        n /= 1024

def sniff(b):
    if b[:3] == b"\xff\xd8\xff": return "JPEG صورة"
    if b[:8] == b"\x89PNG\r\n\x1a\n": return "PNG صورة"
    if b[:3] == b"GIF": return "GIF صورة"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP": return "WebP صورة"
    if b[4:8] == b"ftyp":
        brand = b[8:12].decode("ascii", "ignore")
        return f"MP4 فيديو ({brand})"
    if b[:4] == b"\x1a\x45\xdf\xa3": return "WebM/MKV فيديو"
    return "غير معروف"

def main():
    with open(PATH, "r", encoding="utf-8") as f:
        docs = json.load(f)

    files = defaultdict(lambda: {"bytes": 0, "chunks": 0, "first": None})
    for d in docs:
        fid = d["files_id"]["$oid"]
        b64 = d["data"]["$binary"]["base64"]
        raw_len = len(b64) * 3 // 4 - (2 if b64.endswith("==") else 1 if b64.endswith("=") else 0)
        rec = files[fid]
        rec["bytes"] += raw_len
        rec["chunks"] += 1
        if d.get("n") == 0 and rec["first"] is None:
            rec["first"] = base64.b64decode(b64[:64] + "==")[:32]

    total = sum(r["bytes"] for r in files.values())
    print(f"المجموع: {len(files)} ملفاً في {len(docs):,} قطعة — {human(total)}")
    print()

    rows = sorted(files.items(), key=lambda kv: -kv[1]["bytes"])
    print(f"{'#':>3}  {'النوع':<22} {'الحجم':>12}  {'قطع':>5}  files_id")
    by_type = defaultdict(lambda: [0, 0])
    for i, (fid, r) in enumerate(rows, 1):
        t = sniff(r["first"]) if r["first"] else "؟"
        by_type[t][0] += 1
        by_type[t][1] += r["bytes"]
        print(f"{i:>3}  {t:<22} {human(r['bytes']):>12}  {r['chunks']:>5}  {fid[:12]}…")
    print()
    print("الملخص حسب النوع:")
    for t, (c, b) in sorted(by_type.items(), key=lambda kv: -kv[1][1]):
        print(f"  {t:<24} {c:>4} ملف   {human(b):>12}  ({b*100/total:.1f}%)")

    imgs = sum(b for t, (c, b) in by_type.items() if "صورة" in t)
    vids = sum(b for t, (c, b) in by_type.items() if "فيديو" in t)
    print()
    print(f"إذا ضُغطت الصور القديمة بنسبة 85-95%: توفير متوقع ~{human(imgs*0.9)}")
    print(f"الفيديو غير مضغوط في v3.17 — يبقى {human(vids)} كما هو")

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()

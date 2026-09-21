import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";

export async function GET() {
  try {
    await connectDB();
    return NextResponse.json({
      ok: true,
      app: "مركز أيت تقرين",
      db: "connected",
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { ok: false, app: "مركز أيت تقرين", db: "disconnected" },
      { status: 503 }
    );
  }
}

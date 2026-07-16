import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminOtp } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { phone, code } = await request.json();

    if (!phone || !code) {
      return NextResponse.json({ error: "Phone and code required" }, { status: 400 });
    }

    const result = await verifyAdminOtp(phone, code);

    if (!result.success || !result.token) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set("admin_session", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    });

    return NextResponse.json({ message: "Login successful" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

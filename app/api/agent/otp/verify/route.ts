import { NextResponse } from "next/server";
import { verifyAgentOtp } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { phone, code } = (await req.json()) as { phone?: string; code?: string };

    if (!phone || !code) {
      return NextResponse.json({ error: "Phone and code are required" }, { status: 400 });
    }

    const result = await verifyAgentOtp(phone, code);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const response = NextResponse.json({ message: "Authenticated" });

    response.cookies.set("agent_session", result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 12 * 60 * 60,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}

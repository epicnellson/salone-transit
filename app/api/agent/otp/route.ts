import { NextResponse } from "next/server";
import { requestAgentOtp } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { phone } = (await req.json()) as { phone?: string };

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const result = await requestAgentOtp(phone);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 403 });
    }

    return NextResponse.json({ message: result.message });
  } catch {
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}

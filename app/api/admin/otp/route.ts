import { NextResponse } from "next/server";
import { requestAdminOtp } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    const result = await requestAdminOtp(phone);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 401 });
    }

    return NextResponse.json({ message: result.message });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

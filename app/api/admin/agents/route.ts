import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminFromSession, verifySessionToken } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  if (!session) return null;
  const token = verifySessionToken(session);
  if (!token) return null;
  return getAdminFromSession(session);
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("agents")
    .select("*, user:users(phone, name)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const agentsWithCommission = await Promise.all(
    (data || []).map(async (agent) => {
      const { data: verifications } = await supabase
        .from("verifications")
        .select("commission_amount")
        .eq("agent_id", agent.id);

      const totalCommission = (verifications || []).reduce(
        (sum, v) => sum + (v.commission_amount || 0),
        0
      );

      return {
        ...agent,
        totalCommission,
        verificationCount: verifications?.length || 0,
      };
    })
  );

  return NextResponse.json(agentsWithCommission);
}

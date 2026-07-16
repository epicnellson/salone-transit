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

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const routeId = searchParams.get("route_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("bookings")
    .select("*, route:routes(id, origin, destination), wave:waves(departure_label)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (routeId) query = query.eq("route_id", routeId);
  if (dateFrom) query = query.gte("created_at", dateFrom + "T00:00:00");
  if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    bookings: data,
    total: count,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

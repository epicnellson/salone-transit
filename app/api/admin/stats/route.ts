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
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const { data: todayBookings } = await supabase
    .from("bookings")
    .select("id, status, total_amount, seat_count, created_at, wave:waves(departure_label, departure_time)")
    .gte("created_at", todayStr);

  const { count: totalBookings } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true });

  const { data: allBookings } = await supabase
    .from("bookings")
    .select("id, status, total_amount, seat_count, created_at, wave:waves(departure_label, departure_time)")
    .order("created_at", { ascending: true });

  const { count: verifiedCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "paid");

  const { count: completedVerifications } = await supabase
    .from("verifications")
    .select("id", { count: "exact", head: true });

  const totalRevenue = (todayBookings || [])
    .filter((b) => b.status === "paid")
    .reduce((sum, b) => sum + (b.total_amount || 0), 0);

  const totalRevenueAll = (allBookings || [])
    .filter((b) => b.status === "paid")
    .reduce((sum, b) => sum + (b.total_amount || 0), 0);

  const verificationRate = (verifiedCount || 0) > 0
    ? Math.round(((completedVerifications || 0) / (verifiedCount || 1)) * 100)
    : 0;

  const now = new Date();
  let noShowCount = 0;
  let noShowPaid = 0;

  (allBookings || []).forEach((b) => {
    if (b.status !== "paid") return;
    noShowPaid++;
    const wave = b.wave as { departure_label?: string; departure_time?: string } | null;
    if (!wave) return;

    const depTime = wave.departure_time || wave.departure_label;
    if (!depTime) return;

    let depDate: Date | null = null;
    if (wave.departure_time) {
      depDate = new Date(wave.departure_time);
    } else {
      const match = depTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (match) {
        let h = parseInt(match[1]);
        const m = parseInt(match[2]);
        const ampm = match[3].toUpperCase();
        if (ampm === "PM" && h !== 12) h += 12;
        if (ampm === "AM" && h === 12) h = 0;
        const bDate = new Date(b.created_at);
        depDate = new Date(bDate);
        depDate.setHours(h, m, 0, 0);
      }
    }

    if (depDate && now > depDate) {
      noShowCount++;
    }
  });

  const noShowRate = noShowPaid > 0 ? Math.round((noShowCount / noShowPaid) * 100) : 0;

  const dailyMap: Record<string, { bookings: number; revenue: number }> = {};
  (allBookings || []).forEach((b) => {
    const day = b.created_at.slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { bookings: 0, revenue: 0 };
    dailyMap[day].bookings++;
    if (b.status === "paid") dailyMap[day].revenue += b.total_amount || 0;
  });

  const dailyEntries = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14);

  return NextResponse.json({
    todayBookings: todayBookings?.length || 0,
    totalBookings: totalBookings || 0,
    todayRevenue: totalRevenue,
    totalRevenue: totalRevenueAll,
    verificationRate,
    noShowRate,
    dailyBookings: dailyEntries.map(([date, d]) => ({
      date,
      label: new Date(date + "T00:00:00").toLocaleDateString("en-SL", { month: "short", day: "numeric" }),
      value: d.bookings,
    })),
    dailyRevenue: dailyEntries.map(([date, d]) => ({
      date,
      label: new Date(date + "T00:00:00").toLocaleDateString("en-SL", { month: "short", day: "numeric" }),
      value: d.revenue,
    })),
  });
}

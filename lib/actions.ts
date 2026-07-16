"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface CreateBookingInput {
  phone: string;
  name: string;
  routeId: string;
  waveId: string;
  seatCount: number;
}

function generateTicketCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "ST-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createBooking(input: CreateBookingInput) {
  const { phone, name, routeId, waveId, seatCount } = input;

  const normalizedPhone = phone.replace(/\s/g, "").replace(/^(\+232|232)/, "0");

  const { data: existingUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("phone", normalizedPhone)
    .single();

  let userId = existingUser?.id;

  if (!userId) {
    const { data: newUser, error: userError } = await supabaseAdmin
      .from("users")
      .insert({ phone: normalizedPhone, name, role: "passenger" })
      .select("id")
      .single();

    if (userError) {
      throw new Error("Failed to create user account. Please try again.");
    }
    userId = newUser.id;
  }

  const ticketCode = generateTicketCode();

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .insert({
      user_id: userId,
      route_id: routeId,
      wave_id: waveId,
      seat_count: seatCount,
      ticket_code: ticketCode,
      status: "pending",
    })
    .select("id")
    .single();

  if (bookingError) {
    throw new Error("Failed to create booking. Please try again.");
  }

  revalidatePath("/book");
  redirect(`/book/confirm/${booking.id}`);
}

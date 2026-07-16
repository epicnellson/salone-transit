import { getSupabase } from "@/lib/supabase";
import { sendSms } from "@/lib/sms";
import { createHmac, randomBytes } from "crypto";

const OTP_EXPIRY_MINUTES = 5;
const SESSION_EXPIRY_HOURS = 12;

function generateOtp(): string {
  const chars = "0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function signSessionToken(token: string): string {
  const secret = process.env.SESSION_SECRET || "salone-transit-dev-secret";
  const signature = createHmac("sha256", secret).update(token).digest("hex");
  return `${token}.${signature}`;
}

export function verifySessionToken(signed: string): string | null {
  const dotIndex = signed.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const token = signed.substring(0, dotIndex);
  const signature = signed.substring(dotIndex + 1);

  const secret = process.env.SESSION_SECRET || "salone-transit-dev-secret";
  const expected = createHmac("sha256", secret).update(token).digest("hex");

  if (signature !== expected) return null;
  return token;
}

export async function requestAgentOtp(phone: string): Promise<{
  success: boolean;
  message: string;
}> {
  const supabase = getSupabase();
  const normalized = normalizePhone(phone);

  const { data: user } = await supabase
    .from("users")
    .select("id, role")
    .eq("phone", normalized)
    .single();

  if (!user || user.role !== "agent") {
    return { success: false, message: "Phone number not registered as an agent." };
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return { success: false, message: "Agent profile not found." };
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  await supabase.from("otp_codes").insert({
    phone: normalized,
    code,
    expires_at: expiresAt,
  });

  const smsMessage = `Salone Transit Agent: Your verification code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`;
  await sendSms(normalized, smsMessage, "agent_otp");

  return { success: true, message: "Verification code sent." };
}

export async function verifyAgentOtp(
  phone: string,
  code: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  const supabase = getSupabase();
  const normalized = normalizePhone(phone);

  const { data: otp } = await supabase
    .from("otp_codes")
    .select("id, expires_at")
    .eq("phone", normalized)
    .eq("code", code)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!otp) {
    return { success: false, error: "Invalid or expired code." };
  }

  await supabase.from("otp_codes").update({ used: true }).eq("id", otp.id);

  const { data: user } = await supabase
    .from("users")
    .select("id, role")
    .eq("phone", normalized)
    .single();

  if (!user || user.role !== "agent") {
    return { success: false, error: "Not authorized as an agent." };
  }

  const token = generateSessionToken();
  const expiresAt = new Date(
    Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000
  ).toISOString();

  await supabase.from("agent_sessions").insert({
    user_id: user.id,
    token,
    expires_at: expiresAt,
  });

  const signed = signSessionToken(token);
  return { success: true, token: signed };
}

export async function getAgentFromSession(
  signedToken: string
): Promise<{ userId: string; agentId: string; stationLocation: string; commissionRate: number } | null> {
  const token = verifySessionToken(signedToken);
  if (!token) return null;

  const supabase = getSupabase();

  const { data: session } = await supabase
    .from("agent_sessions")
    .select("user_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) return null;

  const { data: agent } = await supabase
    .from("agents")
    .select("id, station_location, commission_rate")
    .eq("user_id", session.user_id)
    .single();

  if (!agent) return null;

  return {
    userId: session.user_id,
    agentId: agent.id,
    stationLocation: agent.station_location,
    commissionRate: agent.commission_rate,
  };
}

export async function requestAdminOtp(phone: string): Promise<{
  success: boolean;
  message: string;
}> {
  const supabase = getSupabase();
  const normalized = normalizePhone(phone);

  const { data: user } = await supabase
    .from("users")
    .select("id, role")
    .eq("phone", normalized)
    .single();

  if (!user || user.role !== "admin") {
    return { success: false, message: "Phone number not registered as an admin." };
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  await supabase.from("otp_codes").insert({
    phone: normalized,
    code,
    expires_at: expiresAt,
  });

  const smsMessage = `Salone Transit Admin: Your verification code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`;
  await sendSms(normalized, smsMessage, "admin_otp");

  return { success: true, message: "Verification code sent." };
}

export async function verifyAdminOtp(
  phone: string,
  code: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  const supabase = getSupabase();
  const normalized = normalizePhone(phone);

  const { data: otp } = await supabase
    .from("otp_codes")
    .select("id, expires_at")
    .eq("phone", normalized)
    .eq("code", code)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!otp) {
    return { success: false, error: "Invalid or expired code." };
  }

  await supabase.from("otp_codes").update({ used: true }).eq("id", otp.id);

  const { data: user } = await supabase
    .from("users")
    .select("id, role")
    .eq("phone", normalized)
    .single();

  if (!user || user.role !== "admin") {
    return { success: false, error: "Not authorized as an admin." };
  }

  const token = generateSessionToken();
  const expiresAt = new Date(
    Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000
  ).toISOString();

  await supabase.from("agent_sessions").insert({
    user_id: user.id,
    token,
    expires_at: expiresAt,
  });

  const signed = signSessionToken(token);
  return { success: true, token: signed };
}

export async function getAdminFromSession(
  signedToken: string
): Promise<{ userId: string; role: string } | null> {
  const token = verifySessionToken(signedToken);
  if (!token) return null;

  const supabase = getSupabase();

  const { data: session } = await supabase
    .from("agent_sessions")
    .select("user_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) return null;

  const { data: user } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", session.user_id)
    .single();

  if (!user || user.role !== "admin") return null;

  return { userId: user.id, role: user.role };
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("232")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+232${cleaned.slice(1)}`;
  return `+${cleaned}`;
}

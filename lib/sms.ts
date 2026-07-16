import { getSupabase } from "@/lib/supabase";
import { logError, logInfo, logWarn } from "@/lib/logger";

const AT_SANDBOX_URL = "https://api.sandbox.africastalking.com/version1/messaging";
const AT_LIVE_URL = "https://api.africastalking.com/version1/messaging";

interface SmsRecipient {
  statusCode: number;
  number: string;
  status: string;
  messageId: string;
  cost: string;
}

interface SmsResponse {
  SMSMessageData: {
    Message: string;
    Recipients: SmsRecipient[];
  };
}

export interface SmsLogEntry {
  phone: string;
  message: string;
  purpose: string;
  status: "sent" | "failed";
  provider_message_id: string | null;
  provider_status: string | null;
  provider_response: string | null;
  cost: string | null;
}

async function logSms(entry: SmsLogEntry): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from("sms_logs").insert({
      phone: entry.phone,
      message: entry.message,
      purpose: entry.purpose,
      status: entry.status,
      provider_message_id: entry.provider_message_id,
      provider_status: entry.provider_status,
      provider_response: entry.provider_response,
      cost: entry.cost,
    });
  } catch (err) {
    logError("Failed to log SMS", {
      phone: entry.phone,
      purpose: entry.purpose,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function getConfig() {
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;
  const senderId = process.env.AT_SENDER_ID || undefined;
  const isSandbox = process.env.AT_SANDBOX === "true";

  if (!apiKey || !username) {
    return null;
  }

  const baseUrl = isSandbox ? AT_SANDBOX_URL : AT_LIVE_URL;
  return { apiKey, username, senderId, baseUrl };
}

export async function sendSms(
  phone: string,
  message: string,
  purpose: string = "general"
): Promise<boolean> {
  const config = getConfig();

  if (!config) {
    logInfo("SMS stub (no credentials)", { phone, purpose });
    await logSms({
      phone,
      message,
      purpose,
      status: "sent",
      provider_message_id: null,
      provider_status: "stub_no_credentials",
      provider_response: "AT_API_KEY/AT_USERNAME not configured — message logged but not sent",
      cost: null,
    });
    return true;
  }

  const normalizedPhone = normalizePhone(phone);

  try {
    const body = new URLSearchParams({
      username: config.username,
      to: normalizedPhone,
      message,
    });

    if (config.senderId) {
      body.set("from", config.senderId);
    }

    const res = await fetch(config.baseUrl, {
      method: "POST",
      headers: {
        apiKey: config.apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data: SmsResponse = await res.json();
    const recipients = data.SMSMessageData?.Recipients ?? [];
    const first = recipients[0];

    const isSuccess = first && first.statusCode === 102;

    await logSms({
      phone: normalizedPhone,
      message,
      purpose,
      status: isSuccess ? "sent" : "failed",
      provider_message_id: first?.messageId ?? null,
      provider_status: first?.status ?? null,
      provider_response: JSON.stringify(data),
      cost: first?.cost ?? null,
    });

    if (isSuccess) {
      logInfo("SMS sent", { phone: normalizedPhone, purpose, messageId: first.messageId });
    } else {
      logWarn("SMS failed", { phone: normalizedPhone, purpose, response: data });
    }

    return isSuccess;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";

    await logSms({
      phone: normalizedPhone,
      message,
      purpose,
      status: "failed",
      provider_message_id: null,
      provider_status: "exception",
      provider_response: errorMsg,
      cost: null,
    });

    logError("SMS exception", {
      phone: normalizedPhone,
      purpose,
      error: errorMsg,
    });
    return false;
  }
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, "");

  if (cleaned.startsWith("+")) return cleaned;

  if (cleaned.startsWith("232")) return `+${cleaned}`;

  if (cleaned.startsWith("0")) return `+232${cleaned.slice(1)}`;

  return `+${cleaned}`;
}

import { randomUUID } from "crypto";
import { createHmac, timingSafeEqual } from "crypto";

const MONIME_BASE_URL = "https://api.monime.io";

function getConfig() {
  const token = process.env.MONIME_ACCESS_TOKEN;
  const spaceId = process.env.MONIME_SPACE_ID;

  if (!token || !spaceId) {
    throw new Error("MONIME_ACCESS_TOKEN and MONIME_SPACE_ID must be set");
  }

  return { token, spaceId };
}

export interface MonimeCheckoutLineItem {
  type: "custom";
  name: string;
  price: { currency: "SLE"; value: number };
  quantity: number;
  description?: string;
  reference?: string;
}

export interface MonimeCheckoutSession {
  id: string;
  status: string;
  redirectUrl: string;
  orderNumber: string | null;
  reference: string | null;
}

export async function createCheckoutSession(opts: {
  name: string;
  reference: string;
  lineItems: MonimeCheckoutLineItem[];
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<MonimeCheckoutSession> {
  const { token, spaceId } = getConfig();

  const res = await fetch(`${MONIME_BASE_URL}/v1/checkout-sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Monime-Space-Id": spaceId,
      "Idempotency-Key": randomUUID(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: opts.name,
      reference: opts.reference,
      successUrl: opts.successUrl,
      cancelUrl: opts.cancelUrl,
      lineItems: opts.lineItems,
      metadata: opts.metadata,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Monime checkout session creation failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  return json.result;
}

export async function getCheckoutSession(
  sessionId: string
): Promise<MonimeCheckoutSession> {
  const { token, spaceId } = getConfig();

  const res = await fetch(`${MONIME_BASE_URL}/v1/checkout-sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Monime-Space-Id": spaceId,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Monime get checkout session failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  return json.result;
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader) return false;

  const secret = process.env.MONIME_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected =
    "sha256=" +
    createHmac("sha256", secret).update(rawBody).digest("hex");

  const sigBuffer = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expected);

  if (sigBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(sigBuffer, expectedBuffer);
}

export interface MonimeWebhookEvent {
  apiVersion: string;
  event: {
    id: string;
    name: string;
    timestamp: string;
  };
  object: {
    id: string;
    type: string;
  };
  data: Record<string, unknown>;
}

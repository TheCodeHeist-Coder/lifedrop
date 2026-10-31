import twilio from "twilio";
import { config } from "./config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string) => UUID.test(value);

export const fail = (message: string, status = 400) => Response.json({ error: message }, { status });

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

export const text = (value: unknown, maxLength = 200) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

// Reads a Twilio webhook and proves it really came from Twilio. Without this,
// anyone could post a fake YES and receive the family's phone number.
export async function readTwilioWebhook(request: Request, path: string): Promise<Record<string, string> | null> {
  const { authToken } = config.twilio;
  if (!authToken || !config.publicUrl) return null;

  const form = await request.formData();
  const params = Object.fromEntries(
    [...form.entries()].map(([key, value]) => [key, String(value)]),
  );
  const signature = request.headers.get("x-twilio-signature") ?? "";
  const valid = twilio.validateRequest(authToken, signature, `${config.publicUrl}${path}`, params);
  return valid ? params : null;
}

import twilio from "twilio";
import { config } from "./config";
import { query } from "./db";

type Outgoing = {
  to: string;
  body: string;
  requestId?: string | null;
  simulated?: boolean;
};

declare global {
  var lifedropSendQueue: Promise<void> | undefined;
}

export function twilioEnabled(): boolean {
  return Boolean(config.twilio.accountSid && config.twilio.authToken);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Records the message, then sends it through Twilio when that is configured.
// Simulated donors have numbers that cannot exist and never reach Twilio; their
// messages appear in the demo console instead.
export async function sendWhatsApp({ to, body, requestId = null, simulated = false }: Outgoing): Promise<void> {
  const sendForReal = twilioEnabled() && !simulated;
  const [message] = await query<{ id: string }>(
    `INSERT INTO messages (phone, direction, body, status, request_id, simulated)
     VALUES ($1, 'out', $2, $3, $4, $5) RETURNING id`,
    [to, body, sendForReal ? "queued" : "simulated", requestId, !sendForReal],
  );
  if (!sendForReal) return;

  // One at a time, because the sandbox rejects anything faster than one message
  // every three seconds. This queue lives in memory, so the app must run as a
  // single long-lived server rather than serverless functions.
  const previous = globalThis.lifedropSendQueue ?? Promise.resolve();
  globalThis.lifedropSendQueue = previous
    .then(() => deliver(message.id, to, body))
    .catch((error) => console.error("WhatsApp delivery failed", error))
    .then(() => sleep(config.twilio.sendSpacingMs));
}

async function deliver(messageId: string, to: string, body: string): Promise<void> {
  try {
    const client = twilio(config.twilio.accountSid, config.twilio.authToken);
    const sent = await client.messages.create({
      from: config.twilio.from,
      to: `whatsapp:${to}`,
      body,
      ...(config.publicUrl ? { statusCallback: `${config.publicUrl}/api/whatsapp/status` } : {}),
    });
    await query(`UPDATE messages SET status = $2, provider_sid = $3 WHERE id = $1`, [
      messageId,
      sent.status,
      sent.sid,
    ]);
  } catch (error) {
    await markFailed(`id = $1`, messageId, error instanceof Error ? error.message : String(error));
  }
}

// Twilio reports most WhatsApp failures after accepting the message, through the
// status callback. Error 63015 means the number has not joined the sandbox.
export async function recordDeliveryStatus(sid: string, status: string, errorCode?: string): Promise<void> {
  if (status === "failed" || status === "undelivered") {
    await markFailed(`provider_sid = $1`, sid, errorCode ? `Twilio error ${errorCode}` : status);
    return;
  }
  await query(`UPDATE messages SET status = $2 WHERE provider_sid = $1`, [sid, status]);
}

// Marks the alert failed as well, so the coordinator moves on instead of waiting
// for a reply from someone who never saw the message.
async function markFailed(where: `${string}$1`, value: string, reason: string): Promise<void> {
  const [message] = await query<{ phone: string; request_id: string | null }>(
    `UPDATE messages SET status = 'failed', error = $2 WHERE ${where} RETURNING phone, request_id`,
    [value, reason],
  );
  if (!message?.request_id) return;

  const failed = await query(
    `UPDATE notifications SET status = 'failed'
     WHERE request_id = $1 AND status = 'pending'
       AND donor_id = (SELECT id FROM donors WHERE phone = $2)
     RETURNING id`,
    [message.request_id, message.phone],
  );
  if (failed.length > 0) {
    await query(`INSERT INTO events (request_id, kind, message) VALUES ($1, 'delivery_failed', $2)`, [
      message.request_id,
      "One donor could not be reached on WhatsApp, moving on",
    ]);
  }
}

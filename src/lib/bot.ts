import { acceptedMessage, findPendingAlert, recordDecision } from "./agent";
import { APP_NAME, config } from "./config";
import { query } from "./db";
import { classifyWithGemini } from "./parse-request";
import { classifyReply } from "./reply";
import { sendWhatsApp } from "./whatsapp";

type DonorRow = {
  id: string;
  name: string;
  available: boolean;
  simulated: boolean;
  whatsapp_verified_at: string | null;
};

const HELP_TEXT = [
  `This is ${APP_NAME}. We alert you when someone nearby needs your blood group.`,
  "",
  "Reply PAUSE to stop alerts for now, RESUME to start them again, or STOP to delete your details.",
].join("\n");

// Handles one inbound WhatsApp message. `simulatedInbound` marks messages typed
// into the demo console, which never come from Twilio.
export async function handleInbound(phone: string, body: string, simulatedInbound = false): Promise<void> {
  await query(
    `INSERT INTO messages (phone, direction, body, status, simulated) VALUES ($1, 'in', $2, 'received', $3)`,
    [phone, body.slice(0, 1000), simulatedInbound],
  );

  const [donor] = await query<DonorRow>(
    `SELECT id, name, available, simulated, whatsapp_verified_at FROM donors WHERE phone = $1`,
    [phone],
  );
  const reply = (text: string, requestId?: string) =>
    sendWhatsApp({ to: phone, body: text, requestId, simulated: simulatedInbound || donor?.simulated });

  if (!donor) {
    const link = config.publicUrl ? ` at ${config.publicUrl}/donate` : " on our website";
    await reply(`Welcome to ${APP_NAME}! Register as a blood donor${link}, then message us here to turn on alerts.`);
    return;
  }

  const firstContact = !donor.whatsapp_verified_at;
  if (firstContact) {
    await query(`UPDATE donors SET whatsapp_verified_at = now() WHERE id = $1`, [donor.id]);
  }

  const intent = classifyReply(body);

  if (intent === "stop") {
    await query(`DELETE FROM donors WHERE id = $1`, [donor.id]);
    await reply("Your details have been deleted and you will get no more alerts. Thank you for signing up.");
    return;
  }
  if (intent === "pause") {
    await query(`UPDATE donors SET available = FALSE WHERE id = $1`, [donor.id]);
    await reply("Alerts paused. Reply RESUME when you are available again.");
    return;
  }
  if (intent === "resume") {
    await query(`UPDATE donors SET available = TRUE WHERE id = $1`, [donor.id]);
    await reply("Alerts are back on. Thank you!");
    return;
  }

  const alert = await findPendingAlert(donor.id);
  if (alert) {
    const decision =
      intent === "accept" || intent === "decline"
        ? intent
        : intent === "unclear"
          ? await classifyWithGemini(body)
          : "unclear";

    if (decision === "unclear") {
      await reply("We need someone who can come in the next few hours. Please reply *YES* or *NO*.", alert.request_id);
      return;
    }

    const result = await recordDecision(alert.id, decision, body, donor.name);
    if (result.outcome === "accepted") {
      await reply(acceptedMessage(result.request), alert.request_id);
    } else if (result.outcome === "declined") {
      await reply("No problem, thank you for replying. We will ask someone else.", alert.request_id);
    } else {
      await reply("Thank you! This request has already been covered, so you do not need to go.", alert.request_id);
    }
    return;
  }

  if (firstContact) {
    await reply(`Thank you, ${donor.name.split(" ")[0]}! You are verified and will get alerts when someone nearby needs you.`);
    return;
  }

  if (intent === "accept" || intent === "decline") {
    const [closed] = await query(
      `SELECT 1 FROM notifications
       WHERE donor_id = $1 AND status = 'closed' AND sent_at > now() - interval '1 day' LIMIT 1`,
      [donor.id],
    );
    if (closed && intent === "accept") {
      await reply("Thank you! This request has already been covered, so you do not need to go.");
      return;
    }
    await reply("There is no open request for you right now. Thank you for checking!");
    return;
  }

  await reply(HELP_TEXT);
}

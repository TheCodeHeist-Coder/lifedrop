import { handleInbound } from "./bot";
import { config } from "./config";
import { query } from "./db";
import { twilioEnabled } from "./whatsapp";

// Everything here is off unless DEMO_MODE=true. These calls can reply as any donor,
// so they must never be reachable on a real deployment.
export const demoEnabled = () => config.demoMode;

type ConversationRow = {
  phone: string;
  direction: "in" | "out";
  body: string;
  created_at: string;
  name: string;
  blood_group: string;
  simulated: boolean;
};

export async function getDemoState() {
  const [messages, [donors], requests] = await Promise.all([
    query<ConversationRow>(
      `SELECT m.phone, m.direction, m.body, m.created_at, d.name, d.blood_group, d.simulated
       FROM messages m JOIN donors d ON d.phone = m.phone
       ORDER BY m.created_at DESC LIMIT 300`,
    ),
    query<{ total: number; real: number; verified: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE NOT simulated)::int AS real,
              count(*) FILTER (WHERE NOT simulated AND whatsapp_verified_at IS NOT NULL)::int AS verified
       FROM donors`,
    ),
    query<{ id: string; blood_group: string; hospital: string; status: string }>(
      `SELECT id, blood_group, hospital, status FROM requests ORDER BY created_at DESC LIMIT 5`,
    ),
  ]);

  const conversations = new Map<
    string,
    {
      phone: string;
      name: string;
      bloodGroup: string;
      simulated: boolean;
      lastAt: string;
      messages: { direction: "in" | "out"; body: string; at: string }[];
    }
  >();
  for (const message of messages) {
    const conversation = conversations.get(message.phone) ?? {
      phone: message.phone,
      name: message.name,
      bloodGroup: message.blood_group,
      simulated: message.simulated,
      lastAt: message.created_at,
      messages: [],
    };
    conversation.messages.unshift({ direction: message.direction, body: message.body, at: message.created_at });
    conversations.set(message.phone, conversation);
  }

  return {
    twilio: twilioEnabled(),
    gemini: Boolean(config.gemini.apiKey),
    donors,
    requests,
    conversations: [...conversations.values()],
  };
}

export async function replyFromAllPending(text: string): Promise<number> {
  const donors = await query<{ phone: string }>(
    `SELECT DISTINCT d.phone
     FROM notifications n
     JOIN donors d ON d.id = n.donor_id
     JOIN requests r ON r.id = n.request_id
     WHERE n.status = 'pending' AND r.status = 'open' AND d.simulated`,
  );
  for (const donor of donors) await handleInbound(donor.phone, text, true);
  return donors.length;
}

export async function resetDemo(): Promise<void> {
  await query(`DELETE FROM messages`);
  await query(`DELETE FROM requests`);
}

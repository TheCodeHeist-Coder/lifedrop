import { readTwilioWebhook } from "@/lib/api";
import { handleInbound } from "@/lib/bot";
import { phoneFromWhatsAppAddress } from "@/lib/phone";

export async function POST(request: Request) {
  const params = await readTwilioWebhook(request, "/api/whatsapp/webhook");
  if (!params) return new Response("Invalid signature", { status: 403 });

  await handleInbound(phoneFromWhatsAppAddress(params.From ?? ""), params.Body ?? "");

  // Replies go out through the send queue, so Twilio gets an empty response.
  return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
}

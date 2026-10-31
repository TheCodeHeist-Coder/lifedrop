import { readTwilioWebhook } from "@/lib/api";
import { recordDeliveryStatus } from "@/lib/whatsapp";

export async function POST(request: Request) {
  const params = await readTwilioWebhook(request, "/api/whatsapp/status");
  if (!params) return new Response("Invalid signature", { status: 403 });

  if (params.MessageSid && params.MessageStatus) {
    await recordDeliveryStatus(params.MessageSid, params.MessageStatus, params.ErrorCode);
  }
  return new Response(null, { status: 204 });
}

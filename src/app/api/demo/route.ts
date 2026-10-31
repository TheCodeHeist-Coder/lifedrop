import { fail, readJson, text } from "@/lib/api";
import { handleInbound } from "@/lib/bot";
import { demoEnabled, getDemoState, replyFromAllPending, resetDemo } from "@/lib/demo";

export async function GET() {
  if (!demoEnabled()) return fail("Not found", 404);
  return Response.json(await getDemoState());
}

export async function POST(request: Request) {
  if (!demoEnabled()) return fail("Not found", 404);
  const body = await readJson(request);

  switch (body.action) {
    case "reply": {
      const phone = text(body.phone, 30);
      const message = text(body.text, 500);
      if (!phone || !message) return fail("Choose a donor and a reply");
      await handleInbound(phone, message, true);
      return Response.json({ ok: true });
    }
    case "reply-all": {
      const message = text(body.text, 500);
      if (!message) return fail("Choose a reply");
      return Response.json({ replied: await replyFromAllPending(message) });
    }
    case "reset":
      await resetDemo();
      return Response.json({ ok: true });
    default:
      return fail("Unknown action");
  }
}

import { markDonated } from "@/lib/agent";
import { fail, isUuid, readJson, text } from "@/lib/api";

export async function POST(request: Request, context: RouteContext<"/api/requests/[id]/donated">) {
  const { id } = await context.params;
  const alertId = text((await readJson(request)).alertId, 40);
  if (!isUuid(id) || !isUuid(alertId)) return fail("Donor not found", 404);

  const marked = await markDonated(id, alertId);
  return marked ? Response.json({ ok: true }) : fail("This donation is already recorded", 409);
}

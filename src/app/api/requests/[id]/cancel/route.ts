import { cancelRequest } from "@/lib/agent";
import { fail, isUuid } from "@/lib/api";

export async function POST(_request: Request, context: RouteContext<"/api/requests/[id]/cancel">) {
  const { id } = await context.params;
  if (!isUuid(id)) return fail("Request not found", 404);

  const cancelled = await cancelRequest(id);
  return cancelled ? Response.json({ ok: true }) : fail("This request is already closed", 409);
}

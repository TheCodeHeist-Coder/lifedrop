import { advanceRequest, getRequestView } from "@/lib/agent";
import { fail, isUuid } from "@/lib/api";

export async function GET(_request: Request, context: RouteContext<"/api/requests/[id]">) {
  const { id } = await context.params;
  if (!isUuid(id)) return fail("Request not found", 404);

  await advanceRequest(id);
  const view = await getRequestView(id);
  return view ? Response.json(view) : fail("Request not found", 404);
}

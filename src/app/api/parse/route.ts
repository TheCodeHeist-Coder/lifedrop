import { fail, readJson, text } from "@/lib/api";
import { parseRequest } from "@/lib/parse-request";

export async function POST(request: Request) {
  const body = await readJson(request);
  const message = text(body.text, 4000);
  if (!message) return fail("Paste a message first");
  return Response.json(await parseRequest(message));
}

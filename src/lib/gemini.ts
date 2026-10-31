import { config } from "./config";

// Returns null on any failure. Every caller has a non-AI path, so a bad key, a
// rate limit or a dropped connection slows a request down without stopping it.
export async function generateJson<T>(system: string, user: string, schema: object): Promise<T | null> {
  const { apiKey, model } = config.gemini;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseJsonSchema: schema,
          },
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) {
      console.error("Gemini request failed", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" ? (JSON.parse(text) as T) : null;
  } catch (error) {
    console.error("Gemini request failed", error);
    return null;
  }
}

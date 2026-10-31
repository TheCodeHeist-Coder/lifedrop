export type ReplyIntent = "accept" | "decline" | "pause" | "resume" | "stop" | "help" | "join" | "unclear";

const normalize = (text: string) =>
  text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[.!,?🙏👍]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

// Whole-message matches only. Looking for "yes" inside a sentence would read
// "yes but I can't come" as an acceptance, and a family would be told help is coming.
const KEYWORDS: Record<Exclude<ReplyIntent, "unclear">, string[]> = {
  accept: [
    "yes", "y", "yes i can", "i can", "i can come", "i will come", "coming", "ok", "okay", "sure", "accept",
    "haan", "han", "ha", "haa", "ji", "ji haan", "aa raha hu", "aa raha hoon", "aa rahi hu", "aa rahi hoon",
    "हाँ", "हां", "जी", "जी हाँ", "जी हां", "आ रहा हूँ", "आ रही हूँ",
  ],
  decline: [
    "no", "n", "no sorry", "sorry", "cant", "can't", "cannot", "not available", "busy", "decline",
    "nahi", "nahin", "nhi", "na", "nahi aa sakta", "nahi aa sakti",
    "नहीं", "ना", "नही",
  ],
  pause: ["pause", "pause alerts", "out of town"],
  resume: ["resume", "start alerts", "available"],
  stop: ["stop", "unsubscribe", "delete", "delete me"],
  help: ["help", "menu", "hi", "hello", "hey", "namaste"],
  join: ["join", "register", "donate", "signup", "sign up"],
};

export function classifyReply(text: string): ReplyIntent {
  const message = normalize(text);
  for (const [intent, words] of Object.entries(KEYWORDS)) {
    if (words.includes(message)) return intent as ReplyIntent;
  }
  return "unclear";
}

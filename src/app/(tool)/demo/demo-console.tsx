"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, ErrorNote, inputClass, postJson, secondaryButtonClass } from "@/components/ui";

type Conversation = {
  phone: string;
  name: string;
  bloodGroup: string;
  simulated: boolean;
  lastAt: string;
  messages: { direction: "in" | "out"; body: string; at: string }[];
};

type DemoState = {
  twilio: boolean;
  gemini: boolean;
  donors: { total: number; real: number; verified: number };
  requests: { id: string; blood_group: string; hospital: string; status: string }[];
  conversations: Conversation[];
};

const SAMPLE_APPEALS = [
  {
    label: "Delhi, forwarded appeal",
    text: `🚨 URGENT 🚨
Need 2 units of B+ve blood at Max Super Speciality Hospital, Saket, New Delhi.
Patient in surgery tomorrow morning.
Contact: Rahul Sharma 98765 43210
Please forward to everyone!!`,
  },
  {
    label: "Hinglish, rare group",
    text: `Bhaiya O negative blood chahiye turant, papa Safdarjung Hospital me admit hain. 1 unit. Call Neha 98765 43211`,
  },
  {
    label: "Remote district",
    text: `Need A- blood at Gadchiroli District Hospital. 1 unit. Contact Suresh 98765 43212`,
  },
];

export function DemoConsole() {
  const [state, setState] = useState<DemoState | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chat = useRef<HTMLDivElement>(null);

  const active = state?.conversations.find((conversation) => conversation.phone === selected) ?? state?.conversations[0];

  useEffect(() => {
    if (chat.current) chat.current.scrollTop = chat.current.scrollHeight;
  }, [active?.phone, active?.messages.length]);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/demo", { cache: "no-store" });
    if (response.status === 404) {
      setDisabled(true);
      return;
    }
    if (response.ok) setState(await response.json());
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 2000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);

  async function send(action: string, extra: object = {}) {
    setError(null);
    try {
      await postJson("/api/demo", { action, ...extra });
      await refresh();
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  if (disabled) return <ErrorNote>Demo mode is off on this server.</ErrorNote>;
  if (!state) return <p className="py-10 text-center text-muted">Loading...</p>;

  return (
    <div className="space-y-5 pt-2">
      <section>
        <h1 className="text-2xl font-bold">Demo console</h1>
        <p className="text-sm text-muted">
          Plays the part of simulated donors. Their messages stay on this page and are never really sent.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone={state.twilio ? "good" : "warn"}>WhatsApp {state.twilio ? "live" : "simulated"}</Badge>
          <Badge tone={state.gemini ? "good" : "warn"}>Gemini {state.gemini ? "on" : "off, using rules"}</Badge>
          <Badge>
            {state.donors.total} donors, {state.donors.verified} real and verified
          </Badge>
        </div>
      </section>

      {error && <ErrorNote>{error}</ErrorNote>}

      <section className="rounded-xl border border-line bg-card p-4">
        <h2 className="font-bold">Sample appeals</h2>
        <p className="text-sm text-muted">
          Copy one, then paste it on the{" "}
          <Link href="/request" className="font-medium text-blood underline underline-offset-4">
            request page
          </Link>
          .
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SAMPLE_APPEALS.map((sample) => (
            <button key={sample.label} type="button" onClick={() => copy(sample.label, sample.text)} className={secondaryButtonClass}>
              {copied === sample.label ? "Copied" : sample.label}
            </button>
          ))}
        </div>
      </section>

      {state.requests.length > 0 && (
        <section className="rounded-xl border border-line bg-card p-4">
          <h2 className="font-bold">Recent requests</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {state.requests.map((request) => (
              <li key={request.id} className="flex justify-between gap-3">
                <Link href={`/r/${request.id}`} className="truncate font-medium text-blood underline-offset-4 hover:underline">
                  {request.blood_group} at {request.hospital}
                </Link>
                <span className="shrink-0 text-muted">{request.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-wrap gap-2">
        <button type="button" onClick={() => send("reply-all", { text: "NO" })} className={secondaryButtonClass}>
          All waiting demo donors say NO
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Delete all requests and messages?")) send("reset");
          }}
          className={secondaryButtonClass}
        >
          Reset demo
        </button>
      </section>

      {active ? (
        <section className="rounded-xl border border-line bg-card">
          <div className="flex gap-2 overflow-x-auto border-b border-line p-3">
            {state.conversations.map((conversation) => (
              <button
                key={conversation.phone}
                type="button"
                onClick={() => setSelected(conversation.phone)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
                  conversation.phone === active.phone ? "bg-ink text-white" : "bg-line/60 text-ink"
                }`}
              >
                {conversation.name.split(" ")[0]} {conversation.bloodGroup}
              </button>
            ))}
          </div>

          <div ref={chat} className="max-h-96 space-y-2 overflow-y-auto bg-[#efe7dd] p-3">
            {active.messages.map((message, index) => (
              <p
                key={`${message.at}-${index}`}
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  message.direction === "out" ? "bg-card" : "ml-auto bg-[#d6f5c4]"
                }`}
              >
                <WhatsAppText text={message.body} />
              </p>
            ))}
          </div>

          {active.simulated || !state.twilio ? (
            <div className="space-y-2 border-t border-line p-3">
              <div className="flex gap-2">
                <button type="button" onClick={() => send("reply", { phone: active.phone, text: "YES" })} className={`${secondaryButtonClass} flex-1`}>
                  Reply YES
                </button>
                <button type="button" onClick={() => send("reply", { phone: active.phone, text: "NO" })} className={`${secondaryButtonClass} flex-1`}>
                  Reply NO
                </button>
              </div>
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!draft.trim()) return;
                  send("reply", { phone: active.phone, text: draft });
                  setDraft("");
                }}
              >
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  aria-label="Custom reply"
                  placeholder="Or type a reply, e.g. haan aa raha hu"
                  className={inputClass}
                />
                <button type="submit" className={`${secondaryButtonClass} shrink-0`}>
                  Send
                </button>
              </form>
            </div>
          ) : (
            <p className="border-t border-line p-3 text-sm text-muted">Real donor. Reply from their phone.</p>
          )}
        </section>
      ) : (
        <p className="text-sm text-muted">No messages yet. Create a request to see donor chats here.</p>
      )}
    </div>
  );
}

// WhatsApp shows *text* as bold.
function WhatsAppText({ text }: { text: string }) {
  return text.split("*").map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part));
}

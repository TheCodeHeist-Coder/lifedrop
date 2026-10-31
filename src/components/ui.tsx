import Link from "next/link";
import type { ReactNode } from "react";
import { BLOOD_GROUPS, type BloodGroup } from "@/lib/blood";
import { APP_NAME } from "@/lib/config";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-4">
      <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
        <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true">
          <path fill="var(--blood)" d="M16 2.5c-1 1.6-10 11.4-10 18a10 10 0 0 0 20 0c0-6.6-9-16.4-10-18Z" />
        </svg>
        {APP_NAME}
      </Link>
      <Link href="/donate" className="text-sm font-semibold text-blood underline-offset-4 hover:underline">
        Become a donor
      </Link>
    </header>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-card px-4 py-3 text-base text-ink placeholder:text-muted/70 focus:border-blood focus:outline-none";

export const primaryButtonClass =
  "w-full rounded-xl bg-blood px-5 py-4 text-lg font-semibold text-white transition-colors hover:bg-blood-deep disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClass =
  "rounded-xl border border-line bg-card px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-60";

export function Field({
  label,
  hindi,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hindi?: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block font-semibold">
        {label}
        {hindi && <span className="ml-2 text-sm font-normal text-muted">{hindi}</span>}
      </label>
      {children}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function BloodGroupPicker({
  value,
  onChange,
  name,
}: {
  value: BloodGroup | null;
  onChange: (group: BloodGroup) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-4 gap-2">
      {BLOOD_GROUPS.map((group) => {
        const selected = value === group;
        return (
          <button
            key={group}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(group)}
            className={`rounded-xl border py-3.5 text-lg font-bold transition-colors ${
              selected ? "border-blood bg-blood text-white" : "border-line bg-card text-ink hover:border-blood"
            }`}
          >
            {group}
          </button>
        );
      })}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-blood-soft px-4 py-3 text-sm font-medium text-blood-deep">
      {children}
    </p>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" }) {
  const tones = {
    neutral: "bg-line/60 text-muted",
    good: "bg-leaf-soft text-leaf",
    warn: "bg-amber-soft text-amber",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data as T;
}

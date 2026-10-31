"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, ErrorNote, postJson, secondaryButtonClass } from "@/components/ui";
import type { RequestView } from "@/lib/agent";
import { ERAKTKOSH_URL } from "@/lib/config";
import { displayPhone } from "@/lib/phone";

const POLL_MS = 2500;

export function RequestStatus({ id }: { id: string }) {
  const [view, setView] = useState<RequestView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [offline, setOffline] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/requests/${id}`, { cache: "no-store" });
      if (response.status === 404) {
        setNotFound(true);
        return;
      }
      if (!response.ok) throw new Error("Request failed");
      setView(await response.json());
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [id]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);

  async function act(url: string, body?: unknown) {
    setActionError(null);
    try {
      await postJson(url, body);
      await refresh();
    } catch (caught) {
      setActionError((caught as Error).message);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (notFound) return <ErrorNote>We could not find this request. Please check the link.</ErrorNote>;
  if (!view) return <p className="py-10 text-center text-muted">Loading your request...</p>;

  const closed = view.status === "cancelled";

  return (
    <div className="space-y-4 pt-2">
      <StatusCard view={view} />

      {offline && (
        <p role="status" className="rounded-xl bg-amber-soft px-4 py-2 text-sm font-medium text-amber">
          Connection lost. Trying again...
        </p>
      )}

      <dl className="grid grid-cols-4 gap-2 text-center">
        <Stat label="Alerted" value={view.counts.contacted} />
        <Stat label="Waiting" value={view.counts.waiting} />
        <Stat label="Said no" value={view.counts.declined} />
        <Stat label="Coming" value={`${view.counts.accepted}/${view.units}`} strong />
      </dl>

      {view.acceptedDonors.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">Donors coming</h2>
          {view.acceptedDonors.map((donor) => (
            <article key={donor.alertId} className="rounded-xl border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">{donor.name}</p>
                  <p className="text-sm text-muted">
                    {donor.bloodGroup}, about {Math.max(1, Math.round(donor.distanceKm))} km away
                  </p>
                </div>
                {donor.simulated && <Badge tone="warn">Demo donor</Badge>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!donor.simulated && (
                  <>
                    <a href={`tel:${donor.phone}`} className={secondaryButtonClass}>
                      Call {displayPhone(donor.phone)}
                    </a>
                    <a
                      href={`https://wa.me/${donor.phone.replace("+", "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className={secondaryButtonClass}
                    >
                      WhatsApp
                    </a>
                  </>
                )}
                {donor.donated ? (
                  <span className="self-center">
                    <Badge tone="good">Donation recorded</Badge>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => act(`/api/requests/${id}/donated`, { alertId: donor.alertId })}
                    className={secondaryButtonClass}
                  >
                    Mark as donated
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      <section className="rounded-xl border border-line bg-card p-4">
        <h2 className="font-bold">What is happening</h2>
        <ol className="mt-3 space-y-3">
          {[...view.events].reverse().map((event) => (
            <li key={event.id} className="flex gap-3 text-sm">
              <time className="w-[5.5rem] shrink-0 whitespace-nowrap text-muted">
                {new Date(event.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
              </time>
              <span>{event.message}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-center text-sm text-muted">
        The blood centre does the final health check and cross-match before any transfusion.
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={copyLink} className={secondaryButtonClass}>
          {copied ? "Link copied" : "Copy link for family"}
        </button>
        {!closed && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Cancel this request? Donors who are coming will be told.")) {
                act(`/api/requests/${id}/cancel`);
              }
            }}
            className={secondaryButtonClass}
          >
            Cancel request
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: number | string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border px-1 py-2 ${strong ? "border-leaf bg-leaf-soft" : "border-line bg-card"}`}>
      <dd className="text-xl font-bold">{value}</dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  );
}

function StatusCard({ view }: { view: RequestView }) {
  const { place } = view;

  if (view.status === "cancelled") {
    return (
      <section className="rounded-2xl border border-line bg-card p-5">
        <h1 className="text-2xl font-bold">Request cancelled</h1>
        <p className="mt-1 text-muted">{place}</p>
      </section>
    );
  }

  if (view.status === "fulfilled") {
    return (
      <section className="rounded-2xl bg-leaf p-5 text-white">
        <h1 className="text-2xl font-bold">
          {view.units > 1 ? "Your donors are coming" : "A donor is coming"}
        </h1>
        <p className="mt-1 text-white/90">
          {view.units} of {view.units} {view.bloodGroup} {view.units > 1 ? "units" : "unit"} covered at {place}
        </p>
      </section>
    );
  }

  if (view.exhausted) {
    return (
      <section className="rounded-2xl bg-amber-soft p-5 text-amber">
        <h1 className="text-2xl font-bold">No donor has said yes yet</h1>
        <p className="mt-1">
          We asked every eligible {view.bloodGroup} donor within {view.searchRingsKm.at(-1)} km. If someone replies late,
          they will appear here. Please also check blood centre stock now.
        </p>
        <a
          href={ERAKTKOSH_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-xl bg-amber px-5 py-3 font-semibold text-white"
        >
          Check stock on eRaktKosh
        </a>
      </section>
    );
  }

  return (
    <section className="flex items-center gap-4 rounded-2xl bg-blood p-5 text-white">
      <SearchRings rings={view.searchRingsKm} activeKm={view.radiusKm} />
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">Finding {view.bloodGroup} donors</h1>
        <p className="mt-1 text-white/90">{place}</p>
        <p className="mt-2 text-sm text-white/90">
          Searching within {view.radiusKm} km
          {view.secondsUntilNextWave !== null && view.secondsUntilNextWave > 0
            ? `, next step in ${view.secondsUntilNextWave}s`
            : ""}
        </p>
      </div>
    </section>
  );
}

// Rings are evenly spaced, not to scale: 5 km would be invisible beside 300 km.
function SearchRings({ rings, activeKm }: { rings: number[]; activeKm: number }) {
  const activeIndex = Math.max(0, rings.indexOf(activeKm));
  const radiusFor = (index: number) => 10 + index * 8;

  return (
    <svg viewBox="0 0 100 100" className="size-24 shrink-0" role="img" aria-label={`Searching within ${activeKm} km`}>
      <circle className="search-ring" cx="50" cy="50" r={radiusFor(activeIndex)} fill="white" />
      {rings.map((km, index) => (
        <circle
          key={km}
          cx="50"
          cy="50"
          r={radiusFor(index)}
          fill="none"
          stroke="white"
          strokeWidth={index === activeIndex ? 2 : 1}
          opacity={index <= activeIndex ? 0.95 : 0.3}
        />
      ))}
      <circle cx="50" cy="50" r="4" fill="white" />
    </svg>
  );
}

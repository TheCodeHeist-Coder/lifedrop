"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  BloodGroupPicker,
  ErrorNote,
  Field,
  inputClass,
  postJson,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import type { BloodGroup } from "@/lib/blood";
import type { LatLng } from "@/lib/geo";
import type { ParseResult } from "@/lib/parse-request";
import { PLACES } from "@/lib/places";

const CURRENT_LOCATION = "Current location";

export function RequestForm() {
  const router = useRouter();

  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [units, setUnits] = useState(1);
  const [area, setArea] = useState("");
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [hospital, setHospital] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [pasted, setPasted] = useState("");
  const [reading, setReading] = useState(false);
  const [parseNote, setParseNote] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Next keeps this page alive in the background after navigating away. Without
  // this, the button would still say "Finding donors..." when someone comes back.
  useEffect(() => () => setSubmitting(false), []);

  async function readMessage() {
    setReading(true);
    setError(null);
    setParseNote(null);
    try {
      const parsed = await postJson<ParseResult>("/api/parse", { text: pasted });
      if (parsed.bloodGroup) setBloodGroup(parsed.bloodGroup);
      if (parsed.units) setUnits(parsed.units);
      if (parsed.location) {
        setArea(parsed.location);
        setCoords(null);
      }
      if (parsed.hospital) setHospital(parsed.hospital);
      if (parsed.contactName) setContactName(parsed.contactName);
      if (parsed.contactPhone) setContactPhone(parsed.contactPhone.replace(/^\+91/, ""));

      const missing = [
        !parsed.bloodGroup && "blood group",
        !parsed.location && "location",
        !parsed.hospital && "hospital",
        !parsed.contactName && "name",
        !parsed.contactPhone && "phone number",
      ].filter(Boolean);
      setParseNote(
        missing.length > 0
          ? `Form filled. We could not find the ${missing.join(", ")}, so please add it below.`
          : "Form filled. Please check the blood group before you continue.",
      );
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setReading(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("This browser cannot share your location. Please type it instead.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setArea(CURRENT_LOCATION);
        setLocating(false);
      },
      () => {
        setError("We could not get your location. Please type it instead.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!bloodGroup) {
      setError("Please choose the blood group.");
      return;
    }
    setSubmitting(true);
    try {
      const { id } = await postJson<{ id: string }>("/api/requests", {
        bloodGroup,
        units,
        area,
        hospital,
        contactName,
        contactPhone,
        rawText: pasted || undefined,
        ...(coords ?? {}),
      });
      router.push(`/r/${id}`);
    } catch (caught) {
      setError((caught as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <details className="rounded-xl border border-line bg-card px-4 py-3">
        <summary className="cursor-pointer font-semibold">
          Have a forwarded message? Paste it here
          <span className="ml-2 text-sm font-normal text-muted">मैसेज पेस्ट करें</span>
        </summary>
        <div className="mt-3 space-y-3">
          <textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            rows={5}
            aria-label="Forwarded blood request message"
            placeholder="Paste the WhatsApp or Instagram message, in English or Hinglish."
            className={inputClass}
          />
          <button
            type="button"
            onClick={readMessage}
            disabled={reading || !pasted.trim()}
            className={secondaryButtonClass}
          >
            {reading ? "Reading the message..." : "Fill the form from this message"}
          </button>
          {parseNote && (
            <p role="status" className="rounded-xl bg-amber-soft px-4 py-3 text-sm font-medium text-amber">
              {parseNote}
            </p>
          )}
        </div>
      </details>

      <Field label="Blood group needed" hindi="ब्लड ग्रुप">
        <BloodGroupPicker value={bloodGroup} onChange={setBloodGroup} name="Blood group needed" />
      </Field>

      <Field label="Where is the patient?" hindi="मरीज़ कहाँ है?" htmlFor="area">
        <div className="flex gap-2">
          <input
            id="area"
            value={area}
            onChange={(event) => {
              setArea(event.target.value);
              setCoords(null);
            }}
            list="places"
            required
            autoComplete="off"
            placeholder="City or area"
            className={inputClass}
          />
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className={`${secondaryButtonClass} shrink-0`}
          >
            {locating ? "Finding..." : "Use my location"}
          </button>
        </div>
        <datalist id="places">
          {PLACES.map((place) => (
            <option key={place.name} value={place.name} />
          ))}
        </datalist>
      </Field>

      <Field label="Hospital" hindi="अस्पताल" htmlFor="hospital">
        <input
          id="hospital"
          value={hospital}
          onChange={(event) => setHospital(event.target.value)}
          required
          autoComplete="off"
          placeholder="Hospital name"
          className={inputClass}
        />
      </Field>

      <Field label="Units needed" hindi="कितने यूनिट">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Fewer units"
            onClick={() => setUnits(Math.max(1, units - 1))}
            className={`${secondaryButtonClass} size-12 !p-0 text-xl`}
          >
            −
          </button>
          <span className="w-8 text-center text-xl font-bold" aria-live="polite">
            {units}
          </span>
          <button
            type="button"
            aria-label="More units"
            onClick={() => setUnits(Math.min(10, units + 1))}
            className={`${secondaryButtonClass} size-12 !p-0 text-xl`}
          >
            +
          </button>
        </div>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" hindi="आपका नाम" htmlFor="contactName">
          <input
            id="contactName"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            required
            autoComplete="name"
            className={inputClass}
          />
        </Field>
        <Field label="Your mobile" hindi="मोबाइल" htmlFor="contactPhone">
          <input
            id="contactPhone"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="10 digit number"
            className={inputClass}
          />
        </Field>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <button type="submit" disabled={submitting} className={primaryButtonClass}>
        {submitting ? "Finding donors..." : "Find donors now"}
      </button>
      <p className="text-center text-sm text-muted">
        Donors only get your name and number after they agree to come.
      </p>
    </form>
  );
}

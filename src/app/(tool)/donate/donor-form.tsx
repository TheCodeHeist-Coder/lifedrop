"use client";

import { useState, type FormEvent } from "react";
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
import type { Sex } from "@/lib/eligibility";
import { PLACES } from "@/lib/places";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "14155238886";
const SANDBOX_CODE = process.env.NEXT_PUBLIC_TWILIO_SANDBOX_CODE;

const whatsappLink = (message: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

export function DonorForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [sex, setSex] = useState<Sex | "">("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [area, setArea] = useState("");
  const [lastDonatedOn, setLastDonatedOn] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!bloodGroup) {
      setError("Please choose your blood group.");
      return;
    }
    setSubmitting(true);
    try {
      await postJson("/api/donors", {
        name,
        phone,
        bloodGroup,
        sex,
        dateOfBirth,
        weightKg: Number(weightKg),
        area,
        lastDonatedOn,
        consent,
      });
      setDone(true);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="space-y-4 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-2xl font-bold">One step left</h2>
        <p className="text-muted">Alerts start after you message us on WhatsApp, so we know this number is yours.</p>
        {SANDBOX_CODE && (
          <a href={whatsappLink(`join ${SANDBOX_CODE}`)} target="_blank" rel="noreferrer" className={`${secondaryButtonClass} block text-center`}>
            1. Connect to WhatsApp
          </a>
        )}
        <a href={whatsappLink("HI")} target="_blank" rel="noreferrer" className={`${primaryButtonClass} block text-center`}>
          {SANDBOX_CODE ? "2. Say HI to turn on alerts" : "Say HI to turn on alerts"}
        </a>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Your name" htmlFor="name">
        <input id="name" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" className={inputClass} />
      </Field>

      <Field label="WhatsApp number" htmlFor="phone">
        <input
          id="phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
          inputMode="tel"
          autoComplete="tel"
          placeholder="10 digit number"
          className={inputClass}
        />
      </Field>

      <Field label="Your blood group">
        <BloodGroupPicker value={bloodGroup} onChange={setBloodGroup} name="Your blood group" />
      </Field>

      <Field label="Where are you usually?" htmlFor="area" hint="We use this to find requests near you.">
        <input
          id="area"
          value={area}
          onChange={(event) => setArea(event.target.value)}
          list="donor-places"
          required
          autoComplete="off"
          placeholder="City or area"
          className={inputClass}
        />
        <datalist id="donor-places">
          {PLACES.map((place) => (
            <option key={place.name} value={place.name} />
          ))}
        </datalist>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Date of birth" htmlFor="dateOfBirth">
          <input
            id="dateOfBirth"
            type="date"
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Weight (kg)" htmlFor="weightKg">
          <input
            id="weightKg"
            type="number"
            inputMode="numeric"
            min={20}
            max={300}
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
            required
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Sex" htmlFor="sex" hint="Only used for the gap needed between donations.">
        <select
          id="sex"
          value={sex}
          onChange={(event) => setSex(event.target.value as Sex)}
          required
          className={inputClass}
        >
          <option value="" disabled>
            Choose
          </option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </Field>

      <Field label="Last donated on" htmlFor="lastDonatedOn" hint="Leave empty if you have never donated.">
        <input
          id="lastDonatedOn"
          type="date"
          value={lastDonatedOn}
          onChange={(event) => setLastDonatedOn(event.target.value)}
          className={inputClass}
        />
      </Field>

      <label className="flex items-start gap-3 rounded-xl border border-line bg-card p-4 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          required
          className="mt-0.5 size-5 accent-[var(--blood)]"
        />
        <span>
          I agree to get blood request alerts on WhatsApp. Reply STOP any time to delete my details.
        </span>
      </label>

      {error && <ErrorNote>{error}</ErrorNote>}

      <button type="submit" disabled={submitting} className={primaryButtonClass}>
        {submitting ? "Saving..." : "Register as a donor"}
      </button>
    </form>
  );
}

export type Sex = "male" | "female" | "other";

// Values from public summaries of Indian donor guidelines, not the NBTC document
// itself. Confirm against the current NBTC text before real-world use. The blood
// centre's own screening, including haemoglobin, always has the final say.
export const ELIGIBILITY_RULES = {
  minAge: 18,
  maxAge: 65,
  minWeightKg: 45,
  // "other" takes the longer gap so nobody is alerted too early.
  gapDays: { male: 90, female: 120, other: 120 } satisfies Record<Sex, number>,
};

export type EligibilityInput = {
  sex: Sex;
  date_of_birth: string;
  weight_kg: number;
  last_donated_on: string | null;
};

export type EligibilityResult = {
  eligible: boolean;
  reasons: string[];
  recentlyDonated: boolean;
  nextEligibleOn: string | null;
};

const DAY_MS = 86_400_000;

// Dates are plain YYYY-MM-DD strings, compared as calendar days. Going through
// local time here would shift a donor's eligibility by a day near midnight.
function toUtcDay(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function addDays(date: string, days: number): string {
  return new Date(toUtcDay(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

export function ageOn(dateOfBirth: string, today: string): number {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const hadBirthday = tm > bm || (tm === bm && td >= bd);
  return ty - by - (hadBirthday ? 0 : 1);
}

export function checkEligibility(donor: EligibilityInput, today: string = todayInIndia()): EligibilityResult {
  const reasons: string[] = [];
  const rules = ELIGIBILITY_RULES;

  const age = ageOn(donor.date_of_birth, today);
  if (age < rules.minAge) reasons.push(`Under ${rules.minAge}`);
  if (age > rules.maxAge) reasons.push(`Over ${rules.maxAge}`);
  if (donor.weight_kg < rules.minWeightKg) reasons.push(`Under ${rules.minWeightKg} kg`);

  let nextEligibleOn: string | null = null;
  let recentlyDonated = false;
  if (donor.last_donated_on) {
    const candidate = addDays(donor.last_donated_on, rules.gapDays[donor.sex]);
    if (toUtcDay(candidate) > toUtcDay(today)) {
      recentlyDonated = true;
      nextEligibleOn = candidate;
      reasons.push(`Donated too recently, eligible from ${candidate}`);
    }
  }

  return { eligible: reasons.length === 0, reasons, recentlyDonated, nextEligibleOn };
}

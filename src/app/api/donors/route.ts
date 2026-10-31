import { fail, readJson, text } from "@/lib/api";
import { isBloodGroup } from "@/lib/blood";
import { query } from "@/lib/db";
import { checkEligibility, type Sex } from "@/lib/eligibility";
import { geocode } from "@/lib/geo";
import { normalizeIndianPhone } from "@/lib/phone";

const SEXES: Sex[] = ["male", "female", "other"];
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

export async function POST(request: Request) {
  const body = await readJson(request);

  const name = text(body.name, 80);
  if (!name) return fail("Enter your name");

  const phone = normalizeIndianPhone(text(body.phone, 30));
  if (!phone) return fail("Enter a valid 10 digit mobile number");

  const bloodGroup = body.bloodGroup;
  if (!isBloodGroup(bloodGroup)) return fail("Choose your blood group");

  const sex = body.sex as Sex;
  if (!SEXES.includes(sex)) return fail("Choose an option for sex");

  const dateOfBirth = text(body.dateOfBirth, 10);
  if (!isDate(dateOfBirth)) return fail("Enter your date of birth");

  const weightKg = Number(body.weightKg);
  if (!Number.isInteger(weightKg) || weightKg < 20 || weightKg > 300) return fail("Enter your weight in kg");

  const lastDonatedOn = text(body.lastDonatedOn, 10) || null;
  if (lastDonatedOn && !isDate(lastDonatedOn)) return fail("Check your last donation date");

  const area = text(body.area);
  if (!area) return fail("Enter your area");

  if (body.consent !== true) return fail("Please agree to be contacted on WhatsApp");

  // Age and weight do not change quickly, so someone outside the limits is told now
  // rather than sitting in the list. A recent donation is fine: they become eligible
  // on their own once the gap has passed.
  const eligibility = checkEligibility({
    sex,
    date_of_birth: dateOfBirth,
    weight_kg: weightKg,
    last_donated_on: null,
  });
  if (!eligibility.eligible) {
    return fail(`Sorry, you can't register as a donor: ${eligibility.reasons[0].toLowerCase()}.`, 422);
  }

  const location = await geocode(area);
  if (!location) return fail("We could not find that area. Try a nearby city.");

  const inserted = await query(
    `INSERT INTO donors (name, phone, blood_group, sex, date_of_birth, weight_kg, area, lat, lng, last_donated_on)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (phone) DO NOTHING RETURNING id`,
    [name, phone, bloodGroup, sex, dateOfBirth, weightKg, area, location.lat, location.lng, lastDonatedOn],
  );
  if (inserted.length === 0) return fail("This number is already registered", 409);

  return Response.json({ ok: true }, { status: 201 });
}

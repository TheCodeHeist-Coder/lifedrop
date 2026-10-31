import { createRequest } from "@/lib/agent";
import { fail, readJson, text } from "@/lib/api";
import { isBloodGroup } from "@/lib/blood";
import { config } from "@/lib/config";
import { query } from "@/lib/db";
import { geocode } from "@/lib/geo";
import { normalizeIndianPhone } from "@/lib/phone";

const isCoordinate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export async function POST(request: Request) {
  const body = await readJson(request);

  const bloodGroup = body.bloodGroup;
  if (!isBloodGroup(bloodGroup)) return fail("Choose the blood group");

  const units = Number(body.units ?? 1);
  if (!Number.isInteger(units) || units < 1 || units > 10) return fail("Units must be between 1 and 10");

  const area = text(body.area);
  if (!area) return fail("Enter the location");

  const hospital = text(body.hospital);
  if (!hospital) return fail("Enter the hospital name");

  const contactName = text(body.contactName, 80);
  if (!contactName) return fail("Enter your name");

  const contactPhone = normalizeIndianPhone(text(body.contactPhone, 30));
  if (!contactPhone) return fail("Enter a valid 10 digit mobile number");

  // Every request reaches real donors' phones, so one number cannot flood them.
  const [{ open }] = await query<{ open: number }>(
    `SELECT count(*)::int AS open FROM requests WHERE contact_phone = $1 AND status = 'open'`,
    [contactPhone],
  );
  if (open >= config.maxOpenRequestsPerPhone) {
    return fail("This number already has too many open requests. Cancel one first.", 429);
  }

  const fromDevice = isCoordinate(body.lat) && isCoordinate(body.lng);
  const location = fromDevice ? { lat: body.lat as number, lng: body.lng as number } : await geocode(area);
  if (!location) return fail("We could not find that location. Try a nearby city, or use your current location.");

  const id = await createRequest({
    bloodGroup,
    units,
    hospital,
    area: fromDevice ? "" : area,
    ...location,
    contactName,
    contactPhone,
    rawText: text(body.rawText, 4000) || null,
  });
  return Response.json({ id }, { status: 201 });
}

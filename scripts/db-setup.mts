// Creates the tables and loads simulated donors.
//   npm run db:setup            tables only
//   npm run db:setup -- --seed  tables, plus a fresh set of simulated donors

import { readFileSync } from "node:fs";
import { BLOOD_GROUPS, type BloodGroup } from "../src/lib/blood";
import { closePool, query } from "../src/lib/db";
import { todayInIndia, type Sex } from "../src/lib/eligibility";
import { CITY_PLACES, DELHI_NCR_PLACES, type Place } from "../src/lib/places";

const DONOR_COUNT = 300;

// Fixed seed, so every demo run has the same donors.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(90);
const pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)];

// Rough share of each group in India, positives far more common than negatives.
const GROUP_WEIGHTS: Record<BloodGroup, number> = {
  "B+": 32, "O+": 31, "A+": 22, "AB+": 8, "B-": 2.2, "O-": 2.3, "A-": 1.8, "AB-": 0.7,
};

function pickBloodGroup(): BloodGroup {
  const total = BLOOD_GROUPS.reduce((sum, group) => sum + GROUP_WEIGHTS[group], 0);
  let roll = random() * total;
  for (const group of BLOOD_GROUPS) {
    roll -= GROUP_WEIGHTS[group];
    if (roll <= 0) return group;
  }
  return "O+";
}

const FIRST_NAMES: Record<"male" | "female", string[]> = {
  male: ["Aarav", "Rohan", "Vikram", "Arjun", "Karan", "Imran", "Rahul", "Sandeep", "Harpreet", "Joseph", "Manoj", "Nikhil", "Sameer", "Tushar", "Amit", "Deepak"],
  female: ["Priya", "Ananya", "Neha", "Kavya", "Sana", "Meera", "Pooja", "Simran", "Divya", "Ritu", "Nisha", "Aisha", "Shreya", "Tanvi", "Anjali", "Mary"],
};
const LAST_NAMES = ["Sharma", "Verma", "Gupta", "Singh", "Khan", "Kumar", "Yadav", "Jain", "Das", "Mehta", "Nair", "Reddy", "Iyer", "Kaur", "Malik", "Thomas"];

const isoDaysAgo = (days: number) =>
  new Date(Date.parse(todayInIndia()) - days * 86_400_000).toISOString().slice(0, 10);

// About 5 km of scatter, so donors do not stack on one map point.
const scatter = (value: number) => value + (random() - 0.5) * 0.09;

function makeDonor(index: number, place: Place) {
  const sex: Sex = random() < 0.68 ? "male" : "female";
  const name = `${pick(FIRST_NAMES[sex])} ${pick(LAST_NAMES)}`;

  // A realistic mix, so the eligibility filter has real work to do on stage.
  const history = random();
  const lastDonated =
    history < 0.25 ? isoDaysAgo(10 + Math.floor(random() * 70))
    : history < 0.6 ? isoDaysAgo(130 + Math.floor(random() * 400))
    : null;

  return {
    name,
    // +91 10 is not an Indian mobile prefix, so these cannot reach a real person
    // even if the simulated flag were ever ignored.
    phone: `+911000${String(index).padStart(6, "0")}`,
    blood_group: pickBloodGroup(),
    sex,
    date_of_birth: isoDaysAgo(365 * (19 + Math.floor(random() * 40)) + Math.floor(random() * 300)),
    weight_kg: random() < 0.03 ? 42 : 50 + Math.floor(random() * 40),
    area: place.name,
    lat: scatter(place.lat),
    lng: scatter(place.lng),
    last_donated_on: lastDonated,
    available: random() > 0.08,
  };
}

async function applySchema() {
  const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
  const statements = schema
    .replace(/--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) await query(statement);
  console.log(`Applied ${statements.length} schema statements`);
}

async function seed() {
  await query(`DELETE FROM donors WHERE simulated`);

  const donors = Array.from({ length: DONOR_COUNT }, (_, index) =>
    makeDonor(index, index < DONOR_COUNT * 0.75 ? pick(DELHI_NCR_PLACES) : pick(CITY_PLACES)),
  );

  for (let start = 0; start < donors.length; start += 50) {
    const batch = donors.slice(start, start + 50);
    const fields = ["name", "phone", "blood_group", "sex", "date_of_birth", "weight_kg", "area", "lat", "lng", "last_donated_on", "available"] as const;
    const values = batch.flatMap((donor) => fields.map((field) => donor[field]));
    const rows = batch.map(
      (_, row) => `(${fields.map((_, column) => `$${row * fields.length + column + 1}`).join(", ")}, TRUE)`,
    );
    await query(`INSERT INTO donors (${fields.join(", ")}, simulated) VALUES ${rows.join(", ")}`, values);
  }
  console.log(`Seeded ${donors.length} simulated donors`);
}

await applySchema();
if (process.argv.includes("--seed")) await seed();
await closePool();

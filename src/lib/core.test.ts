import { afterEach, describe, expect, it, vi } from "vitest";
import { placeOf } from "./agent";
import { BLOOD_GROUPS, canDonateTo, compatibleDonorGroups, type BloodGroup } from "./blood";
import { config } from "./config";
import { ageOn, checkEligibility, todayInIndia, type EligibilityInput } from "./eligibility";
import { boundingBox, distanceKm, findPlaceByName, findPlaceInText } from "./geo";
import { selectDonors, type Candidate } from "./matching";
import { parseRequest, parseWithRules } from "./parse-request";
import { displayPhone, normalizeIndianPhone } from "./phone";
import { classifyReply } from "./reply";

describe("red cell compatibility", () => {
  // Written out independently of the table in blood.ts. Each row is a donor group
  // and the patients who can receive from it.
  const CAN_GIVE_TO: Record<BloodGroup, BloodGroup[]> = {
    "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
    "O+": ["O+", "A+", "B+", "AB+"],
    "A-": ["A-", "A+", "AB-", "AB+"],
    "A+": ["A+", "AB+"],
    "B-": ["B-", "B+", "AB-", "AB+"],
    "B+": ["B+", "AB+"],
    "AB-": ["AB-", "AB+"],
    "AB+": ["AB+"],
  };

  it("matches the full 8x8 table", () => {
    for (const donor of BLOOD_GROUPS) {
      for (const patient of BLOOD_GROUPS) {
        expect(canDonateTo(donor, patient), `${donor} to ${patient}`).toBe(CAN_GIVE_TO[donor].includes(patient));
      }
    }
  });

  it("asks an exact match first and O- last", () => {
    for (const patient of BLOOD_GROUPS) {
      const order = compatibleDonorGroups(patient);
      expect(order[0]).toBe(patient);
      if (patient !== "O-") expect(order.at(-1)).toBe("O-");
    }
  });
});

describe("eligibility", () => {
  const today = "2026-11-01";
  const adult: EligibilityInput = { sex: "male", date_of_birth: "1995-06-15", weight_kg: 70, last_donated_on: null };

  it("accepts a healthy first-time donor", () => {
    expect(checkEligibility(adult, today).eligible).toBe(true);
  });

  it("applies the 90 day gap for men, to the day", () => {
    expect(checkEligibility({ ...adult, last_donated_on: "2026-08-03" }, today).eligible).toBe(true);
    const tooSoon = checkEligibility({ ...adult, last_donated_on: "2026-08-04" }, today);
    expect(tooSoon.eligible).toBe(false);
    expect(tooSoon.recentlyDonated).toBe(true);
    expect(tooSoon.nextEligibleOn).toBe("2026-11-02");
  });

  it("applies the longer 120 day gap for women", () => {
    const donated = { ...adult, sex: "female" as const, last_donated_on: "2026-08-03" };
    expect(checkEligibility(donated, today).eligible).toBe(false);
    expect(checkEligibility({ ...donated, last_donated_on: "2026-07-04" }, today).eligible).toBe(true);
  });

  it("uses the longer gap when sex is other", () => {
    expect(checkEligibility({ ...adult, sex: "other", last_donated_on: "2026-08-03" }, today).eligible).toBe(false);
  });

  it("enforces age limits on exact birthdays", () => {
    expect(ageOn("2008-11-01", today)).toBe(18);
    expect(ageOn("2008-11-02", today)).toBe(17);
    expect(checkEligibility({ ...adult, date_of_birth: "2008-11-02" }, today).eligible).toBe(false);
    expect(checkEligibility({ ...adult, date_of_birth: "1961-11-01" }, today).eligible).toBe(true);
    expect(checkEligibility({ ...adult, date_of_birth: "1960-11-01" }, today).eligible).toBe(false);
  });

  it("enforces the minimum weight", () => {
    expect(checkEligibility({ ...adult, weight_kg: 45 }, today).eligible).toBe(true);
    expect(checkEligibility({ ...adult, weight_kg: 44 }, today).eligible).toBe(false);
  });

  it("uses the Indian calendar day, not the server's", () => {
    expect(todayInIndia(new Date("2026-10-31T20:00:00Z"))).toBe("2026-11-01");
  });
});

describe("phone numbers", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["+91-98765-43210", "+919876543210"],
    ["whatsapp:+919876543210", "+919876543210"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeIndianPhone(input)).toBe(expected);
  });

  it.each(["12345", "5876543210", "98765432101", "", "+1 415 523 8886"])("rejects %s", (input) => {
    expect(normalizeIndianPhone(input)).toBeNull();
  });

  it("formats for display", () => {
    expect(displayPhone("+919876543210")).toBe("+91 98765 43210");
  });
});

describe("donor replies", () => {
  it.each(["YES", "yes!", " Yes. ", "y", "haan", "Haan", "हाँ", "ok", "👍 yes"])("reads %s as accept", (text) => {
    expect(classifyReply(text)).toBe("accept");
  });

  it.each(["NO", "no.", "nahi", "नहीं", "not available", "busy"])("reads %s as decline", (text) => {
    expect(classifyReply(text)).toBe("decline");
  });

  it.each([
    "yes but I can't come today",
    "no problem, I will come",
    "I cannot say yes right now",
    "maybe after 6pm",
    "who is this?",
  ])("does not guess on %s", (text) => {
    expect(classifyReply(text)).toBe("unclear");
  });

  it("recognises commands", () => {
    expect(classifyReply("PAUSE")).toBe("pause");
    expect(classifyReply("resume")).toBe("resume");
    expect(classifyReply("Stop")).toBe("stop");
    expect(classifyReply("hi")).toBe("help");
  });
});

describe("request parsing with rules", () => {
  const group = (text: string) => parseWithRules(text).bloodGroup;

  it.each<[string, BloodGroup]>([
    ["Need O+ urgently", "O+"],
    ["need b+ve blood", "B+"],
    ["AB -ve required", "AB-"],
    ["O negative donor needed", "O-"],
    ["B positive blood needed", "B+"],
    ["blood group: A+", "A+"],
    ["ab positive", "AB+"],
    ["A Positive required", "A+"],
    ["(B-ve)", "B-"],
    ["O−", "O-"],
  ])("finds the group in %s", (text, expected) => {
    expect(group(text)).toBe(expected);
  });

  it.each([
    "Flat B-12, Sector 7",
    "A-block, Janakpuri",
    "keep a positive attitude",
    "we need help please",
    "Vitamin B12",
  ])("finds no group in %s", (text) => {
    expect(group(text)).toBeNull();
  });

  it("reads a typical forwarded appeal", () => {
    const parsed = parseWithRules(`🚨 URGENT 🚨
Need 2 units of B+ve blood at Max Super Speciality Hospital, Saket, New Delhi.
Patient undergoing surgery tomorrow morning.
Contact: Rahul Sharma 98765 43210
Please forward to everyone!`);
    expect(parsed).toEqual({
      bloodGroup: "B+",
      units: 2,
      hospital: "Max Super Speciality Hospital",
      location: "Saket",
      contactName: "Rahul Sharma",
      contactPhone: "+919876543210",
    });
  });

  it("does not take a hospital phone landline digits as a mobile", () => {
    expect(parseWithRules("Call 011-2658-8500").contactPhone).toBeNull();
  });
});

describe("geography", () => {
  it("measures a known distance", () => {
    const delhi = findPlaceByName("Delhi")!;
    const mumbai = findPlaceByName("Mumbai")!;
    expect(distanceKm(delhi, mumbai)).toBeGreaterThan(1130);
    expect(distanceKm(delhi, mumbai)).toBeLessThan(1170);
  });

  it("bounding box contains points on the circle's edge", () => {
    const center = { lat: 28.6, lng: 77.2 };
    const box = boundingBox(center, 100);
    const east = { lat: 28.6, lng: 77.2 + 100 / (111 * Math.cos((28.6 * Math.PI) / 180)) - 0.001 };
    expect(east.lng).toBeLessThan(box.maxLng);
    expect(distanceKm(center, { lat: box.maxLat, lng: 77.2 })).toBeGreaterThanOrEqual(99);
  });

  it("prefers the longest place name", () => {
    expect(findPlaceInText("admitted in Greater Noida")?.name).toBe("Greater Noida");
    expect(findPlaceByName("gurgaon")?.name).toBe("Gurugram");
  });
});

describe("place names", () => {
  it("joins the hospital and area, leaving out a missing area", () => {
    expect(placeOf({ hospital: "AIIMS", area: "Delhi" })).toBe("AIIMS, Delhi");
    expect(placeOf({ hospital: "AIIMS", area: "" })).toBe("AIIMS");
  });
});

describe("selecting donors", () => {
  const center = { lat: 28.6, lng: 77.2 };
  const person = (id: string, blood_group: BloodGroup, kmNorth: number, extra: Partial<Candidate> = {}): Candidate => ({
    id,
    name: id,
    phone: `+91100000${id}`,
    blood_group,
    simulated: true,
    lat: center.lat + kmNorth / 111.2,
    lng: center.lng,
    sex: "male",
    date_of_birth: "1995-01-01",
    weight_kg: 70,
    last_donated_on: null,
    ...extra,
  });
  const today = "2026-11-01";

  it("never selects an incompatible donor", () => {
    const { selected } = selectDonors("O+", center, [person("a", "A+", 1), person("b", "AB+", 1)], 5, 5, today);
    expect(selected).toEqual([]);
  });

  it("puts an exact match ahead of a closer compatible donor", () => {
    const { selected } = selectDonors("B+", center, [person("o", "O-", 1), person("b", "B+", 4)], 5, 5, today);
    expect(selected.map((donor) => donor.id)).toEqual(["b", "o"]);
  });

  it("drops people outside the radius and counts recent donors", () => {
    const result = selectDonors(
      "B+",
      center,
      [
        person("far", "B+", 8),
        person("recent", "B+", 1, { last_donated_on: "2026-10-01" }),
        person("light", "B+", 1, { weight_kg: 40 }),
        person("good", "B+", 2),
      ],
      5,
      5,
      today,
    );
    expect(result.selected.map((donor) => donor.id)).toEqual(["good"]);
    expect(result.skippedRecentDonors).toBe(1);
    expect(result.skippedOtherReasons).toBe(1);
  });

  it("respects the limit but reports everyone in range", () => {
    const people = ["1", "2", "3", "4"].map((id) => person(id, "B+", Number(id)));
    const result = selectDonors("B+", center, people, 5, 2, today);
    expect(result.selected.map((donor) => donor.id)).toEqual(["1", "2"]);
    expect(result.eligibleInRange).toBe(4);
  });
});

describe("parsing with Gemini", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    config.gemini.apiKey = undefined;
  });

  const stubGemini = (payload: unknown) => {
    const fetchMock = vi.fn(async () =>
      Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    config.gemini.apiKey = "test-key";
    return fetchMock;
  };

  it("uses rules when there is no key", async () => {
    const parsed = await parseRequest("Need O+ blood");
    expect(parsed.source).toBe("rules");
    expect(parsed.bloodGroup).toBe("O+");
  });

  it("calls the documented endpoint and uses the result", async () => {
    const fetchMock = stubGemini({
      bloodGroup: "A-",
      units: 3,
      hospital: "City Hospital",
      location: "Noida",
      contactName: "Asha",
      contactPhone: "98765 43210",
    });
    const parsed = await parseRequest("बहुत जरूरी है");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`/v1beta/models/${config.gemini.model}:generateContent`);
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    expect(parsed).toMatchObject({ source: "gemini", bloodGroup: "A-", units: 3, contactPhone: "+919876543210" });
  });

  it("rejects an invalid blood group from the model", async () => {
    stubGemini({ bloodGroup: "Z+", units: 99, hospital: null, location: null, contactName: null, contactPhone: "123" });
    const parsed = await parseRequest("Need B+ve blood");
    expect(parsed.bloodGroup).toBe("B+");
    expect(parsed.units).toBeNull();
    expect(parsed.contactPhone).toBeNull();
  });

  it("falls back to rules if the API fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota exceeded", { status: 429 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    config.gemini.apiKey = "test-key";
    const parsed = await parseRequest("Need AB+ blood");
    expect(parsed).toMatchObject({ source: "rules", bloodGroup: "AB+" });
  });
});

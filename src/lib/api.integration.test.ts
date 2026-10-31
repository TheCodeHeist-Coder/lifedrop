// Calls the real route handlers against a real database. The Twilio signature is
// computed here by hand, from Twilio's published scheme, so the test does not just
// agree with the library it is checking.

import { createHmac } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as createDonor } from "@/app/api/donors/route";
import { POST as createRequestRoute } from "@/app/api/requests/route";
import { GET as demoState, POST as demoAction } from "@/app/api/demo/route";
import { POST as statusWebhook } from "@/app/api/whatsapp/status/route";
import { POST as messageWebhook } from "@/app/api/whatsapp/webhook/route";
import { config } from "./config";
import { closePool, query } from "./db";

const TOKEN = "test-auth-token";
const PUBLIC_URL = "https://lifedrop.example";
const DONOR_PHONE = "+919999900001";
const FAMILY_PHONE = "+919999900002";
const SEA = { lat: 12.0, lng: 62.0 };

function sign(path: string, params: Record<string, string>, token = TOKEN) {
  const payload = PUBLIC_URL + path + Object.keys(params).sort().map((key) => key + params[key]).join("");
  return createHmac("sha1", token).update(payload, "utf8").digest("base64");
}

const twilioPost = (path: string, params: Record<string, string>, signature: string) =>
  new Request(`http://internal${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Twilio-Signature": signature },
    body: new URLSearchParams(params),
  });

const jsonPost = (body: unknown) =>
  new Request("http://internal/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const validRequest = {
  bloodGroup: "O+",
  units: 1,
  area: "Current location",
  hospital: "Test Hospital",
  contactName: "Test Family",
  contactPhone: FAMILY_PHONE,
  ...SEA,
};

const validDonor = {
  name: "Web Donor",
  phone: DONOR_PHONE,
  bloodGroup: "O+",
  sex: "male",
  dateOfBirth: "1995-01-01",
  weightKg: 70,
  area: "Noida",
  consent: true,
};

async function addVerifiedDonorAtSea() {
  await query(
    `INSERT INTO donors (name, phone, blood_group, sex, date_of_birth, weight_kg, area, lat, lng, whatsapp_verified_at)
     VALUES ('Sea Donor', $1, 'O+', 'male', '1995-01-01', 70, 'sea', $2, $3, now())`,
    [DONOR_PHONE, SEA.lat, SEA.lng],
  );
}

async function cleanUp() {
  await query(`DELETE FROM messages WHERE phone = $1`, [DONOR_PHONE]);
  await query(`DELETE FROM requests WHERE contact_phone = $1`, [FAMILY_PHONE]);
  await query(`DELETE FROM donors WHERE phone = $1`, [DONOR_PHONE]);
}

describe.skipIf(!process.env.DATABASE_URL)("API routes", () => {
  beforeEach(async () => {
    config.twilio.authToken = TOKEN;
    config.twilio.accountSid = undefined;
    config.publicUrl = PUBLIC_URL;
    config.demoMode = false;
    await cleanUp();
  });

  afterAll(async () => {
    if (process.env.DATABASE_URL) {
      await cleanUp();
      await closePool();
    }
  });

  describe("WhatsApp webhook", () => {
    const yes = { From: `whatsapp:${DONOR_PHONE}`, Body: "YES" };
    const path = "/api/whatsapp/webhook";

    it("rejects a forged YES and gives away nothing", async () => {
      await addVerifiedDonorAtSea();
      await createRequestRoute(jsonPost(validRequest));

      const forged = await messageWebhook(twilioPost(path, yes, "not-a-real-signature"));
      const wrongToken = await messageWebhook(twilioPost(path, yes, sign(path, yes, "stolen-guess")));

      expect(forged.status).toBe(403);
      expect(wrongToken.status).toBe(403);
      const [request] = await query<{ accepted_count: number }>(
        `SELECT accepted_count FROM requests WHERE contact_phone = $1`,
        [FAMILY_PHONE],
      );
      expect(request.accepted_count).toBe(0);
      const sent = await query<{ body: string }>(`SELECT body FROM messages WHERE phone = $1`, [DONOR_PHONE]);
      expect(sent.map((message) => message.body).join()).not.toContain("99999 00002");
    });

    it("rejects a signature made for different content", async () => {
      await addVerifiedDonorAtSea();
      const signedForNo = sign(path, { ...yes, Body: "NO" });
      expect((await messageWebhook(twilioPost(path, yes, signedForNo))).status).toBe(403);
    });

    it("refuses everything when no auth token is configured", async () => {
      config.twilio.authToken = undefined;
      expect((await messageWebhook(twilioPost(path, yes, sign(path, yes)))).status).toBe(403);
    });

    it("accepts a correctly signed reply and returns empty TwiML", async () => {
      await addVerifiedDonorAtSea();
      await createRequestRoute(jsonPost(validRequest));

      const response = await messageWebhook(twilioPost(path, yes, sign(path, yes)));

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/xml");
      expect(await response.text()).toBe("<Response/>");
      const [request] = await query<{ status: string; accepted_count: number }>(
        `SELECT status, accepted_count FROM requests WHERE contact_phone = $1`,
        [FAMILY_PHONE],
      );
      expect(request).toEqual({ status: "fulfilled", accepted_count: 1 });
    });

    it("drops the location placeholder from what the donor reads", async () => {
      await addVerifiedDonorAtSea();
      await createRequestRoute(jsonPost(validRequest));
      const [alert] = await query<{ body: string }>(`SELECT body FROM messages WHERE phone = $1`, [DONOR_PHONE]);
      expect(alert.body).toContain("a patient at Test Hospital needs a donor");
      expect(alert.body).not.toContain("Current location");
    });

    it("rejects a forged delivery report", async () => {
      const params = { MessageSid: "SMx", MessageStatus: "failed" };
      expect((await statusWebhook(twilioPost("/api/whatsapp/status", params, "bad"))).status).toBe(403);
    });
  });

  describe("creating a request", () => {
    const status = async (body: unknown) => (await createRequestRoute(jsonPost(body))).status;

    it.each([
      [{ bloodGroup: "C+" }, 400],
      [{ units: 0 }, 400],
      [{ units: 11 }, 400],
      [{ units: 1.5 }, 400],
      [{ hospital: "   " }, 400],
      [{ contactName: "" }, 400],
      [{ contactPhone: "12345" }, 400],
    ])("rejects %j", async (change, expected) => {
      expect(await status({ ...validRequest, ...change })).toBe(expected);
    });

    it("limits how many open requests one number can have", async () => {
      expect(await status(validRequest)).toBe(201);
      expect(await status(validRequest)).toBe(201);
      expect(await status(validRequest)).toBe(201);
      expect(await status(validRequest)).toBe(429);
    });
  });

  describe("registering a donor", () => {
    const status = async (body: unknown) => (await createDonor(jsonPost(body))).status;

    it("registers an eligible donor who is not yet verified", async () => {
      expect(await status(validDonor)).toBe(201);
      const [donor] = await query<{ whatsapp_verified_at: string | null; simulated: boolean }>(
        `SELECT whatsapp_verified_at, simulated FROM donors WHERE phone = $1`,
        [DONOR_PHONE],
      );
      expect(donor).toEqual({ whatsapp_verified_at: null, simulated: false });
    });

    it("does not let anyone overwrite an existing number", async () => {
      expect(await status(validDonor)).toBe(201);
      expect(await status({ ...validDonor, name: "Someone Else" })).toBe(409);
    });

    it.each([
      [{ consent: false }, 400],
      [{ phone: "123" }, 400],
      [{ sex: "unknown" }, 400],
      [{ dateOfBirth: "not-a-date" }, 400],
      [{ dateOfBirth: "2015-01-01" }, 422],
      [{ dateOfBirth: "1940-01-01" }, 422],
      [{ weightKg: 40 }, 422],
    ])("rejects %j", async (change, expected) => {
      expect(await status({ ...validDonor, ...change })).toBe(expected);
    });
  });

  describe("demo console", () => {
    it("is unreachable unless demo mode is on", async () => {
      expect((await demoState()).status).toBe(404);
      expect((await demoAction(jsonPost({ action: "reset" }))).status).toBe(404);
    });
  });
});

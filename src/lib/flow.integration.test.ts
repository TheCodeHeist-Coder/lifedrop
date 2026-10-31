// End-to-end coordinator tests against a real database. These run only when
// DATABASE_URL is set, and use their own donors in the Arabian Sea so that they
// never touch seeded data.

import { randomInt } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { advanceRequest, cancelRequest, createRequest, getRequestView, markDonated } from "./agent";
import type { BloodGroup } from "./blood";
import { handleInbound } from "./bot";
import { config } from "./config";
import { closePool, query } from "./db";
import { recordDeliveryStatus, sendWhatsApp } from "./whatsapp";

const twilioCreate = vi.hoisted(() => vi.fn());
vi.mock("twilio", () => ({ default: () => ({ messages: { create: twilioCreate } }) }));

const SEA = { lat: 12.0, lng: 62.0 };
const TEST_AREA = "__test__";
const kmNorth = (km: number) => SEA.lat + km / 111.2;

type DonorOptions = {
  group?: BloodGroup;
  km?: number;
  lastDonated?: string | null;
  verified?: boolean;
  simulated?: boolean;
  available?: boolean;
  sex?: "male" | "female";
};

async function addDonor(options: DonorOptions = {}) {
  const phone = `+9199${randomInt(10_000_000, 99_999_999)}`;
  await query(
    `INSERT INTO donors (name, phone, blood_group, sex, date_of_birth, weight_kg, area, lat, lng,
                         last_donated_on, available, simulated, whatsapp_verified_at)
     VALUES ($1, $2, $3, $4, '1995-01-01', 70, $5, $6, $7, $8, $9, $10, $11)`,
    [
      "Test Donor",
      phone,
      options.group ?? "O+",
      options.sex ?? "male",
      TEST_AREA,
      kmNorth(options.km ?? 1),
      SEA.lng,
      options.lastDonated ?? null,
      options.available ?? true,
      options.simulated ?? true,
      options.verified === false ? null : new Date(),
    ],
  );
  return phone;
}

const newRequest = (group: BloodGroup = "O+", units = 1) =>
  createRequest({
    bloodGroup: group,
    units,
    hospital: "Test Hospital",
    area: TEST_AREA,
    ...SEA,
    contactName: "Test Family",
    contactPhone: "+919000000001",
  });

const view = async (id: string) => (await getRequestView(id))!;

const alertedPhones = (id: string) =>
  query<{ phone: string; status: string; wave: number }>(
    `SELECT d.phone, n.status, n.wave FROM notifications n JOIN donors d ON d.id = n.donor_id WHERE n.request_id = $1`,
    [id],
  );

const lastMessage = async (phone: string) => {
  const rows = await query<{ body: string }>(
    `SELECT body FROM messages WHERE phone = $1 AND direction = 'out' ORDER BY created_at DESC LIMIT 1`,
    [phone],
  );
  return rows[0]?.body ?? "";
};

async function cleanUp() {
  await query(
    `DELETE FROM messages WHERE phone IN (SELECT phone FROM donors WHERE area = $1)`,
    [TEST_AREA],
  );
  await query(`DELETE FROM requests WHERE area = $1`, [TEST_AREA]);
  await query(`DELETE FROM donors WHERE area = $1`, [TEST_AREA]);
}

describe.skipIf(!process.env.DATABASE_URL)("coordinator on a real database", () => {
  beforeEach(async () => {
    config.waveTimeoutSeconds = 60;
    config.donorsPerWave = 5;
    config.twilio.accountSid = undefined;
    config.twilio.authToken = undefined;
    config.twilio.sendSpacingMs = 0;
    twilioCreate.mockReset();
    await cleanUp();
  });

  afterAll(async () => {
    if (process.env.DATABASE_URL) {
      await cleanUp();
      await closePool();
    }
  });

  it("alerts only compatible, eligible, verified, available donors in range", async () => {
    const good = await addDonor({ group: "O+", km: 1 });
    const universal = await addDonor({ group: "O-", km: 2 });
    await addDonor({ group: "A+", km: 1 });
    await addDonor({ group: "O+", km: 1, lastDonated: new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10) });
    await addDonor({ group: "O+", km: 1, verified: false, simulated: false });
    await addDonor({ group: "O+", km: 1, available: false });
    await addDonor({ group: "O+", km: 12 });

    const id = await newRequest("O+");
    const alerted = await alertedPhones(id);

    expect(alerted.map((row) => row.phone).sort()).toEqual([good, universal].sort());
    const events = (await view(id)).events.map((event) => event.message).join("\n");
    expect(events).toContain("Skipped 1 donor who donated too recently");
    expect(events).toContain("Wave 1: alerting 2 donors within 5 km");
  });

  it("covers a request when a donor accepts, then closes the rest", async () => {
    const first = await addDonor({ km: 1 });
    const second = await addDonor({ km: 2 });
    const id = await newRequest();

    await handleInbound(first, "YES", true);

    const state = await view(id);
    expect(state.status).toBe("fulfilled");
    expect(state.acceptedDonors).toHaveLength(1);
    expect(state.acceptedDonors[0].phone).toBe(first);
    expect(state.counts.waiting).toBe(0);
    expect(await lastMessage(first)).toContain("+91 90000 00001");

    await handleInbound(second, "yes", true);
    expect((await view(id)).acceptedDonors).toHaveLength(1);
    expect(await lastMessage(second)).toContain("already been covered");
  });

  it("gives the last unit to exactly one of several simultaneous donors", async () => {
    const phones = await Promise.all(Array.from({ length: 5 }, (_, i) => addDonor({ km: 1 + i * 0.2 })));
    const id = await newRequest();
    expect(await alertedPhones(id)).toHaveLength(5);

    await Promise.all(phones.map((phone) => handleInbound(phone, "YES", true)));

    const state = await view(id);
    expect(state.status).toBe("fulfilled");
    expect(state.acceptedDonors).toHaveLength(1);
    const [row] = await query<{ accepted_count: number }>(`SELECT accepted_count FROM requests WHERE id = $1`, [id]);
    expect(row.accepted_count).toBe(1);

    const contactSharedWith = await Promise.all(phones.map(lastMessage));
    expect(contactSharedWith.filter((body) => body.includes("+91 90000 00001"))).toHaveLength(1);
  });

  it("starts one wave however many status pages poll at once", async () => {
    await Promise.all(Array.from({ length: 4 }, () => addDonor({ km: 1 })));
    await Promise.all(Array.from({ length: 4 }, () => addDonor({ km: 2 })));
    config.donorsPerWave = 2;
    const id = await newRequest();
    expect((await alertedPhones(id)).filter((row) => row.wave === 1)).toHaveLength(2);

    config.waveTimeoutSeconds = 0;
    await Promise.all(Array.from({ length: 12 }, () => advanceRequest(id)));

    const alerted = await alertedPhones(id);
    expect(new Set(alerted.map((row) => row.phone)).size).toBe(alerted.length);
    expect(alerted.length).toBeLessThanOrEqual(8);
    const state = await view(id);
    expect(state.wave).toBe(alerted.reduce((max, row) => Math.max(max, row.wave), 0));
  });

  it("does not start a second wave while one is still being sent", async () => {
    const near = await Promise.all([1, 2, 3].map((km) => addDonor({ km })));
    await Promise.all(Array.from({ length: 9 }, (_, i) => addDonor({ km: 3.5 + i * 0.1 })));
    config.donorsPerWave = 3;
    const id = await newRequest();
    expect(await alertedPhones(id)).toHaveLength(3);

    // Status pages polling flat out, across the gap between claiming wave 2 and
    // recording its first alert.
    let polling = true;
    const pollers = Array.from({ length: 4 }, async () => {
      while (polling) await advanceRequest(id);
    });
    await Promise.all(near.map((phone) => handleInbound(phone, "NO", true)));
    polling = false;
    await Promise.all(pollers);
    const settled = await query<{ wave: number }>(`SELECT DISTINCT wave FROM notifications WHERE request_id = $1`, [id]);

    expect(settled.map((row) => row.wave).sort()).toEqual([1, 2]);
    expect(await alertedPhones(id)).toHaveLength(6);
  });

  it("widens right away once everyone in a wave has declined", async () => {
    const near = await addDonor({ km: 1 });
    const far = await addDonor({ km: 30 });
    const id = await newRequest();
    expect((await alertedPhones(id)).map((row) => row.phone)).toEqual([near]);

    await handleInbound(near, "nahi", true);

    const state = await view(id);
    expect(state.wave).toBe(2);
    expect(state.radiusKm).toBe(40);
    expect((await alertedPhones(id)).map((row) => row.phone).sort()).toEqual([near, far].sort());
    expect(state.events.map((event) => event.message)).toContain("No more eligible donors within 15 km, widening to 40 km");
  });

  it("widens when a wave times out with no reply", async () => {
    await addDonor({ km: 1 });
    const later = await addDonor({ km: 10 });
    const id = await newRequest();

    await advanceRequest(id);
    expect(await alertedPhones(id)).toHaveLength(1);

    config.waveTimeoutSeconds = 0;
    await advanceRequest(id);
    expect((await alertedPhones(id)).map((row) => row.phone)).toContain(later);
  });

  it("reports exhaustion and still honours a late yes", async () => {
    const only = await addDonor({ km: 1 });
    config.waveTimeoutSeconds = 0;
    const id = await newRequest();
    await advanceRequest(id);

    const exhausted = await view(id);
    expect(exhausted.exhausted).toBe(true);
    expect(exhausted.status).toBe("open");
    expect(exhausted.events.at(-1)?.message).toContain("eRaktKosh");
    expect(exhausted.events.map((event) => event.kind)).not.toContain("widening");

    await handleInbound(only, "yes", true);
    expect((await view(id)).status).toBe("fulfilled");
  });

  it("keeps searching until every unit is covered", async () => {
    const phones = await Promise.all([1, 2, 3].map((km) => addDonor({ km })));
    const id = await newRequest("O+", 2);

    await handleInbound(phones[0], "YES", true);
    expect((await view(id)).status).toBe("open");

    await handleInbound(phones[1], "YES", true);
    const state = await view(id);
    expect(state.status).toBe("fulfilled");
    expect(state.acceptedDonors).toHaveLength(2);
  });

  it("removes a donor from matching once a donation is confirmed", async () => {
    const donor = await addDonor({ km: 1 });
    const id = await newRequest();
    await handleInbound(donor, "YES", true);
    const [{ alertId }] = (await view(id)).acceptedDonors;

    expect(await markDonated(id, alertId)).toBe(true);
    expect(await markDonated(id, alertId)).toBe(false);

    const [row] = await query<{ last_donated_on: string }>(`SELECT last_donated_on FROM donors WHERE phone = $1`, [donor]);
    expect(row.last_donated_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const next = await newRequest();
    expect(await alertedPhones(next)).toHaveLength(0);
  });

  it("does not alert a donor who is already committed elsewhere", async () => {
    const donor = await addDonor({ km: 1 });
    const first = await newRequest();
    await handleInbound(donor, "YES", true);
    expect((await view(first)).status).toBe("fulfilled");

    expect(await alertedPhones(await newRequest())).toHaveLength(0);
  });

  it("needs a first WhatsApp message before alerting a real donor", async () => {
    const donor = await addDonor({ km: 1, verified: false, simulated: false });
    expect(await alertedPhones(await newRequest())).toHaveLength(0);

    await handleInbound(donor, "hi", true);
    expect(await lastMessage(donor)).toContain("verified");

    expect((await alertedPhones(await newRequest())).map((row) => row.phone)).toEqual([donor]);
  });

  it("asks again rather than guessing on an unclear reply", async () => {
    const donor = await addDonor({ km: 1 });
    const id = await newRequest();

    await handleInbound(donor, "yes but I can't come today", true);

    expect((await view(id)).counts.waiting).toBe(1);
    expect((await view(id)).status).toBe("open");
    expect(await lastMessage(donor)).toContain("YES");
  });

  it("supports pause, resume and full deletion", async () => {
    const donor = await addDonor({ km: 1 });

    await handleInbound(donor, "PAUSE", true);
    expect(await alertedPhones(await newRequest())).toHaveLength(0);

    await handleInbound(donor, "RESUME", true);
    expect(await alertedPhones(await newRequest())).toHaveLength(1);

    await handleInbound(donor, "STOP", true);
    expect(await query(`SELECT 1 FROM donors WHERE phone = $1`, [donor])).toHaveLength(0);
  });

  it("tells a donor who accepted when the family cancels", async () => {
    const donor = await addDonor({ km: 1 });
    const id = await newRequest();
    await handleInbound(donor, "YES", true);

    expect(await cancelRequest(id)).toBe(true);
    expect((await view(id)).status).toBe("cancelled");
    expect(await lastMessage(donor)).toContain("no longer need to go");
    expect(await cancelRequest(id)).toBe(false);
  });

  it("hides everyone but accepted donors from the status page", async () => {
    const yes = await addDonor({ km: 1 });
    const silent = await addDonor({ km: 2 });
    const id = await newRequest("O+", 2);
    await handleInbound(yes, "YES", true);

    const payload = JSON.stringify(await view(id));
    expect(payload).toContain(yes);
    expect(payload).not.toContain(silent);
  });

  it("never sends simulated donors to Twilio", async () => {
    config.twilio.accountSid = "ACtest";
    config.twilio.authToken = "secret";
    twilioCreate.mockResolvedValue({ sid: "SM1", status: "queued" });
    const simulated = await addDonor({ km: 1, simulated: true });
    const real = await addDonor({ km: 2, simulated: false });

    await newRequest();
    await globalThis.raktdootSendQueue;

    expect(twilioCreate).toHaveBeenCalledTimes(1);
    expect(twilioCreate.mock.calls[0][0].to).toBe(`whatsapp:${real}`);
    expect(await lastMessage(simulated)).toContain("Urgent");
  });

  it("spaces real sends out to respect the sandbox limit", async () => {
    config.twilio.accountSid = "ACtest";
    config.twilio.authToken = "secret";
    config.twilio.sendSpacingMs = 120;
    const sentAt: number[] = [];
    twilioCreate.mockImplementation(async () => {
      sentAt.push(Date.now());
      return { sid: `SM${sentAt.length}`, status: "queued" };
    });

    await Promise.all([1, 2, 3].map(() => sendWhatsApp({ to: "+919999999999", body: "x" })));
    await globalThis.raktdootSendQueue;
    await query(`DELETE FROM messages WHERE phone = '+919999999999'`);

    expect(sentAt).toHaveLength(3);
    expect(sentAt[1] - sentAt[0]).toBeGreaterThanOrEqual(110);
    expect(sentAt[2] - sentAt[1]).toBeGreaterThanOrEqual(110);
  });

  it("moves on when WhatsApp cannot deliver to a donor", async () => {
    config.twilio.accountSid = "ACtest";
    config.twilio.authToken = "secret";
    twilioCreate.mockResolvedValue({ sid: "SMfail", status: "queued" });
    await addDonor({ km: 1, simulated: false });
    const backup = await addDonor({ km: 10 });

    const id = await newRequest();
    await globalThis.raktdootSendQueue;
    await recordDeliveryStatus("SMfail", "undelivered", "63015");
    await advanceRequest(id);

    const state = await view(id);
    expect(state.counts.failed).toBe(1);
    expect((await alertedPhones(id)).map((row) => row.phone)).toContain(backup);
    await query(`DELETE FROM messages WHERE provider_sid = 'SMfail'`);
  });

  it("marks the alert failed when Twilio rejects the send outright", async () => {
    config.twilio.accountSid = "ACtest";
    config.twilio.authToken = "secret";
    twilioCreate.mockRejectedValue(new Error("Authenticate"));
    await addDonor({ km: 1, simulated: false });

    const id = await newRequest();
    await globalThis.raktdootSendQueue;

    expect((await view(id)).counts.failed).toBe(1);
  });
});

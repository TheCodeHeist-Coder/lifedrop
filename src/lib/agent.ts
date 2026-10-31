import type { BloodGroup } from "./blood";
import { compatibleDonorGroups } from "./blood";
import { config } from "./config";
import { query, transaction, type Queryable } from "./db";
import { todayInIndia } from "./eligibility";
import { boundingBox } from "./geo";
import { selectDonors, type Candidate, type RankedDonor } from "./matching";
import { displayPhone } from "./phone";
import { sendWhatsApp } from "./whatsapp";

export type RequestRow = {
  id: string;
  blood_group: BloodGroup;
  units_needed: number;
  hospital: string;
  area: string;
  lat: number;
  lng: number;
  contact_name: string;
  contact_phone: string;
  status: "open" | "fulfilled" | "cancelled";
  accepted_count: number;
  current_wave: number;
  radius_index: number;
  wave_started_at: string | null;
  wave_launched_at: string | null;
  exhausted_at: string | null;
  created_at: string;
};

export type NewRequest = {
  bloodGroup: BloodGroup;
  units: number;
  hospital: string;
  area: string;
  lat: number;
  lng: number;
  contactName: string;
  contactPhone: string;
  rawText?: string | null;
};

const WAVE_LAUNCH_LIMIT_SECONDS = 30;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const firstName = (name: string) => name.split(" ")[0];

// Requests made with the device's location have no area name to show.
export const placeOf = (request: { hospital: string; area: string }) =>
  [request.hospital, request.area].filter(Boolean).join(", ");

function logEvent(db: Queryable | null, requestId: string, kind: string, message: string) {
  const sql = `INSERT INTO events (request_id, kind, message) VALUES ($1, $2, $3)`;
  const params = [requestId, kind, message];
  return db ? db.query(sql, params) : query(sql, params);
}

export async function createRequest(input: NewRequest): Promise<string> {
  const [request] = await query<{ id: string }>(
    `INSERT INTO requests
       (blood_group, units_needed, hospital, area, lat, lng, contact_name, contact_phone, raw_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      input.bloodGroup,
      input.units,
      input.hospital,
      input.area,
      input.lat,
      input.lng,
      input.contactName,
      input.contactPhone,
      input.rawText ?? null,
    ],
  );
  await logEvent(
    null,
    request.id,
    "created",
    `Request received: ${plural(input.units, "unit")} of ${input.bloodGroup} at ${input.hospital}`,
  );
  await advanceRequest(request.id);
  return request.id;
}

// Moves a request forward if it is due. Called whenever a request is created, read
// or replied to, so no background job is needed: the status page polling this is
// what keeps the search moving.
export async function advanceRequest(id: string): Promise<void> {
  const [request] = await query<RequestRow & { wave_age: number | null }>(
    `SELECT *, EXTRACT(EPOCH FROM (now() - wave_started_at))::float8 AS wave_age FROM requests WHERE id = $1`,
    [id],
  );
  if (!request || request.status !== "open" || request.exhausted_at) return;

  if (request.current_wave > 0) {
    // A wave is claimed before its alerts exist. A poll landing in that gap would
    // see nobody waiting and start another wave straight away. The time limit stops
    // a server crash mid-launch from freezing the request.
    const launching = !request.wave_launched_at && (request.wave_age ?? 0) < WAVE_LAUNCH_LIMIT_SECONDS;
    if (launching) return;

    const [{ pending }] = await query<{ pending: number }>(
      `SELECT count(*)::int AS pending FROM notifications
       WHERE request_id = $1 AND wave = $2 AND status = 'pending'`,
      [id, request.current_wave],
    );
    const stillInTime = (request.wave_age ?? 0) < config.waveTimeoutSeconds;
    if (pending > 0 && stillInTime) return;
  }

  // Several status pages can poll at once. Only the one that wins this update
  // starts the next wave, so no donor is alerted twice.
  const wave = request.current_wave + 1;
  const claimed = await transaction(async (db) => {
    const result = await db.query(
      `UPDATE requests SET current_wave = $3, wave_started_at = now(), wave_launched_at = NULL
       WHERE id = $1 AND current_wave = $2 AND status = 'open' AND exhausted_at IS NULL`,
      [id, request.current_wave, wave],
    );
    return result.rowCount === 1;
  });
  if (claimed) await runWave(request, wave);
}

async function fetchCandidates(request: RequestRow, radiusKm: number): Promise<Candidate[]> {
  const box = boundingBox(request, radiusKm);
  return query<Candidate>(
    `SELECT d.id, d.name, d.phone, d.blood_group, d.sex, d.date_of_birth, d.weight_kg,
            d.last_donated_on, d.lat, d.lng, d.simulated
     FROM donors d
     WHERE d.blood_group = ANY($1::text[])
       AND d.lat BETWEEN $2 AND $3
       AND d.lng BETWEEN $4 AND $5
       AND d.available
       AND (d.simulated OR d.whatsapp_verified_at IS NOT NULL)
       AND NOT EXISTS (
         SELECT 1 FROM notifications n WHERE n.request_id = $6 AND n.donor_id = d.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM notifications n JOIN requests r ON r.id = n.request_id
         WHERE n.donor_id = d.id
           AND ((n.status = 'pending' AND r.status = 'open')
             OR (n.status = 'accepted' AND n.responded_at > now() - make_interval(days => $7)))
       )`,
    [
      compatibleDonorGroups(request.blood_group),
      box.minLat,
      box.maxLat,
      box.minLng,
      box.maxLng,
      request.id,
      config.commitmentHoldDays,
    ],
  );
}

async function runWave(request: RequestRow, wave: number): Promise<void> {
  const remaining = request.units_needed - request.accepted_count;
  const limit = config.donorsPerWave * remaining;
  let emptyRadiusKm: number | null = null;

  for (let index = request.radius_index; index < config.radiiKm.length; index++) {
    const radiusKm = config.radiiKm[index];
    const candidates = await fetchCandidates(request, radiusKm);
    const selection = selectDonors(request.blood_group, request, candidates, radiusKm, limit);

    if (selection.selected.length === 0) {
      emptyRadiusKm = radiusKm;
      continue;
    }

    await query(`UPDATE requests SET radius_index = $2 WHERE id = $1`, [request.id, index]);
    if (emptyRadiusKm !== null) {
      await logEvent(
        null,
        request.id,
        "widening",
        `No more eligible donors within ${emptyRadiusKm} km, widening to ${radiusKm} km`,
      );
    }
    if (selection.skippedRecentDonors > 0) {
      await logEvent(
        null,
        request.id,
        "filtered",
        `Skipped ${plural(selection.skippedRecentDonors, "donor")} who donated too recently`,
      );
    }
    await logEvent(
      null,
      request.id,
      "wave",
      `Wave ${wave}: alerting ${plural(selection.selected.length, "donor")} within ${radiusKm} km on WhatsApp`,
    );
    await alertDonors(request, wave, selection.selected);
    await query(`UPDATE requests SET wave_launched_at = now() WHERE id = $1`, [request.id]);
    return;
  }

  await query(`UPDATE requests SET exhausted_at = now() WHERE id = $1`, [request.id]);
  await logEvent(
    null,
    request.id,
    "exhausted",
    `Every eligible donor within ${config.radiiKm.at(-1)} km has been asked. Check blood centre stock on eRaktKosh too`,
  );
}

function alertMessage(request: RequestRow, donor: RankedDonor): string {
  return [
    `🩸 *Urgent: ${request.blood_group} blood needed*`,
    "",
    `Hi ${firstName(donor.name)}, a patient at ${placeOf(request)} needs a donor. You are about ${Math.max(1, Math.round(donor.distance_km))} km away.`,
    "",
    "Can you reach there in the next few hours? Reply *YES* or *NO*.",
    "",
    "The blood centre does the final health check. Reply PAUSE to stop alerts.",
  ].join("\n");
}

async function alertDonors(request: RequestRow, wave: number, donors: RankedDonor[]): Promise<void> {
  for (const donor of donors) {
    const inserted = await query(
      `INSERT INTO notifications (request_id, donor_id, wave, distance_km)
       VALUES ($1, $2, $3, $4) ON CONFLICT (request_id, donor_id) DO NOTHING RETURNING id`,
      [request.id, donor.id, wave, donor.distance_km],
    );
    if (inserted.length === 0) continue;
    await sendWhatsApp({
      to: donor.phone,
      body: alertMessage(request, donor),
      requestId: request.id,
      simulated: donor.simulated,
    });
  }
}

type PendingAlert = { id: string; request_id: string; donor_id: string };

export async function findPendingAlert(donorId: string): Promise<PendingAlert | null> {
  const [alert] = await query<PendingAlert>(
    `SELECT n.id, n.request_id, n.donor_id
     FROM notifications n JOIN requests r ON r.id = n.request_id
     WHERE n.donor_id = $1 AND n.status = 'pending' AND r.status = 'open'
     ORDER BY n.sent_at DESC LIMIT 1`,
    [donorId],
  );
  return alert ?? null;
}

export type Decision =
  | { outcome: "accepted"; request: RequestRow }
  | { outcome: "declined"; requestId: string }
  | { outcome: "already_filled" }
  | { outcome: "no_alert" };

// A transaction, because two donors can say YES in the same moment for the last
// unit. The conditional update lets exactly one of them through, and the other is
// thanked and told they are not needed rather than sent to the hospital.
export async function recordDecision(
  alertId: string,
  decision: "accept" | "decline",
  replyText: string,
  donorName: string,
): Promise<Decision> {
  const result = await transaction<Decision>(async (db) => {
    const { rows } = await db.query<{ request_id: string }>(
      `UPDATE notifications SET status = $2, reply_text = $3, responded_at = now()
       WHERE id = $1 AND status = 'pending' RETURNING request_id`,
      [alertId, decision === "accept" ? "accepted" : "declined", replyText.slice(0, 500)],
    );
    if (rows.length === 0) return { outcome: "no_alert" };
    const requestId = rows[0].request_id;

    if (decision === "decline") {
      await logEvent(db, requestId, "declined", "1 donor is not available");
      return { outcome: "declined", requestId };
    }

    const updated = await db.query<RequestRow>(
      `UPDATE requests
       SET accepted_count = accepted_count + 1,
           status = CASE WHEN accepted_count + 1 >= units_needed THEN 'fulfilled' ELSE status END
       WHERE id = $1 AND status = 'open' AND accepted_count < units_needed
       RETURNING *`,
      [requestId],
    );
    const request = updated.rows[0];
    if (!request) {
      await db.query(`UPDATE notifications SET status = 'closed' WHERE id = $1`, [alertId]);
      return { outcome: "already_filled" };
    }

    await logEvent(db, requestId, "accepted", `${firstName(donorName)} accepted and is on the way`);
    if (request.status === "fulfilled") {
      await db.query(`UPDATE notifications SET status = 'closed' WHERE request_id = $1 AND status = 'pending'`, [
        requestId,
      ]);
      await logEvent(db, requestId, "fulfilled", "All units covered. Remaining alerts closed");
    }
    return { outcome: "accepted", request };
  });

  if (result.outcome === "declined") await advanceRequest(result.requestId);
  return result;
}

export function acceptedMessage(request: RequestRow): string {
  return [
    "🙏 *Thank you!* The family has been told you are coming.",
    "",
    `Go to: ${placeOf(request)}`,
    `Contact: ${request.contact_name}, ${displayPhone(request.contact_phone)}`,
    "",
    "Carry a photo ID. The blood centre will do the final health check.",
  ].join("\n");
}

export async function markDonated(requestId: string, alertId: string): Promise<boolean> {
  const today = todayInIndia();
  return transaction(async (db) => {
    const { rows } = await db.query<{ donor_id: string }>(
      `UPDATE notifications SET donated_on = $3
       WHERE id = $1 AND request_id = $2 AND status = 'accepted' AND donated_on IS NULL
       RETURNING donor_id`,
      [alertId, requestId, today],
    );
    if (rows.length === 0) return false;
    // This is what keeps eligibility honest: the same donor drops out of matching
    // for the full gap without anyone having to update their record by hand.
    await db.query(`UPDATE donors SET last_donated_on = $2 WHERE id = $1`, [rows[0].donor_id, today]);
    await logEvent(db, requestId, "donated", "Donation confirmed. Donor record updated");
    return true;
  });
}

export async function cancelRequest(id: string): Promise<boolean> {
  const cancelled = await transaction(async (db) => {
    const { rowCount } = await db.query(
      `UPDATE requests SET status = 'cancelled' WHERE id = $1 AND status IN ('open', 'fulfilled')`,
      [id],
    );
    if (rowCount !== 1) return false;
    await db.query(`UPDATE notifications SET status = 'closed' WHERE request_id = $1 AND status = 'pending'`, [id]);
    await logEvent(db, id, "cancelled", "Request cancelled by the family");
    return true;
  });
  if (!cancelled) return false;

  // Anyone already travelling needs to know they can turn back.
  const accepted = await query<{ phone: string; simulated: boolean }>(
    `SELECT d.phone, d.simulated FROM notifications n JOIN donors d ON d.id = n.donor_id
     WHERE n.request_id = $1 AND n.status = 'accepted'`,
    [id],
  );
  for (const donor of accepted) {
    await sendWhatsApp({
      to: donor.phone,
      body: "The family has cancelled this request, so you no longer need to go. Thank you for offering to help.",
      requestId: id,
      simulated: donor.simulated,
    });
  }
  return true;
}

export type RequestView = {
  id: string;
  status: RequestRow["status"];
  bloodGroup: BloodGroup;
  units: number;
  place: string;
  createdAt: string;
  wave: number;
  radiusKm: number;
  searchRingsKm: number[];
  exhausted: boolean;
  secondsUntilNextWave: number | null;
  counts: { contacted: number; waiting: number; declined: number; failed: number; accepted: number };
  acceptedDonors: {
    alertId: string;
    name: string;
    phone: string;
    bloodGroup: BloodGroup;
    distanceKm: number;
    simulated: boolean;
    donated: boolean;
  }[];
  events: { id: string; kind: string; message: string; at: string }[];
};

export async function getRequestView(id: string): Promise<RequestView | null> {
  const [request] = await query<RequestRow & { wave_age: number | null }>(
    `SELECT *, EXTRACT(EPOCH FROM (now() - wave_started_at))::float8 AS wave_age FROM requests WHERE id = $1`,
    [id],
  );
  if (!request) return null;

  const [alerts, events] = await Promise.all([
    query<{
      id: string;
      status: string;
      distance_km: number;
      donated_on: string | null;
      name: string;
      phone: string;
      blood_group: BloodGroup;
      simulated: boolean;
    }>(
      `SELECT n.id, n.status, n.distance_km, n.donated_on, d.name, d.phone, d.blood_group, d.simulated
       FROM notifications n JOIN donors d ON d.id = n.donor_id WHERE n.request_id = $1`,
      [id],
    ),
    query<{ id: string; kind: string; message: string; at: string }>(
      `SELECT id, kind, message, at FROM events WHERE request_id = $1 ORDER BY at ASC`,
      [id],
    ),
  ]);

  const count = (status: string) => alerts.filter((alert) => alert.status === status).length;
  const searching = request.status === "open" && !request.exhausted_at && request.wave_age !== null;

  // Only donors who said yes are named here. Everyone else stays a number, and this
  // page is the only place a donor's phone number is ever shown.
  return {
    id: request.id,
    status: request.status,
    bloodGroup: request.blood_group,
    units: request.units_needed,
    place: placeOf(request),
    createdAt: request.created_at,
    wave: request.current_wave,
    radiusKm: config.radiiKm[request.radius_index],
    searchRingsKm: config.radiiKm,
    exhausted: Boolean(request.exhausted_at),
    secondsUntilNextWave: searching
      ? Math.max(0, Math.ceil(config.waveTimeoutSeconds - (request.wave_age ?? 0)))
      : null,
    counts: {
      contacted: alerts.length,
      waiting: count("pending"),
      declined: count("declined"),
      failed: count("failed"),
      accepted: count("accepted"),
    },
    acceptedDonors: alerts
      .filter((alert) => alert.status === "accepted")
      .map((alert) => ({
        alertId: alert.id,
        name: alert.name,
        phone: alert.phone,
        bloodGroup: alert.blood_group,
        distanceKm: alert.distance_km,
        simulated: alert.simulated,
        donated: Boolean(alert.donated_on),
      })),
    events,
  };
}

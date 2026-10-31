import { compatibleDonorGroups, type BloodGroup } from "./blood";
import { checkEligibility, type EligibilityInput } from "./eligibility";
import { distanceKm, type LatLng } from "./geo";

export type Candidate = EligibilityInput &
  LatLng & {
    id: string;
    name: string;
    phone: string;
    blood_group: BloodGroup;
    simulated: boolean;
  };

export type RankedDonor = Candidate & { distance_km: number };

export type Selection = {
  selected: RankedDonor[];
  // Everyone in range and eligible, including those beyond this wave's limit.
  eligibleInRange: number;
  skippedRecentDonors: number;
  skippedOtherReasons: number;
};

// Compatibility and eligibility are decided here in plain code, never by a model.
export function selectDonors(
  patientGroup: BloodGroup,
  center: LatLng,
  candidates: Candidate[],
  radiusKm: number,
  limit: number,
  today?: string,
): Selection {
  const preference = compatibleDonorGroups(patientGroup);
  let skippedRecentDonors = 0;
  let skippedOtherReasons = 0;
  const inRange: RankedDonor[] = [];

  for (const candidate of candidates) {
    if (!preference.includes(candidate.blood_group)) continue;
    const distance = distanceKm(center, candidate);
    if (distance > radiusKm) continue;

    const eligibility = checkEligibility(candidate, today);
    if (eligibility.eligible) inRange.push({ ...candidate, distance_km: distance });
    else if (eligibility.recentlyDonated) skippedRecentDonors++;
    else skippedOtherReasons++;
  }

  inRange.sort(
    (a, b) =>
      preference.indexOf(a.blood_group) - preference.indexOf(b.blood_group) || a.distance_km - b.distance_km,
  );

  return {
    selected: inRange.slice(0, limit),
    eligibleInRange: inRange.length,
    skippedRecentDonors,
    skippedOtherReasons,
  };
}

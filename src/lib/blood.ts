export const BLOOD_GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

// Red cell compatibility: who a patient of each group can receive from.
// Ordered by preference, so the universal O- is asked last and stays available
// for the patients who have no other option.
const RED_CELL_DONORS: Record<BloodGroup, BloodGroup[]> = {
  "O-": ["O-"],
  "O+": ["O+", "O-"],
  "A-": ["A-", "O-"],
  "A+": ["A+", "A-", "O+", "O-"],
  "B-": ["B-", "O-"],
  "B+": ["B+", "B-", "O+", "O-"],
  "AB-": ["AB-", "A-", "B-", "O-"],
  "AB+": ["AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-"],
};

export function isBloodGroup(value: unknown): value is BloodGroup {
  return typeof value === "string" && (BLOOD_GROUPS as readonly string[]).includes(value);
}

export function compatibleDonorGroups(patient: BloodGroup): BloodGroup[] {
  return RED_CELL_DONORS[patient];
}

export function canDonateTo(donor: BloodGroup, patient: BloodGroup): boolean {
  return RED_CELL_DONORS[patient].includes(donor);
}

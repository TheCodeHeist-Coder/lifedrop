export const APP_NAME = "RaktDoot";

export const ERAKTKOSH_URL = "https://eraktkosh.mohfw.gov.in/eraktkoshPortal/";

export const config = {
  // Search rings, nearest first. The last ring exists for the districts with no
  // blood centre of their own, where the nearest donor can be hours away.
  radiiKm: [5, 15, 40, 100, 300],
  donorsPerWave: Number(process.env.DONORS_PER_WAVE ?? 5),
  // Short so a live demo moves. A real deployment would use around 600.
  waveTimeoutSeconds: Number(process.env.WAVE_TIMEOUT_SECONDS ?? 45),
  maxOpenRequestsPerPhone: 3,
  // A donor who accepted is not alerted again for this long, even if they have
  // not yet been marked as donated.
  commitmentHoldDays: 3,
  publicUrl: process.env.PUBLIC_URL?.replace(/\/$/, ""),
  demoMode: process.env.DEMO_MODE === "true",
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886",
    // Twilio's sandbox accepts one message every three seconds.
    sendSpacingMs: Number(process.env.TWILIO_SEND_SPACING_MS ?? 3100),
  },
  sandboxJoinCode: process.env.NEXT_PUBLIC_TWILIO_SANDBOX_CODE,
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
  },
};

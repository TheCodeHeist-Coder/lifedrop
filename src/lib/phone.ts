// Accepts the ways people actually write an Indian mobile number and returns
// E.164, or null if it is not one.
export function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/^whatsapp:/i, "").replace(/[^\d]/g, "");
  const national =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits;
  return /^[6-9]\d{9}$/.test(national) ? `+91${national}` : null;
}

// Twilio sends "whatsapp:+919876543210". Teammates abroad are kept as they come.
export function phoneFromWhatsAppAddress(address: string): string {
  return address.replace(/^whatsapp:/i, "").trim();
}

export function displayPhone(phone: string): string {
  const match = phone.match(/^\+91(\d{5})(\d{5})$/);
  return match ? `+91 ${match[1]} ${match[2]}` : phone;
}

/**
 * Contact-field validation shared by every place a customer is created or edited,
 * so the three add paths and the edit path cannot drift. Each helper returns the
 * NORMALISED value to store, or throws a message fit for an Alert.
 *
 * Every field except name is optional: a shopkeeper adding a customer mid-sale
 * rarely has all of it. Blank input therefore normalises to null, never to an error.
 */

/** Pakistani CNIC: 13 digits, printed 00000-0000000-0. Stored in that printed form. */
export const normalizeCnic = (input?: string | null): string | null => {
  const text = (input ?? '').trim();
  if (!text) return null;
  const digits = text.replace(/[\s-]/g, '');
  // Accept either the bare 13 digits or the dashed print form — nothing else.
  if (!/^\d{13}$/.test(digits) || !/^(\d{13}|\d{5}-\d{7}-\d)$/.test(text)) {
    throw new Error('CNIC must be 13 digits, like 12345-1234567-1.');
  }
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
};

export const isValidCnic = (input?: string | null): boolean => {
  try { return normalizeCnic(input) !== null; } catch { return false; }
};

export const normalizeEmail = (input?: string | null): string | null => {
  const text = (input ?? '').trim();
  if (!text) return null;
  // One @, something either side, a dot in the domain, no whitespace.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw new Error('Enter a valid email address.');
  return text.toLowerCase();
};

export const isValidEmail = (input?: string | null): boolean => {
  try { return normalizeEmail(input) !== null; } catch { return false; }
};

/** Digits with optional leading +, 7–15 digits (covers 0300 1234567 and +92 300 1234567). */
export const normalizePhone = (input?: string | null): string | null => {
  const text = (input ?? '').trim();
  if (!text) return null;
  const compact = text.replace(/[\s()-]/g, '');
  if (!/^\+?\d{7,15}$/.test(compact)) throw new Error('Enter a valid phone number.');
  return text.replace(/\s+/g, ' ');
};

export const isValidPhone = (input?: string | null): boolean => {
  try { return normalizePhone(input) !== null; } catch { return false; }
};

/** Free-text fields: trimmed, blank → null. */
export const normalizeText = (input?: string | null): string | null => {
  const text = (input ?? '').trim();
  return text || null;
};

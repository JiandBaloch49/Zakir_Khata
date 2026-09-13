/** Reject unapproved fields before constructing SQL or enqueueing a write. */
export function assertAllowedUpdateFields(updates: unknown, allowed: readonly string[]): void {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new Error('Invalid update: expected an object of permitted fields.');
  }
  for (const field of Object.keys(updates)) {
    if (!allowed.includes(field)) {
      throw new Error(`This field cannot be changed: ${field}`);
    }
  }
}

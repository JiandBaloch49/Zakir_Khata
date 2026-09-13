export function getDisplayName(
  entity: {
    name_en?: string;
    name_ur?: string;
    item_name_en?: string;
    item_name_ur?: string;
    item_name?: string;
    partyName?: string;
    party_name?: string;
    name?: string;
    party_name_ur?: string;
    description?: string;
    reason?: string;
  },
  mode: 'en' | 'ur' | 'both' = 'en'
): string {
  if (!entity) return 'Stock Item';

  const en =
    entity.item_name_en ||
    entity.item_name ||
    entity.name_en ||
    entity.partyName ||
    entity.party_name ||
    entity.name ||
    entity.description ||
    entity.reason ||
    'Stock Item';

  const ur = entity.item_name_ur || entity.name_ur || entity.party_name_ur;

  if (mode === 'en') return en;
  if (mode === 'ur') return ur || en; // Fallback to English if no Urdu provided

  // mode === 'both'
  return ur ? `${en} (${ur})` : en;
}

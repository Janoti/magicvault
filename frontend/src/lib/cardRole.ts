// Heuristic card role (mirrors the backend _categorize). Returns the primary role.
export function cardRole(card: any): string | null {
  if (!card) return null
  const t = (card.oracle_text || '').toLowerCase()
  const tl = (card.type_line || '').toLowerCase()
  if (tl.includes('land') && !tl.includes('creature')) return null

  const has = (...ps: string[]) => ps.some((p) => t.includes(p))
  const pw = parseInt(card.power) || 0

  // Order matters: more specific first.
  if (has('destroy all', 'exile all', 'destroy each', 'all creatures get -', 'to each creature', 'each player sacrifices')) return 'wipe'
  if (has('destroy target', 'exile target', 'damage to target creature', 'damage to any target', 'target creature gets -', 'fight target', "target creature you don't control", 'tap target')) return 'removal'
  if (has('add {', 'add one mana', 'add two mana', 'mana of any color') || (has('search your library for') && t.includes('land'))) return 'ramp'
  if (t.includes('counter target') || (t.includes('return target') && t.includes('to its owner'))) return 'interaction'
  if (has('draw a card', 'draw two cards', 'draw three cards', 'draw cards', 'draw that many cards')) return 'draw'
  if (has('win the game', "can't be blocked", 'deals damage equal to') || pw >= 6) return 'finisher'
  return null
}

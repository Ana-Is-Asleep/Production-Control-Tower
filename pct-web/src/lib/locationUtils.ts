// Location codes follow an "[ABBREVIATION]_[COUNTRY]" shape (e.g. "AQ_PT", "IK_PL"). Some
// warehouses are just a supplier's own site under a slightly different code (e.g. "AQO1_PT" is
// the same site as vendor "AQ_PT"), so an exact string match alone misses these.
function splitLocationCode(code: string): { prefix: string; country: string } {
  const [prefix, country] = code.trim().toUpperCase().split('_');
  return { prefix: prefix ?? '', country: country ?? '' };
}

// True when `a` and `b` look like the same physical site — same country suffix, and one
// prefix is a leading substring of the other (covers exact matches like "IK_PL"/"ik_pl" and
// near-matches like "AQ_PT"/"AQO1_PT"). A minimum 2-char shared prefix guards against
// coincidental one-letter collisions between unrelated suppliers.
export function isSameSiteLocation(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = splitLocationCode(a);
  const nb = splitLocationCode(b);
  if (!na.country || na.country !== nb.country) return false;
  const [shorter, longer] = na.prefix.length <= nb.prefix.length ? [na.prefix, nb.prefix] : [nb.prefix, na.prefix];
  return shorter.length >= 2 && longer.startsWith(shorter);
}

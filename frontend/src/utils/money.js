// Ghanaian Cedi. Single source of truth for currency display — every page
// that shows a *_cents value should import this instead of hand-rolling it.
export function formatMoney(cents) {
  return `₵${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

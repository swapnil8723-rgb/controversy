// Dates read the same in India, the US, the UK, Europe, Australia and New Zealand:
// "13 Oct 2026", never 10/13 or 13/10. All dates are calendar dates in UTC.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const day = (d: Date) => `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
export const month = (d: Date) => `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const isoFull = (d: Date) => d.toISOString();
export const anchor = (d: Date, i: number) => `${iso(d)}-${i + 1}`;

export function ago(d: Date, now: Date) {
  const days = Math.floor((now.getTime() - d.getTime()) / 864e5);
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(days / 365.25);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

export const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');

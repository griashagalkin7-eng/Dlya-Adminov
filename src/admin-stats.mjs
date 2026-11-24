// Accounting dates are shift labels: the night belongs to the date it started.
export const DEFAULT_ADMIN_PERCENT = 10;
export function operationalDate(now = new Date()) {
  const local = new Date(now);
  if (local.getHours() < 8) local.setDate(local.getDate() - 1);
  return `${local.getFullYear()}-${String(local.getMonth()+1).padStart(2,'0')}-${String(local.getDate()).padStart(2,'0')}`;
}
export function nextDate(date) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate()+1);
  return next.toISOString().slice(0,10);
}
export function adminDay(state, date) {
  const shifts = state.shifts.filter(s => s.date === date);
  const revenue = shifts.reduce((sum,s) => sum+s.items.reduce((sum,i) => sum+i.unitPrice*i.quantity,0),0);
  const percent = state.adminRates?.[date] ?? state.settings.adminPercent ?? DEFAULT_ADMIN_PERCENT;
  return { date, revenue, percent, amount: percent === null ? null : Math.round(revenue * Math.round(percent * 100) / 10000),
    live: shifts.some(s => s.status === 'active'),
    hasDay: shifts.some(s => s.period === 'day'), hasNight: shifts.some(s => s.period === 'night'), count: shifts.length };
}
export function adminDays(state, month) {
  return [...new Set(state.shifts.filter(s => !month || s.date.startsWith(`${month}-`)).map(s => s.date))]
    .sort().map(day => adminDay(state,day));
}

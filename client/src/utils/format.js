export function formatTime(value) {
  if (!value) return 'Pending';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(value));
}

export function verdictTone(label) {
  if (label === 'GO') return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200';
  if (label === 'NO-GO') return 'border-rose-300/30 bg-rose-300/10 text-rose-200';
  return 'border-amber-300/30 bg-amber-300/10 text-amber-100';
}

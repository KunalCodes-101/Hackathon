export function formatTime(value) {
  if (!value) return 'Pending';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(value));
}

export function verdictTone(label) {
  if (label === 'GO') return 'border-green/30 bg-green/10 text-green';
  if (label === 'NO-GO') return 'border-danger/30 bg-danger/10 text-red-100';
  return 'border-amber/30 bg-amber/10 text-amber';
}

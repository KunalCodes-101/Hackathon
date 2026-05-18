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

export function cleanText(value, fallback = 'Not available') {
  if (value === null || value === undefined) return fallback;
  const text = String(value)
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();

  if (!text || ['n/a', 'na', 'none', 'null', 'undefined'].includes(text.toLowerCase())) {
    return fallback;
  }

  return text;
}

export function cleanList(items = []) {
  const list = Array.isArray(items) ? items : [items];
  return list.map((item) => cleanText(item, '')).filter(Boolean);
}

export function formatNumber(value, fallback = '0') {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(number);
}

export function formatPercent(value, fallback = '0%') {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return `${Math.round(number)}%`;
}

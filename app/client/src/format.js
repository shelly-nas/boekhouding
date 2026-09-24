const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const euroCent = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const getal = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 });

export const eur = (n) => (n == null ? '—' : euro.format(n));
export const eurc = (n) => (n == null ? '—' : euroCent.format(n));
export const num = (n) => (n == null ? '—' : getal.format(n));
export const pct = (n) => (n == null ? '—' : `${getal.format(n)}%`);
export const datum = (s) => (s ? s.split('-').reverse().join('-') : '—');
export const vandaag = () => new Date().toISOString().slice(0, 10);

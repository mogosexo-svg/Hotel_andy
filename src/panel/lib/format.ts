const TZ = 'America/Guayaquil';

/** Dinero en USD desde centavos: $1.250 · $1.250,50 */
export function dinero(centavos: number | null | undefined): string {
  if (centavos == null) return '—';
  const neg = centavos < 0;
  const abs = Math.abs(Math.round(centavos));
  const enteros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cents = abs % 100;
  return `${neg ? '-' : ''}$${enteros}${cents ? ',' + String(cents).padStart(2, '0') : ''}`;
}

/** Número con coma decimal: 0,5 · 12 */
export function numero(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** "Hoy" en Guayaquil como YYYY-MM-DD. */
export function hoyEC(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(ahora);
}

/** 'YYYY-MM-DD' o ISO → "sáb 14 feb". */
export function fechaCorta(valor: string): string {
  const soloDia = valor.length <= 10;
  const d = soloDia ? new Date(valor + 'T12:00:00Z') : new Date(valor);
  const partes = new Intl.DateTimeFormat('es-EC', {
    timeZone: soloDia ? 'UTC' : TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(d);
  const g = (t: string) => (partes.find((p) => p.type === t)?.value ?? '').replace('.', '');
  return `${g('weekday')} ${g('day')} ${g('month')}`;
}

/** "hace 25 min", "hace 2 h", "hace 3 días". */
export function hace(iso: string, ahora: Date = new Date()): string {
  const min = Math.max(0, Math.round((ahora.getTime() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

export function saludo(ahora: Date = new Date()): string {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(ahora));
  return h < 12 ? 'Buen día' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

/** Plural simple para unidades de insumo (rollo → rollos, kg se queda). */
export function unidadPlural(unidad: string, n: number): string {
  if (n === 1 || unidad.length <= 2) return unidad;
  return /[aeiouáéíóú]$/i.test(unidad) ? unidad + 's' : unidad + 'es';
}

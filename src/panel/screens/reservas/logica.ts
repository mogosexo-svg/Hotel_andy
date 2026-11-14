import type { Database } from '../../../lib/database.types';

export type EstadoReserva = Database['public']['Enums']['estado_reserva'];
export type Fuente = Database['public']['Enums']['fuente_reserva'];
export type Canal = Database['public']['Enums']['canal_venta'];

/* ---------- Fechas (YYYY-MM-DD, sin zona: son días de calendario) ---------- */
const DIA_MS = 86_400_000;
const t = (iso: string) => Date.parse(iso + 'T00:00:00Z');

export function sumarDias(iso: string, n: number): string {
  return new Date(t(iso) + n * DIA_MS).toISOString().slice(0, 10);
}
/** Noches entre dos días (b - a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((t(b) - t(a)) / DIA_MS);
}
export function rangoDias(desde: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => sumarDias(desde, i));
}
/** { dia: 'sáb', num: '14', mes: 'feb' } */
export function diaCorto(iso: string): { dia: string; num: string; mes: string } {
  const p = new Intl.DateTimeFormat('es-EC', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).formatToParts(
    new Date(t(iso) + 12 * 3_600_000),
  );
  const g = (k: string) => (p.find((x) => x.type === k)?.value ?? '').replace('.', '');
  return { dia: g('weekday'), num: g('day'), mes: g('month') };
}

/* ---------- Barras del calendario ---------- */
export interface Barra {
  /** Columna inicial (1 = primer día visible). */
  col: number;
  /** Noches visibles dentro de la ventana. */
  span: number;
  recortaIzq: boolean;
  recortaDer: boolean;
}
/** Posición de una reserva [entrada, salida) dentro de la ventana de `n` días desde `desde`. null si no se ve. */
export function barra(entrada: string, salida: string, desde: string, n: number): Barra | null {
  const ini = diasEntre(desde, entrada);
  const fin = diasEntre(desde, salida); // exclusivo
  if (fin <= 0 || ini >= n || fin <= ini) return null;
  const a = Math.max(0, ini);
  const b = Math.min(n, fin);
  return { col: a + 1, span: b - a, recortaIzq: ini < 0, recortaDer: fin > n };
}

/** Reserva en la línea de tiempo: cada día son 2 columnas (mañana y tarde). Entra a la tarde y sale a la mañana. */
export interface Tramo {
  /** Línea de cuadrícula donde empieza (1 = borde izquierdo del primer día). */
  inicio: number;
  /** Línea de cuadrícula donde termina. */
  fin: number;
  recortaIzq: boolean;
  recortaDer: boolean;
}
/** Una cancelada no ocupa; una que sale la mañana del primer día ocupa solo media columna. */
export function tramo(entrada: string, salida: string, desde: string, n: number, estado?: EstadoReserva): Tramo | null {
  if (estado === 'cancelada') return null;
  const ini = diasEntre(desde, entrada);
  const fin = diasEntre(desde, salida);
  if (fin <= ini || fin < 0 || ini >= n) return null;
  return {
    inicio: ini < 0 ? 1 : 2 * ini + 2,
    fin: fin > n ? 2 * n + 1 : 2 * fin + 2,
    recortaIzq: ini < 0,
    recortaDer: fin > n,
  };
}

/** Cuartos libres cada noche de `dias` (una cancelada no ocupa). */
export function libresPorNoche(reservas: { habitacionId: string; entrada: string; salida: string; estado: EstadoReserva }[], totalCuartos: number, dias: string[]): number[] {
  return dias.map((d) => {
    const ocupados = new Set<string>();
    for (const r of reservas) if (r.estado !== 'cancelada' && r.entrada <= d && d < r.salida) ocupados.add(r.habitacionId);
    return totalCuartos - ocupados.size;
  });
}

/** Cuántas reservas llegan y cuántas salen ese día. */
export function movimientos(reservas: { entrada: string; salida: string; estado: EstadoReserva }[], dia: string): { llegan: number; salen: number } {
  let llegan = 0;
  let salen = 0;
  for (const r of reservas) {
    if (r.estado === 'cancelada') continue;
    if (r.entrada === dia) llegan++;
    if (r.salida === dia) salen++;
  }
  return { llegan, salen };
}

/** ¿Cae el día en alguno de los rangos (extremos incluidos)? */
export const enRangos = (dia: string, rangos: { desde: string; hasta: string }[]) => rangos.some((r) => r.desde <= dia && dia <= r.hasta);
/** sábado o domingo */
export const esFinde = (iso: string) => [0, 6].includes(new Date(t(iso) + 12 * 3_600_000).getUTCDay());

/* ---------- Palabras ---------- */
export const ESTADO_RESERVA: Record<EstadoReserva, string> = {
  prereserva: 'Pre-reserva',
  confirmada: 'Confirmada',
  en_curso: 'Alojado',
  finalizada: 'Ya salió',
  cancelada: 'Cancelada',
};
export const FUENTES: { id: Fuente; texto: string }[] = [
  { id: 'whatsapp', texto: 'WhatsApp' },
  { id: 'telefono', texto: 'Teléfono' },
  { id: 'web', texto: 'Web' },
  { id: 'booking', texto: 'Booking' },
  { id: 'airbnb', texto: 'Airbnb' },
  { id: 'walk_in', texto: 'Sin reserva' },
];
export const fuenteTexto = (f: Fuente) => FUENTES.find((x) => x.id === f)?.texto ?? f;
export const canalDe = (f: Fuente): Canal => (f === 'booking' ? 'booking' : f === 'airbnb' ? 'airbnb' : 'directo');

/** "vence en 1 h 20 min" · "vence en 35 min" · "ya venció". */
export function cuentaAtras(venceEn: string, ahora: Date = new Date()): string {
  const min = Math.floor((new Date(venceEn).getTime() - ahora.getTime()) / 60000);
  if (min < 1) return 'ya venció';
  if (min < 60) return `vence en ${min} min`;
  const h = Math.floor(min / 60);
  return `vence en ${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
}

/* ---------- Dinero ---------- */
/** "12,50" · "12.5" · "$12" → centavos. null si no es un monto válido (> 0). */
export function montoACentavos(texto: string): number | null {
  const s = texto.replace(/[$\s]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const c = Math.round(parseFloat(s) * 100);
  return c > 0 ? c : null;
}
export { centavosATexto } from '../../lib/format';
export const anticipoSugerido = (total: number | null, porcentaje: number): number | null =>
  total == null ? null : Math.round((total * porcentaje) / 100);

/* ---------- Validación del formulario (la base vuelve a validar) ---------- */
export interface BorradorReserva {
  entrada: string;
  salida: string;
  habitacionId: string | null;
  personas: number;
  maxPersonas: number;
  hayHuesped: boolean;
}
export function validarReserva(b: BorradorReserva, hoy: string): string | null {
  if (!b.entrada || !b.salida) return 'Elige la fecha de entrada y la de salida.';
  if (b.salida <= b.entrada) return 'La salida tiene que ser después de la entrada.';
  if (b.entrada < hoy) return 'La entrada no puede ser un día que ya pasó.';
  if (!b.habitacionId) return 'Elige un cuarto.';
  if (!Number.isInteger(b.personas) || b.personas < 1) return 'Pon cuántas personas son.';
  if (b.maxPersonas && b.personas > b.maxPersonas) return `En ese cuarto caben máximo ${b.maxPersonas} personas.`;
  if (!b.hayHuesped) return 'Elige o escribe el nombre del huésped.';
  return null;
}

export { sinTildes } from '../../lib/format';

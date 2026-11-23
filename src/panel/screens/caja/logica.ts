import { dinero, hoyEC } from '../../lib/format';
import type { ItemSalida, Medio } from '../../data/insumos';

export type EstadoCaja = 'cuadra' | 'faltan' | 'sobran';

/** Contado menos esperado → estado y frase corta ("Cuadra", "Faltan $2", "Sobran $1,50"). */
export function estadoDiferencia(dif: number): { estado: EstadoCaja; palabra: string; texto: string } {
  if (dif === 0) return { estado: 'cuadra', palabra: 'Cuadra', texto: 'Cuadra' };
  const estado = dif < 0 ? 'faltan' : 'sobran';
  const palabra = dif < 0 ? 'Faltan' : 'Sobran';
  return { estado, palabra, texto: `${palabra} ${dinero(Math.abs(dif))}` };
}

/** Enlace de WhatsApp sin número: la persona elige el contacto. */
export const enlaceWhatsApp = (mensaje: string) => `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

export const nombreTurno = (turno: string) => (turno === 'noche' ? 'la noche' : 'la tarde');

/** "Cierre de la tarde · 15:00" */
export const tituloTurno = (turno: string, hora: string) => `Cierre de ${nombreTurno(turno)} · ${hora}`;

const horaEC = (iso: string) => new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

/** "desde las 00:00 de hoy" / "desde las 22:05 de ayer" / "desde las 09:00 del 20 nov". */
export function desdeTexto(desde: string, ahora: Date = new Date()): string {
  const dia = hoyEC(new Date(desde));
  const hoy = hoyEC(ahora);
  const ayer = hoyEC(new Date(ahora.getTime() - 864e5));
  const cuando = dia === hoy ? 'de hoy' : dia === ayer ? 'de ayer' : `del ${new Intl.DateTimeFormat('es-EC', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(dia + 'T12:00:00Z')).replace('.', '')}`;
  return `desde las ${horaEC(desde)} ${cuando}`;
}

/** Trozos del mensaje: el *negrita* de WhatsApp se dibuja en negrita. */
export function trozosMensaje(mensaje: string): { t: string; b: boolean }[] {
  return mensaje
    .split(/\*([^*\n]+)\*/)
    .map((t, i) => ({ t, b: i % 2 === 1 }))
    .filter((x) => x.t);
}

/** Quién cerró, leído del propio mensaje ("Cerró: Ana"); null si no aparece. */
export const quienCerro = (mensaje: string): string | null => mensaje.match(/Cerr[óo]:?\*?\s*([^\n*·]+)/)?.[1].trim() || null;

/* ───────────── Lo que salió en el turno ───────────── */

export interface ProdSalida {
  id: string;
  seVende: boolean;
  /** Precio de venta en centavos. */
  venta: number | null;
}

/** Se anota como venta solo si se vende y tiene precio; lo demás es "se usó". */
export const esVenta = (p: ProdSalida) => p.seVende && (p.venta ?? 0) > 0;

/** Items para `registrar_salidas_turno`: solo cantidad > 0; las ventas llevan la forma de pago. */
export function armarSalidas(cantidades: Record<string, number>, prods: ProdSalida[], medio: Medio): ItemSalida[] {
  return prods.flatMap((p) => {
    const cantidad = cantidades[p.id] ?? 0;
    if (!(cantidad > 0)) return [];
    return [esVenta(p) ? { producto_id: p.id, cantidad, medio } : { producto_id: p.id, cantidad }];
  });
}

/** Total en vivo de lo vendido, en centavos. */
export const totalVentas = (cantidades: Record<string, number>, prods: ProdSalida[]): number =>
  prods.reduce((s, p) => s + (esVenta(p) ? Math.round((cantidades[p.id] ?? 0) * (p.venta ?? 0)) : 0), 0);

/** Inventario: solo lo que se contó y cambió respecto a lo que había. */
export function armarConteo<P extends { id: string; nombre: string; stock: number | null }>(contado: Record<string, number>, prods: P[]) {
  return prods.flatMap((p) => {
    const n = contado[p.id];
    return n == null || n < 0 || n === p.stock ? [] : [{ id: p.id, nombre: p.nombre, cantidad: n }];
  });
}

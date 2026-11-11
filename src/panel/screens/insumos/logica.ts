/** Lógica pura de insumos y ventas: parseo de lo que se teclea, totales y validaciones. */

/** "0,5" o "0.5" → 0.5. Vacío o inválido → null. Hasta 3 decimales (el cloro va en 0,5 kg). */
export function parseCantidad(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  return Number(t);
}

/** "1,50" → 150 centavos. Hasta 2 decimales; "1.250" es inválido a propósito (no adivinamos). */
export function parseDinero(texto: string): number | null {
  const t = texto.trim().replace(/^\$/, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Centavos → texto editable: 150 → "1,50"; 200 → "2". */
export function centavosATexto(c: number | null | undefined): string {
  if (c == null) return '';
  const e = Math.floor(c / 100);
  const r = c % 100;
  return r ? `${e},${String(r).padStart(2, '0')}` : String(e);
}

/** Cantidad → texto editable con coma: 0.5 → "0,5". */
export const cantidadATexto = (n: number | null | undefined): string => (n == null ? '' : String(n).replace('.', ','));

export interface LineaBorrador {
  productoId: string | null;
  cantidad: string;
  costo: string;
}

export interface LineaValida {
  producto_id: string;
  cantidad: number;
  costo_unit_centavos: number;
}

/** Subtotal de una línea en centavos (0 si falta algo). */
export function subtotalLinea(l: Pick<LineaBorrador, 'cantidad' | 'costo'>): number {
  const c = parseCantidad(l.cantidad);
  const p = parseDinero(l.costo);
  return c == null || p == null ? 0 : Math.round(c * p);
}

export const totalFactura = (ls: Pick<LineaBorrador, 'cantidad' | 'costo'>[]): number =>
  ls.reduce((s, l) => s + subtotalLinea(l), 0);

export interface BorradorFactura {
  proveedor: string;
  numero: string;
  fecha: string;
  lineas: LineaBorrador[];
}

/** Devuelve el primer problema en palabras de la dueña, o las líneas listas para `cargar_factura`. */
export function validarFactura(b: BorradorFactura): { error: string } | { lineas: LineaValida[] } {
  if (!b.proveedor.trim()) return { error: 'Escribe a quién le compraste.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) return { error: 'Pon la fecha de la factura.' };
  const llenas = b.lineas.filter((l) => l.productoId || l.cantidad.trim() || l.costo.trim());
  if (llenas.length === 0) return { error: 'Añade al menos un producto.' };
  const vistos = new Set<string>();
  const out: LineaValida[] = [];
  for (const [i, l] of llenas.entries()) {
    const n = i + 1;
    if (!l.productoId) return { error: `Elige el producto de la línea ${n}.` };
    if (vistos.has(l.productoId)) return { error: 'Un producto está dos veces. Junta las cantidades en una sola línea.' };
    vistos.add(l.productoId);
    const cantidad = parseCantidad(l.cantidad);
    if (cantidad == null || cantidad <= 0) return { error: `Revisa la cantidad de la línea ${n}.` };
    const costo = parseDinero(l.costo);
    if (costo == null) return { error: `Revisa el costo de la línea ${n}. Ejemplo: 1,50` };
    out.push({ producto_id: l.productoId, cantidad, costo_unit_centavos: costo });
  }
  return { lineas: out };
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Búsqueda de productos sin importar tildes ni mayúsculas. */
export function coincide(nombre: string, q: string): boolean {
  const n = sinTildes(q.trim());
  return !n || sinTildes(nombre).includes(n);
}

/** Margen en porcentaje redondeado; null si no hay venta. */
export const margenPct = (venta: number, margen: number): number | null => (venta > 0 ? Math.round((margen / venta) * 100) : null);

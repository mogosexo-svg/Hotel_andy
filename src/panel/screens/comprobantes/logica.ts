import { sinTildes } from '../../lib/format';

/** Motivos rápidos al rechazar: el texto va tal cual al huésped por WhatsApp. */
export const MOTIVOS_RAPIDOS = ['No se ve el monto', 'El monto no coincide', 'No es un comprobante de pago'] as const;

/** Lo que falta para completar el anticipo; nunca negativo. */
export const montoSugerido = (anticipo: number, pagado: number): number => Math.max(0, anticipo - pagado);

export interface Candidata {
  id: string;
  codigo: string;
  huesped: string | null;
  telefono: string | null;
  cuarto: string;
}

const soloDigitos = (s: string) => s.replace(/\D/g, '');

/** Busca por nombre, código, cuarto o teléfono (sin tildes; "0987…" encuentra "+593987…"). */
export function coincide(c: Candidata, consulta: string): boolean {
  const q = sinTildes(consulta.trim());
  if (!q) return true;
  if (sinTildes(`${c.huesped ?? ''} ${c.codigo} ${c.cuarto}`).includes(q)) return true;
  const d = soloDigitos(q).replace(/^0+/, '');
  return d.length >= 3 && soloDigitos(c.telefono ?? '').includes(d);
}

/** Monto escrito por quien revisa → centavos. Acepta 0 (el anticipo ya estaba cubierto); null si no es un monto. */
export function montoEditable(texto: string): number | null {
  const s = texto.replace(/[$\s]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

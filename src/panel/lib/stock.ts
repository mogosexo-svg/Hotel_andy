import { numero, unidadPlural } from './format';

export type NivelStock = 'sin_contar' | 'agotado' | 'bajo' | 'justo' | 'ok' | 'sin_minimo';

export interface Nivel {
  nivel: NivelStock;
  /** 0–1 para la barra. La marca del mínimo queda en MARCA_MINIMO. */
  pct: number;
  frase: string;
}

export const MARCA_MINIMO = 0.4;

/** Stock null = "Sin contar" (no es cero). */
export function nivelStock(stock: number | null, minimo: number | null, unidad: string): Nivel {
  if (stock == null) return { nivel: 'sin_contar', pct: 0, frase: 'Sin contar' };
  const cant = `${numero(stock)} ${unidadPlural(unidad, stock)}`;
  if (stock <= 0) return { nivel: 'agotado', pct: 0, frase: stock < 0 ? `Quedan ${cant}: hay que contar` : 'Se acabó' };
  if (minimo == null || minimo <= 0) return { nivel: 'sin_minimo', pct: 1, frase: `Quedan ${cant}` };
  const pct = Math.min(1, (stock / minimo) * MARCA_MINIMO);
  if (stock <= minimo) return { nivel: 'bajo', pct, frase: `Quedan ${cant}` };
  if (stock <= minimo * 1.5) return { nivel: 'justo', pct, frase: `Quedan ${cant}` };
  return { nivel: 'ok', pct, frase: `Quedan ${cant}` };
}

export const esBajo = (n: NivelStock) => n === 'bajo' || n === 'agotado';

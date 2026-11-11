// Fotos y qué cuarto muestra cada una. Qué cuarto es cada foto NO está confirmado (tipo_sugerido en fotos/fotos.json):
// para corregirlo, cambia SOLO el objeto FOTO_DE_TIPO. Los tipos que no están aquí (cuádruple) salen con marcador, sin foto.
import type { ImageMetadata } from 'astro';
import meta from '../../../fotos/fotos.json';

const archivos = import.meta.glob<{ default: ImageMetadata }>('../../../fotos/*.jpg', { eager: true });

export const FOTO_DE_TIPO: Record<string, string> = {
  doble_sencilla: 'hab-doble-1',
  doble_deluxe: 'hab-matrimonial-vista-1',
  triple: 'hab-triple-1',
  triple_deluxe: 'hab-triple-2',
  familiar: 'hab-dos-camas-sofa-1',
  suite: 'sala-1',
};

export function foto(nombre: string) {
  const img = archivos[`../../../fotos/${nombre}.jpg`]?.default;
  const alt = meta.fotos.find((f) => f.archivo === nombre)?.alt ?? '';
  if (!img) throw new Error(`Falta la foto fotos/${nombre}.jpg`);
  return { img, alt };
}

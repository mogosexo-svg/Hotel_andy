// Fotos y qué cuarto muestra cada una. Qué cuarto es cada foto NO está confirmado (tipo_sugerido en fotos/fotos.json):
// para corregirlo se cambia ese campo. Un tipo sin fotos (triple) sale con un estado sin foto, nunca con una inventada.
import type { ImageMetadata } from 'astro';
import meta from '../../../fotos/fotos.json';

const archivos = import.meta.glob<{ default: ImageMetadata }>('../../../fotos/*.jpg', { eager: true });

export function foto(nombre: string) {
  const img = archivos[`../../../fotos/${nombre}.jpg`]?.default;
  const alt = meta.fotos.find((f) => f.archivo === nombre)?.alt ?? '';
  if (!img) throw new Error(`Falta la foto fotos/${nombre}.jpg`);
  return { img, alt };
}

/** Nombres de las fotos de un tipo, en el orden de fotos.json. */
export const fotosDeTipo = (clave: string): string[] =>
  meta.fotos.filter((f) => 'tipo_sugerido' in f && f.tipo_sugerido === clave).map((f) => f.archivo);

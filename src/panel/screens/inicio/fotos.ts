// Fotos reales del hotel (carpeta fotos/) para el fondo de la tarjeta de pisos. Una por piso, en este orden.
const urls = import.meta.glob<string>('../../../../fotos/*.jpg', { eager: true, query: '?url', import: 'default' });
const ORDEN = ['terraza-1', 'terraza-2', 'terraza-3', 'comedor-terraza-1', 'sala-1'];

export const fotoDePiso = (indice: number): string | undefined =>
  urls[`../../../../fotos/${ORDEN[indice % ORDEN.length]}.jpg`];

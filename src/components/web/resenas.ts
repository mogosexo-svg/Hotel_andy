// Reseñas reales de Google, solo en build y solo si hay clave. Sin clave o si falla: null, y la sección no inventa nada.
export interface Resena { autor: string; uri: string | null; estrellas: number; texto: string; cuando: string }
export interface Google { nota: number; total: number; mapas: string; resenas: Resena[] }

type Crudo = {
  rating?: number; userRatingCount?: number; googleMapsUri?: string;
  reviews?: { rating?: number; relativePublishTimeDescription?: string; text?: { text?: string }; originalText?: { text?: string };
    authorAttribution?: { displayName?: string; uri?: string } }[];
};

export function normalizar(j: Crudo): Google | null {
  if (typeof j.rating !== 'number' || !j.userRatingCount || !j.googleMapsUri) return null;
  const resenas = (j.reviews ?? []).flatMap((r) => {
    const texto = (r.text?.text ?? r.originalText?.text ?? '').trim();
    if (!texto || typeof r.rating !== 'number') return [];
    return [{ autor: r.authorAttribution?.displayName ?? 'Huésped', uri: r.authorAttribution?.uri ?? null, estrellas: Math.round(r.rating), texto, cuando: r.relativePublishTimeDescription ?? '' }];
  });
  return { nota: j.rating, total: j.userRatingCount, mapas: j.googleMapsUri, resenas };
}

export async function cargarGoogle(): Promise<Google | null> {
  const key = import.meta.env.GOOGLE_PLACES_API_KEY;
  const id = import.meta.env.GOOGLE_PLACE_ID;
  if (!key || !id) return null;
  try {
    const base = import.meta.env.GOOGLE_PLACES_BASE ?? 'https://places.googleapis.com'; // base alterna solo para probar sin red
    const r = await fetch(`${base}/v1/places/${encodeURIComponent(id)}?languageCode=es`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'rating,userRatingCount,reviews,googleMapsUri' },
      signal: AbortSignal.timeout(10000),
    });
    return r.ok ? normalizar((await r.json()) as Crudo) : null;
  } catch {
    return null;
  }
}

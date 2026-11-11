import { describe, expect, it } from 'vitest';
import { normalizar } from './resenas';

describe('normalizar reseñas de Google', () => {
  it('descarta respuestas sin nota o enlace y reseñas sin texto', () => {
    expect(normalizar({})).toBeNull();
    const g = normalizar({
      rating: 4.6, userRatingCount: 10, googleMapsUri: 'https://maps.google.com/?cid=1',
      reviews: [{ rating: 5, text: { text: 'Muy lindo' }, authorAttribution: { displayName: 'Ana' } }, { rating: 4 }],
    });
    expect(g?.resenas).toHaveLength(1);
    expect(g?.resenas[0].autor).toBe('Ana');
  });
});

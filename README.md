# Hotel Andy

Web, reservas y panel de control del Hotel Andy (Atacames, Ecuador) · Soluciones Informáticas Mogolicous.

- Instrucciones para el agente: [`CLAUDE.md`](CLAUDE.md)
- Alcance (RF/RNF): [`docs/REQUERIMIENTOS.md`](docs/REQUERIMIENTOS.md)
- Producto: [`PRODUCT.md`](PRODUCT.md)
- Datos del hotel: [`data/hotel.json`](data/hotel.json) (los datos privados van en `data/hotel.private.json`, fuera del repo)

## Reseñas de Google en la web
1. En Google Cloud activa **Places API (New)** y crea una clave de API restringida a esa API (nunca con prefijo `PUBLIC_`).
2. Obtén el Place ID del hotel con el buscador de Place ID de Google Maps Platform ("Hotel Andy Atacames").
3. Ponlas en `.env` y en las variables de build de Cloudflare Pages: `GOOGLE_PLACES_API_KEY` y `GOOGLE_PLACE_ID`. Sin ellas la sección muestra solo la nota de Booking.

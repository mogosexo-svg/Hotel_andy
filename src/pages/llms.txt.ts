import type { APIRoute } from 'astro';
import { cargarCatalogo, dinero, hora } from '../components/web/catalogo';
import { preguntas } from '../components/web/faq';

export const GET: APIRoute = async ({ site }) => {
  const c = await cargarCatalogo();
  const h = c.hotel;
  const cuartos = c.tipos.reduce((n, t) => n + t.cuartos, 0);
  const l = [
    `# ${h.nombre}`,
    '',
    `> Hotel de playa en ${h.ciudad}, ${h.provincia}, Ecuador. ${cuartos} habitaciones, terraza con vista al mar y piscina techada. Calificación en Booking: ${h.booking.calificacion} de 10 con ${h.booking.resenas} reseñas.`,
    '',
    `Web: ${site}`,
    `Teléfono y WhatsApp: ${h.telefono}`,
    `Entrada ${hora(h.check_in)}, salida ${hora(h.check_out)}. Precio por habitación, no por persona. Se reserva directo en la web y se confirma por WhatsApp.`,
    `Incluido: ${[h.reglas.wifi && 'wifi', h.reglas.aire_acondicionado && 'aire acondicionado en todos los cuartos', h.reglas.mascotas?.cargo_adicional === 0 && 'mascotas sin cargo', h.reglas.parqueadero && 'parqueadero'].filter(Boolean).join(', ')}.`,
    '',
    '## Habitaciones',
    ...c.tipos.map(
      (t) => `- ${t.nombre}: hasta ${t.max_personas} personas${t.desde_centavos != null ? `, desde ${dinero(t.desde_centavos)} la noche` : ''}`,
    ),
    '',
    '## Preguntas frecuentes',
    ...preguntas(c).map((x) => `- ${x.q} ${x.a}`),
    '',
    '## Páginas',
    `- [Inicio y disponibilidad](${site})`,
    `- [Aviso de privacidad](${new URL('/privacidad', site)})`,
    '',
  ];
  return new Response(l.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};

// Preguntas frecuentes: cada respuesta sale de `reglas` del catálogo. Si una regla no existe, la pregunta no sale.
import type { Catalogo } from './catalogo';
import { hora } from './catalogo';

export function preguntas(c: Catalogo): { q: string; a: string }[] {
  const { reglas: r, check_in, check_out } = c.hotel;
  const f: ({ q: string; a: string } | false | undefined | null)[] = [
    { q: '¿A qué hora son la entrada y la salida?', a: `La entrada es desde las ${hora(check_in)} y la salida hasta las ${hora(check_out)}.` },
    r.ascensor === false && {
      q: '¿Hay ascensor?',
      a: 'No hay ascensor, se sube por escaleras. Si alguien tiene dificultad, escríbenos antes de reservar.',
    },
    r.anticipo && r.prereserva_horas ? {
      q: '¿Cómo se paga la reserva?',
      a: `La pre-reserva guarda el cuarto ${r.prereserva_horas} horas. Se confirma con un anticipo del ${r.anticipo.porcentaje} % por ${r.anticipo.medio}.`,
    } : false,
    { q: '¿Puedo cancelar o cambiar las fechas?', a: 'Se conversa caso a caso por WhatsApp.' },
  ];
  return f.filter((x): x is { q: string; a: string } => !!x);
}

// Preguntas frecuentes: cada respuesta sale de `reglas` del catálogo. Si una regla no existe, la pregunta no sale.
import type { Catalogo } from './catalogo';
import { hora } from './catalogo';

export function preguntas(c: Catalogo): { q: string; a: string }[] {
  const { reglas: r, check_in, check_out } = c.hotel;
  const f: ({ q: string; a: string } | false | undefined | null)[] = [
    { q: '¿A qué hora son la entrada y la salida?', a: `La entrada es desde las ${hora(check_in)} y la salida hasta las ${hora(check_out)}.` },
    r.mascotas?.aceptadas && {
      q: '¿Aceptan mascotas?',
      a: r.mascotas.cargo_adicional === 0 ? 'Sí, las mascotas son bienvenidas y no tienen cargo.' : 'Sí, se aceptan mascotas. Escríbenos por WhatsApp para saber el cargo.',
    },
    (r.wifi || r.aire_acondicionado || r.agua_caliente) && {
      q: '¿Qué incluyen los cuartos?',
      a: `${new Intl.ListFormat('es').format([r.wifi && 'wifi', r.aire_acondicionado && 'aire acondicionado', r.agua_caliente && 'agua caliente'].filter((x): x is string => !!x))} en todos los cuartos, sin costo extra. El precio es por habitación, no por persona.`.replace(/^./, (x) => x.toUpperCase()),
    },
    r.desayuno === false && { q: '¿Incluye desayuno?', a: 'No, el desayuno no está incluido.' },
    r.anticipo && r.prereserva_horas ? {
      q: '¿Cómo se paga la reserva?',
      a: `La pre-reserva guarda el cuarto ${r.prereserva_horas} horas. Se confirma con un anticipo del ${r.anticipo.porcentaje} % por ${r.anticipo.medio}.`,
    } : false,
    { q: '¿Puedo cancelar o cambiar las fechas?', a: 'Se conversa caso a caso por WhatsApp.' },
    r.ascensor === false && {
      q: '¿Hay ascensor?',
      a: 'No hay ascensor, se sube por escaleras. Si alguien tiene dificultad, escríbenos antes de reservar.',
    },
  ];
  return f.filter((x): x is { q: string; a: string } => !!x);
}

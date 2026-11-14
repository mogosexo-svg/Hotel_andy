// Puntos a favor del hotel: todo sale de `data/hotel.json` (reglas, horarios, Booking), nada se escribe a mano aquí.
import { hora, type Catalogo } from './catalogo';

export type Punto = [icono: string, titulo: string, texto: string];

export function puntos(c: Catalogo): Punto[] {
  const { reglas: r, booking: b, check_in, check_out } = c.hotel;
  const masc = r.mascotas;
  const f: (Punto | false | undefined | null)[] = [
    ['reloj', 'Entrada', `Desde las ${hora(check_in)}`],
    ['reloj', 'Salida', `Hasta las ${hora(check_out)}`],
    ['ola', 'Playa', 'A pasos de la playa'],
    r.piscina && ['ola', 'Piscina', `Abierta hasta la ${hora(r.piscina.cierra)}`],
    ['sol', 'Terraza', 'Con vista al mar'],
    r.wifi && ['wifi', 'Wifi', 'Incluido en todos los cuartos'],
    r.aire_acondicionado && ['aire', 'Aire acondicionado', 'En todos los cuartos'],
    r.agua_caliente && ['gota', 'Agua caliente', 'En todas las habitaciones'],
    r.parqueadero && ['auto', 'Parqueadero', 'Para tu auto'],
    masc?.aceptadas && ['perro', 'Mascotas', masc.cargo_adicional === 0 ? 'Bienvenidas, sin cargo' : masc.cargo_adicional == null ? 'Bienvenidas, consulta por WhatsApp' : 'Bienvenidas, con cargo adicional'],
    ['tarjeta', 'Precio', 'Por habitación, no por persona'],
    ['estrella', 'En Booking', `${String(b.calificacion).replace('.', ',')} de 10 con ${b.resenas} reseñas`],
    r.anticipo && ['tarjeta', 'Para confirmar', `Anticipo del ${r.anticipo.porcentaje} % por ${r.anticipo.medio}`],
  ];
  return f.filter((x): x is Punto => !!x);
}

/** Lista corta del visor de cuartos. */
export const resumenCuarto = (c: Catalogo): [string, string][] => {
  const { reglas: r } = c.hotel;
  const m = r.mascotas;
  return [
    ['reloj', `Entrada desde las ${hora(c.hotel.check_in)}, salida hasta las ${hora(c.hotel.check_out)}`],
    r.wifi && ['wifi', 'Wifi incluido'],
    r.aire_acondicionado && ['aire', 'Aire acondicionado en todos los cuartos'],
    r.agua_caliente && ['gota', 'Agua caliente en todas las habitaciones'],
    r.piscina && ['ola', `Piscina abierta hasta la ${hora(r.piscina.cierra)}`],
    r.parqueadero && ['auto', 'Parqueadero'],
    m?.aceptadas && m.cargo_adicional === 0 && ['perro', 'Mascotas bienvenidas, sin cargo'],
  ].filter((x): x is [string, string] => !!x);
};

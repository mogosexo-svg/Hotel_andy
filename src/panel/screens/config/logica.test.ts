import { describe, expect, it } from 'vitest';
import {
  CAMPOS_REGLAS,
  cambioCampo,
  centavosAInput,
  dolaresACentavos,
  enmascarar,
  escribirMultirango,
  horaLegible,
  leerCampo,
  leerCuenta,
  leerMultirango,
  mostrarCampo,
  nombreRango,
  nochesDe,
  parsearCampo,
  parsearCantidad,
  unir,
  validarCuenta,
  validarLugar,
  validarRango,
  validarUrl,
  type Hotel,
} from './logica';

const campo = (id: string) => CAMPOS_REGLAS.flatMap((g) => g.campos).find((c) => c.id === id)!;
const v = (r: ReturnType<typeof dolaresACentavos>) => (r.ok ? r.valor : r.error);

describe('dólares ↔ centavos', () => {
  it('acepta coma, punto y signo', () => {
    expect(v(dolaresACentavos('35'))).toBe(3500);
    expect(v(dolaresACentavos('35,5'))).toBe(3550);
    expect(v(dolaresACentavos('$ 35.05'))).toBe(3505);
    expect(v(dolaresACentavos('0,99'))).toBe(99);
  });
  it('rechaza vacío, negativos, texto, 3 decimales, cero y excesos', () => {
    for (const t of ['', '-5', 'abc', '35,555', '0', '1e3', '100000', '35,']) expect(dolaresACentavos(t).ok, t).toBe(false);
    expect(dolaresACentavos('0', { permitirCero: true }).ok).toBe(true);
  });
  it('ida y vuelta', () => {
    for (const c of [100, 3500, 3550, 5, 12345]) expect(v(dolaresACentavos(centavosAInput(c)))).toBe(c);
    expect(centavosAInput(3550)).toBe('35,50');
  });
});

describe('rangos de temporada ↔ datemultirange', () => {
  it('lee el formato de la base (fin excluido) y devuelve el último día', () => {
    expect(leerMultirango('{[2027-02-08,2027-02-13),[2027-12-24,2028-01-03)}')).toEqual([
      { desde: '2027-02-08', hasta: '2027-02-12' },
      { desde: '2027-12-24', hasta: '2028-01-02' },
    ]);
  });
  it('vacío o basura → sin rangos', () => {
    expect(leerMultirango('{}')).toEqual([]);
    expect(leerMultirango(null)).toEqual([]);
  });
  it('escribe con fin excluido, incluso cruzando mes y año', () => {
    expect(escribirMultirango([{ desde: '2027-02-28', hasta: '2027-03-02' }])).toBe('{[2027-02-28,2027-03-03)}');
    expect(escribirMultirango([{ desde: '2027-12-31', hasta: '2027-12-31' }])).toBe('{[2027-12-31,2028-01-01)}');
    expect(escribirMultirango([])).toBe('{}');
  });
  it('ida y vuelta y orden', () => {
    const r = [
      { desde: '2027-12-24', hasta: '2028-01-02' },
      { desde: '2027-02-08', hasta: '2027-02-12' },
    ];
    expect(leerMultirango(escribirMultirango(r))).toEqual([r[1], r[0]]);
  });
  it('une rangos que se cruzan o se tocan, como la base', () => {
    expect(
      unir([
        { desde: '2027-02-08', hasta: '2027-02-10' },
        { desde: '2027-02-11', hasta: '2027-02-12' },
      ]),
    ).toEqual([{ desde: '2027-02-08', hasta: '2027-02-12' }]);
    expect(
      unir([
        { desde: '2027-02-08', hasta: '2027-02-20' },
        { desde: '2027-02-10', hasta: '2027-02-12' },
      ]),
    ).toEqual([{ desde: '2027-02-08', hasta: '2027-02-20' }]);
  });
  it('valida fechas', () => {
    expect(validarRango('2027-02-08', '2027-02-12').ok).toBe(true);
    expect(validarRango('2027-02-12', '2027-02-08').ok).toBe(false);
    expect(validarRango('', '2027-02-08').ok).toBe(false);
    expect(validarRango('2027-02-30', '2027-03-02').ok).toBe(false);
    expect(validarRango('2027-01-01', '2027-12-31').ok).toBe(false);
  });
  it('nombres legibles', () => {
    expect(nombreRango({ desde: '2027-02-08', hasta: '2027-02-12' })).toBe('8 al 12 de febrero de 2027');
    expect(nombreRango({ desde: '2027-02-27', hasta: '2027-03-02' })).toBe('27 de febrero al 2 de marzo de 2027');
    expect(nombreRango({ desde: '2027-12-30', hasta: '2028-01-02' })).toBe('30 de diciembre de 2027 al 2 de enero de 2028');
    expect(nombreRango({ desde: '2027-02-08', hasta: '2027-02-08' })).toBe('8 de febrero de 2027');
    expect(nochesDe({ desde: '2027-02-08', hasta: '2027-02-12' })).toBe(5);
  });
});

describe('reglas del hotel', () => {
  const hotel: Hotel = {
    check_in: '13:30:00',
    check_out: '11:30:00',
    telefono: '+593 6276 0674',
    reglas: {
      anticipo: { medio: 'transferencia', porcentaje: 50 },
      mascotas: { aceptadas: true, cargo_adicional: null },
      prereserva_horas: 2,
    },
  };
  it('lee columnas y reglas; lo ausente es null, no 0', () => {
    expect(leerCampo(hotel, campo('check_in'))).toBe('13:30');
    expect(leerCampo(hotel, campo('anticipo'))).toBe(50);
    expect(leerCampo(hotel, campo('mascotas_cargo'))).toBeNull();
    expect(leerCampo(hotel, campo('parqueadero'))).toBeNull();
    expect(mostrarCampo(campo('mascotas_cargo'), null)).toBe('Sin definir');
    expect(mostrarCampo(campo('mascotas_cargo'), 0)).toBe('Sin cargo');
    expect(mostrarCampo(campo('mascotas_cargo'), 500)).toBe('$5');
    expect(mostrarCampo(campo('parqueadero'), false)).toBe('No');
  });
  it('cambiar una regla conserva las demás y no muta el original', () => {
    const antes = structuredClone(hotel);
    const c = cambioCampo(hotel, campo('anticipo'), 30);
    expect(c.reglas).toEqual({
      anticipo: { medio: 'transferencia', porcentaje: 30 },
      mascotas: { aceptadas: true, cargo_adicional: null },
      prereserva_horas: 2,
    });
    expect(hotel).toEqual(antes);
  });
  it('crea la ruta si no existía', () => {
    expect(cambioCampo(hotel, campo('piscina_abre'), '08:00').reglas).toMatchObject({ piscina: { abre: '08:00' }, prereserva_horas: 2 });
    expect(cambioCampo(hotel, campo('check_out'), '12:00')).toEqual({
      check_out: '12:00',
    });
  });
  it('valida cada tipo', () => {
    expect(parsearCampo(campo('anticipo'), '101').ok).toBe(false);
    expect(parsearCampo(campo('anticipo'), '50').ok).toBe(true);
    expect(parsearCampo(campo('prereserva'), '0').ok).toBe(false);
    expect(parsearCampo(campo('check_in'), '25:00').ok).toBe(false);
    expect(parsearCampo(campo('mascotas_cargo'), '5,50')).toEqual({
      ok: true,
      valor: 550,
    });
    expect(parsearCampo(campo('mascotas_cargo'), '-1').ok).toBe(false);
    expect(parsearCampo(campo('telefono'), '12').ok).toBe(false);
    expect(parsearCampo(campo('telefono'), '+593 6276 0674').ok).toBe(true);
    expect(parsearCampo(campo('telefono'), 'llámame').ok).toBe(false);
    expect(parsearCampo(campo('parqueadero'), 'si')).toEqual({
      ok: true,
      valor: true,
    });
  });
  it('horas en palabras', () => {
    expect(horaLegible('13:30')).toBe('1:30 de la tarde');
    expect(horaLegible('01:00')).toBe('1:00 de la madrugada');
    expect(horaLegible('00:00')).toBe('12:00 de la madrugada');
    expect(horaLegible('08:00')).toBe('8:00 de la mañana');
    expect(horaLegible('20:15')).toBe('8:15 de la noche');
  });
});

describe('kit, cuenta y NFC', () => {
  it('cantidad del kit', () => {
    expect(parsearCantidad('0,5')).toEqual({ ok: true, valor: 0.5 });
    expect(parsearCantidad('2')).toEqual({ ok: true, valor: 2 });
    for (const t of ['0', '', '-1', 'x', '1000']) expect(parsearCantidad(t).ok, t).toBe(false);
  });
  it('cuenta: valida, enmascara y no inventa', () => {
    expect(leerCuenta(null)).toBeNull();
    expect(leerCuenta({})).toBeNull();
    const c = {
      banco: 'Banco X',
      tipo: 'ahorros' as const,
      numero: '1234 5678 90',
      titular: 'Ana Pérez',
    };
    const r = validarCuenta(c);
    expect(r.ok && r.valor.numero).toBe('1234567890');
    expect(validarCuenta({ ...c, numero: '12ab' }).ok).toBe(false);
    expect(validarCuenta({ ...c, banco: '' }).ok).toBe(false);
    expect(enmascarar('1234567890')).toBe('•••• 7890');
  });
  it('lugar y enlace', () => {
    expect(validarLugar('Cuarto 201')).toEqual({
      ok: true,
      valor: 'cuarto-201',
    });
    expect(validarLugar('Habitación')).toEqual({
      ok: true,
      valor: 'habitacion',
    });
    expect(validarLugar('!').ok).toBe(false);
    expect(validarUrl('https://g.page/r/abc').ok).toBe(true);
    expect(validarUrl('http://g.page/r/abc').ok).toBe(false);
    expect(validarUrl('google').ok).toBe(false);
    expect(validarUrl('https://localhost').ok).toBe(false);
  });
});

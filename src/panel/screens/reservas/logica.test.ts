import { describe, expect, it } from 'vitest';
import { anticipoSugerido, barra, canalDe, cuentaAtras, diasEntre, diaCorto, enRangos, esFinde, libresPorNoche, montoACentavos, movimientos, rangoDias, sumarDias, tramo, validarReserva } from './logica';

describe('fechas', () => {
  it('suma y resta días cruzando mes y año', () => {
    expect(sumarDias('2026-11-28', 5)).toBe('2026-12-03');
    expect(sumarDias('2026-01-02', -3)).toBe('2025-12-30');
    expect(diasEntre('2026-02-27', '2026-03-02')).toBe(3);
  });
  it('rango de 14 días', () => {
    const r = rangoDias('2026-11-11', 14);
    expect(r).toHaveLength(14);
    expect(r[13]).toBe('2026-11-24');
  });
  it('día corto', () => expect(diaCorto('2026-02-14')).toEqual({ dia: 'sáb', num: '14', mes: 'feb' }));
});

describe('barras', () => {
  const d = '2026-11-10';
  it('dentro de la ventana: la salida no ocupa columna', () => {
    expect(barra('2026-11-12', '2026-11-15', d, 14)).toEqual({ col: 3, span: 3, recortaIzq: false, recortaDer: false });
  });
  it('salida y entrada el mismo día no se pisan', () => {
    const a = barra('2026-11-10', '2026-11-12', d, 14)!;
    const b = barra('2026-11-12', '2026-11-14', d, 14)!;
    expect(a.col + a.span).toBe(b.col);
  });
  it('recorta por la izquierda y la derecha', () => {
    expect(barra('2026-11-05', '2026-11-12', d, 14)).toEqual({ col: 1, span: 2, recortaIzq: true, recortaDer: false });
    expect(barra('2026-11-22', '2026-11-30', d, 14)).toEqual({ col: 13, span: 2, recortaIzq: false, recortaDer: true });
  });
  it('fuera de la ventana no se dibuja', () => {
    expect(barra('2026-11-01', '2026-11-10', d, 14)).toBeNull();
    expect(barra('2026-11-24', '2026-11-26', d, 14)).toBeNull();
  });
});

describe('tramo (medio día a cada lado)', () => {
  const d = '2026-11-10';
  it('entra a la tarde y sale a la mañana', () => {
    expect(tramo('2026-11-12', '2026-11-15', d, 14)).toEqual({ inicio: 6, fin: 12, recortaIzq: false, recortaDer: false });
  });
  it('salida y entrada el mismo día en el mismo cuarto: se tocan sin pisarse', () => {
    const a = tramo('2026-11-10', '2026-11-12', d, 14)!;
    const b = tramo('2026-11-12', '2026-11-14', d, 14)!;
    expect(a.fin).toBe(b.inicio);
  });
  it('empieza antes del rango', () => {
    expect(tramo('2026-11-05', '2026-11-12', d, 14)).toEqual({ inicio: 1, fin: 6, recortaIzq: true, recortaDer: false });
  });
  it('termina después del rango', () => {
    expect(tramo('2026-11-22', '2026-11-30', d, 14)).toEqual({ inicio: 26, fin: 29, recortaIzq: false, recortaDer: true });
  });
  it('sale la mañana del primer día: media columna', () => {
    expect(tramo('2026-11-08', '2026-11-10', d, 14)).toEqual({ inicio: 1, fin: 2, recortaIzq: true, recortaDer: false });
  });
  it('fuera del rango no se dibuja', () => {
    expect(tramo('2026-11-01', '2026-11-09', d, 14)).toBeNull();
    expect(tramo('2026-11-24', '2026-11-26', d, 14)).toBeNull();
  });
  it('una cancelada no ocupa', () => {
    expect(tramo('2026-11-12', '2026-11-15', d, 14, 'cancelada')).toBeNull();
  });
});

describe('libres por noche y movimientos', () => {
  const rs = [
    { habitacionId: 'a', entrada: '2026-11-10', salida: '2026-11-12', estado: 'en_curso' as const },
    { habitacionId: 'a', entrada: '2026-11-12', salida: '2026-11-13', estado: 'confirmada' as const },
    { habitacionId: 'b', entrada: '2026-11-10', salida: '2026-11-13', estado: 'cancelada' as const },
  ];
  it('el día de salida el cuarto queda libre hasta la tarde, y la cancelada no cuenta', () => {
    expect(libresPorNoche(rs, 2, ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'])).toEqual([1, 1, 1, 2]);
  });
  it('llegadas y salidas del día', () => {
    expect(movimientos(rs, '2026-11-12')).toEqual({ llegan: 1, salen: 1 });
  });
});

describe('calendario', () => {
  it('fin de semana y temporada', () => {
    expect(esFinde('2026-11-14')).toBe(true);
    expect(esFinde('2026-11-13')).toBe(false);
    expect(enRangos('2026-11-14', [{ desde: '2026-11-14', hasta: '2026-11-16' }])).toBe(true);
    expect(enRangos('2026-11-17', [{ desde: '2026-11-14', hasta: '2026-11-16' }])).toBe(false);
  });
});

describe('textos y dinero', () => {
  it('cuenta atrás', () => {
    const ahora = new Date('2026-11-11T12:00:00Z');
    expect(cuentaAtras('2026-11-11T13:20:00Z', ahora)).toBe('vence en 1 h 20 min');
    expect(cuentaAtras('2026-11-11T12:35:00Z', ahora)).toBe('vence en 35 min');
    expect(cuentaAtras('2026-11-11T11:59:00Z', ahora)).toBe('ya venció');
  });
  it('monto a centavos', () => {
    expect(montoACentavos('12,50')).toBe(1250);
    expect(montoACentavos('$40')).toBe(4000);
    expect(montoACentavos('0')).toBeNull();
    expect(montoACentavos('abc')).toBeNull();
    expect(montoACentavos('1,234')).toBeNull();
  });
  it('anticipo del 50 %', () => {
    expect(anticipoSugerido(9001, 50)).toBe(4501);
    expect(anticipoSugerido(null, 50)).toBeNull();
  });
  it('canal sale de la fuente', () => {
    expect(canalDe('booking')).toBe('booking');
    expect(canalDe('airbnb')).toBe('airbnb');
    expect(canalDe('whatsapp')).toBe('directo');
  });
});

describe('validarReserva', () => {
  const ok = { entrada: '2026-11-12', salida: '2026-11-14', habitacionId: 'x', personas: 2, maxPersonas: 3, hayHuesped: true };
  const hoy = '2026-11-11';
  it('válida', () => expect(validarReserva(ok, hoy)).toBeNull());
  it('salida antes de entrada', () => expect(validarReserva({ ...ok, salida: '2026-11-12' }, hoy)).toMatch(/después/));
  it('día pasado', () => expect(validarReserva({ ...ok, entrada: '2026-11-10' }, hoy)).toMatch(/pasó/));
  it('más personas que la capacidad', () => expect(validarReserva({ ...ok, personas: 4 }, hoy)).toMatch(/máximo 3/));
  it('sin cuarto ni huésped', () => {
    expect(validarReserva({ ...ok, habitacionId: null }, hoy)).toMatch(/cuarto/);
    expect(validarReserva({ ...ok, hayHuesped: false }, hoy)).toMatch(/huésped/);
  });
});

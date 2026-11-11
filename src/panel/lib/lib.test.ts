import { describe, expect, it } from 'vitest';
import { accionesPara } from './estados';
import { dinero, fechaCorta, hace, hoyEC, numero, unidadPlural } from './format';
import { nivelStock } from './stock';
import { mensajeError } from './errores';

const sin = { reservaEnCurso: false, llegaHoy: false };

describe('accionesPara', () => {
  it('ocupado: recepción y dueña hacen check-out, limpieza no', () => {
    const ctx = { reservaEnCurso: true, llegaHoy: false };
    expect(accionesPara('ocupado', 'recepcion', ctx)).toEqual(['check_out', 'danio']);
    expect(accionesPara('ocupado', 'duena', ctx)).toContain('check_out');
    expect(accionesPara('ocupado', 'limpieza', ctx)).toEqual(['danio']);
  });
  it('ocupado sin reserva en curso no ofrece check-out', () => {
    expect(accionesPara('ocupado', 'duena', sin)).not.toContain('check_out');
  });
  it('por limpiar → empezar; limpiando → listo; todos los roles', () => {
    for (const rol of ['duena', 'recepcion', 'limpieza'] as const) {
      expect(accionesPara('por_limpiar', rol, sin)).toContain('empezar');
      expect(accionesPara('limpiando', rol, sin)).toContain('listo');
    }
  });
  it('en arreglo: solo la dueña libera y nadie reporta otro daño', () => {
    expect(accionesPara('mantenimiento', 'duena', sin)).toEqual(['liberar']);
    expect(accionesPara('mantenimiento', 'recepcion', sin)).toEqual([]);
  });
  it('libre: check-in solo si llega hoy y solo gestión', () => {
    expect(accionesPara('libre', 'recepcion', { reservaEnCurso: false, llegaHoy: true })).toContain('check_in');
    expect(accionesPara('libre', 'limpieza', { reservaEnCurso: false, llegaHoy: true })).not.toContain('check_in');
    expect(accionesPara('libre', 'recepcion', sin)).toEqual(['danio']);
  });
});

describe('formato', () => {
  it('dinero desde centavos', () => {
    expect(dinero(0)).toBe('$0');
    expect(dinero(12500)).toBe('$125');
    expect(dinero(125050)).toBe('$1.250,50');
    expect(dinero(5)).toBe('$0,05');
    expect(dinero(null)).toBe('—');
  });
  it('números con coma', () => expect(numero(0.5)).toBe('0,5'));
  it('fecha corta es-EC', () => {
    expect(fechaCorta('2026-02-14')).toBe('sáb 14 feb');
  });
  it('hoy en Guayaquil (UTC-5)', () => {
    expect(hoyEC(new Date('2026-11-11T03:00:00Z'))).toBe('2026-11-10');
    expect(hoyEC(new Date('2026-11-11T06:00:00Z'))).toBe('2026-11-11');
  });
  it('hace', () => {
    const ahora = new Date('2026-11-11T12:00:00Z');
    expect(hace('2026-11-11T11:35:00Z', ahora)).toBe('hace 25 min');
    expect(hace('2026-11-11T09:00:00Z', ahora)).toBe('hace 3 h');
  });
  it('plural de unidades', () => {
    expect(unidadPlural('rollo', 10)).toBe('rollos');
    expect(unidadPlural('kg', 4)).toBe('kg');
    expect(unidadPlural('unidad', 3)).toBe('unidades');
    expect(unidadPlural('juego', 1)).toBe('juego');
  });
});

describe('nivelStock', () => {
  it('null es "Sin contar", no cero', () => {
    expect(nivelStock(null, 10, 'rollo')).toMatchObject({ nivel: 'sin_contar', frase: 'Sin contar' });
  });
  it('en el mínimo ya es bajo', () => {
    expect(nivelStock(4, 4, 'kg').nivel).toBe('bajo');
    expect(nivelStock(5, 4, 'kg').nivel).toBe('justo');
    expect(nivelStock(100, 4, 'kg').nivel).toBe('ok');
  });
  it('cero y negativo son agotado', () => {
    expect(nivelStock(0, 4, 'kg').nivel).toBe('agotado');
    expect(nivelStock(-2, 4, 'kg').nivel).toBe('agotado');
  });
  it('sin mínimo no alerta', () => expect(nivelStock(3, null, 'lata').nivel).toBe('sin_minimo'));
  it('frase con cantidad y unidad', () => expect(nivelStock(10, 12, 'rollo').frase).toBe('Quedan 10 rollos'));
});

describe('mensajeError', () => {
  it('muestra tal cual los mensajes de negocio', () => {
    expect(mensajeError({ code: 'P0001', message: 'El cuarto debe estar libre.' })).toBe('El cuarto debe estar libre.');
  });
  it('traduce el resto', () => {
    expect(mensajeError({ code: '42501', message: 'x' })).toMatch(/permiso/);
    expect(mensajeError({ message: 'TypeError: Failed to fetch' })).toMatch(/conexión/);
  });
});

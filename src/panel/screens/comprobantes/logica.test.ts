import { describe, expect, it } from 'vitest';
import { coincide, montoEditable, montoSugerido, type Candidata } from './logica';

describe('montoSugerido', () => {
  it('anticipo menos lo pagado', () => expect(montoSugerido(6000, 1500)).toBe(4500));
  it('nunca baja de cero', () => expect(montoSugerido(6000, 9000)).toBe(0));
});

const c: Candidata = { id: '1', codigo: 'HA-0042', huesped: 'María Peña', telefono: '+593987654321', cuarto: '12' };
describe('coincide', () => {
  it('vacío deja pasar todo', () => expect(coincide(c, '  ')).toBe(true));
  it('nombre sin tildes', () => expect(coincide(c, 'maria pena')).toBe(true));
  it('código y cuarto', () => {
    expect(coincide(c, 'ha-0042')).toBe(true);
    expect(coincide(c, '12')).toBe(true);
  });
  it('teléfono local contra E.164', () => {
    expect(coincide(c, '0987654321')).toBe(true);
    expect(coincide(c, '0991111111')).toBe(false);
  });
  it('sin teléfono no revienta', () => expect(coincide({ ...c, telefono: null }, '098765')).toBe(false));
});

describe('montoEditable', () => {
  it('coma o punto', () => {
    expect(montoEditable('45,50')).toBe(4550);
    expect(montoEditable('$45.5')).toBe(4550);
  });
  it('acepta cero', () => expect(montoEditable('0')).toBe(0));
  it('rechaza lo que no es monto', () => {
    expect(montoEditable('')).toBeNull();
    expect(montoEditable('-5')).toBeNull();
    expect(montoEditable('12,345')).toBeNull();
  });
});

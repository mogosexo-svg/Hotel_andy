import { describe, expect, it } from 'vitest';
import { cantidadATexto, centavosATexto, coincide, margenPct, parseCantidad, parseDinero, subtotalLinea, totalFactura, validarFactura } from './logica';

describe('parseCantidad', () => {
  it('acepta coma y punto decimal', () => {
    expect(parseCantidad('0,5')).toBe(0.5);
    expect(parseCantidad('0.5')).toBe(0.5);
    expect(parseCantidad(' 12 ')).toBe(12);
    expect(parseCantidad('2,25')).toBe(2.25);
  });
  it('rechaza lo que no es número', () => {
    for (const x of ['', 'abc', '-1', '1,2,3', '1,5kg', ',5']) expect(parseCantidad(x)).toBeNull();
  });
});

describe('parseDinero', () => {
  it('convierte a centavos sin errores de coma flotante', () => {
    expect(parseDinero('1,50')).toBe(150);
    expect(parseDinero('2')).toBe(200);
    expect(parseDinero('$0,05')).toBe(5);
    expect(parseDinero('1.15')).toBe(115);
    expect(parseDinero('19,99')).toBe(1999);
  });
  it('rechaza tres decimales y basura', () => {
    expect(parseDinero('1.250')).toBeNull();
    expect(parseDinero('')).toBeNull();
    expect(parseDinero('uno')).toBeNull();
  });
  it('ida y vuelta', () => {
    expect(centavosATexto(150)).toBe('1,50');
    expect(centavosATexto(200)).toBe('2');
    expect(centavosATexto(null)).toBe('');
    expect(cantidadATexto(0.5)).toBe('0,5');
  });
});

describe('factura', () => {
  const l = (productoId: string | null, cantidad: string, costo: string) => ({ productoId, cantidad, costo });
  it('subtotal y total en vivo, ignorando líneas incompletas', () => {
    expect(subtotalLinea(l('a', '10', '1,15'))).toBe(1150);
    expect(subtotalLinea(l('a', '0,5', '3,00'))).toBe(150);
    expect(subtotalLinea(l('a', '', '3'))).toBe(0);
    expect(totalFactura([l('a', '10', '1,15'), l('b', '3', '2'), l('c', 'x', '2')])).toBe(1750);
  });
  const base = { proveedor: 'Distribuidora', numero: 'F-1', fecha: '2026-11-11' };
  it('línea válida sale lista para la base', () => {
    expect(validarFactura({ ...base, lineas: [l('a', '2,5', '1,2')] })).toEqual({
      lineas: [{ producto_id: 'a', cantidad: 2.5, costo_unit_centavos: 120 }],
    });
  });
  it('avisa el primer problema', () => {
    expect(validarFactura({ ...base, proveedor: ' ', lineas: [l('a', '1', '1')] })).toHaveProperty('error');
    expect(validarFactura({ ...base, lineas: [l(null, '', '')] })).toEqual({ error: 'Añade al menos un producto.' });
    expect(validarFactura({ ...base, lineas: [l(null, '1', '1')] })).toEqual({ error: 'Elige el producto de la línea 1.' });
    expect(validarFactura({ ...base, lineas: [l('a', '0', '1')] })).toEqual({ error: 'Revisa la cantidad de la línea 1.' });
    expect(validarFactura({ ...base, lineas: [l('a', '1', 'x')] })).toHaveProperty('error');
    expect(validarFactura({ ...base, lineas: [l('a', '1', '1'), l('a', '2', '1')] })).toHaveProperty('error');
  });
  it('una línea vacía al final no estorba', () => {
    expect(validarFactura({ ...base, lineas: [l('a', '1', '1'), l(null, '', '')] })).toHaveProperty('lineas');
  });
});

describe('búsqueda y margen', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(coincide('Papel Higiénico', 'higienico')).toBe(true);
    expect(coincide('Cerveza', '')).toBe(true);
    expect(coincide('Cerveza', 'agua')).toBe(false);
  });
  it('margen en %', () => {
    expect(margenPct(250, 100)).toBe(40);
    expect(margenPct(0, 0)).toBeNull();
  });
});

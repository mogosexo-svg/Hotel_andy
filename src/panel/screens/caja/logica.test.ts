import { describe, expect, it } from 'vitest';
import { armarSalidas, desdeTexto, enlaceWhatsApp, estadoDiferencia, quienCerro, totalVentas, tituloTurno, trozosMensaje } from './logica';

describe('estadoDiferencia', () => {
  it('cero cuadra', () => expect(estadoDiferencia(0)).toMatchObject({ estado: 'cuadra', texto: 'Cuadra' }));
  it('negativo: faltan', () => expect(estadoDiferencia(-200)).toMatchObject({ estado: 'faltan', texto: 'Faltan $2' }));
  it('positivo: sobran', () => expect(estadoDiferencia(150)).toMatchObject({ estado: 'sobran', texto: 'Sobran $1,50' }));
});

describe('enlaceWhatsApp', () => {
  it('codifica el mensaje y no fija número', () => {
    expect(enlaceWhatsApp('*Cierre* $5,50\nok')).toBe(`https://wa.me/?text=${encodeURIComponent('*Cierre* $5,50\nok')}`);
  });
});

describe('textos', () => {
  it('título del turno', () => expect(tituloTurno('tarde', '15:00')).toBe('Cierre de la tarde · 15:00'));
  it('desde hoy a medianoche de Guayaquil', () => {
    const ahora = new Date('2026-11-23T20:00:00Z');
    expect(desdeTexto('2026-11-23T05:00:00Z', ahora)).toBe('desde las 00:00 de hoy');
    expect(desdeTexto('2026-11-23T03:05:00Z', ahora)).toBe('desde las 22:05 de ayer');
  });
  it('negrita de WhatsApp', () => expect(trozosMensaje('a *b* c')).toEqual([{ t: 'a ', b: false }, { t: 'b', b: true }, { t: ' c', b: false }]));
  it('quién cerró', () => {
    expect(quienCerro('Caja: ok\nCerró: Ana Mero\nNota: x')).toBe('Ana Mero');
    expect(quienCerro('sin dato')).toBeNull();
  });
});

describe('salidas del turno', () => {
  const prods = [
    { id: 'agua', seVende: true, venta: 100 },
    { id: 'cerveza', seVende: true, venta: 250 },
    { id: 'jabon', seVende: false, venta: null },
    { id: 'sinprecio', seVende: true, venta: null },
  ];
  const cant = { agua: 3, cerveza: 0, jabon: 2, sinprecio: 1, fantasma: 5 };
  it('arma solo cantidad > 0; ventas con medio, usos sin medio', () => {
    expect(armarSalidas(cant, prods, 'transferencia')).toEqual([
      { producto_id: 'agua', cantidad: 3, medio: 'transferencia' },
      { producto_id: 'jabon', cantidad: 2 },
      { producto_id: 'sinprecio', cantidad: 1 },
    ]);
  });
  it('sin cantidades no arma nada', () => expect(armarSalidas({}, prods, 'efectivo')).toEqual([]));
  it('total en vivo solo cuenta lo que se vende', () => {
    expect(totalVentas(cant, prods)).toBe(300);
    expect(totalVentas({ cerveza: 1.5 }, prods)).toBe(375);
    expect(totalVentas({}, prods)).toBe(0);
  });
});

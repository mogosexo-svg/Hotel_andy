import { describe, expect, it } from 'vitest';
import { desdeTexto, enlaceWhatsApp, estadoDiferencia, quienCerro, tituloTurno, trozosMensaje } from './logica';

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

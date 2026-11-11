import { useEffect, useState } from 'react';
import { Icon, type IconoNombre } from '../../ui/Icon';
import { ESTADO_RESERVA, type EstadoReserva } from './logica';

export const ICONO_RESERVA: Record<EstadoReserva, IconoNombre> = {
  prereserva: 'reloj',
  confirmada: 'check',
  en_curso: 'ocupado',
  finalizada: 'sale',
  cancelada: 'cerrar',
};

/** Estado de la reserva: color + ícono + palabra, igual que los cuartos. */
export function ChipReserva({ estado }: { estado: EstadoReserva }) {
  return (
    <span className={`chip rv-e-${estado}`}>
      <Icon name={ICONO_RESERVA[estado]} />
      {ESTADO_RESERVA[estado]}
    </span>
  );
}

/** Contador de personas con botones grandes. */
export function Pasos({
  valor,
  min = 1,
  max,
  onCambio,
  etiqueta,
}: {
  valor: number;
  min?: number;
  max: number;
  onCambio: (n: number) => void;
  etiqueta: string;
}) {
  return (
    <div className="rv-pasos" role="group" aria-label={etiqueta}>
      <button type="button" className="rv-pasos__btn" aria-label="Una persona menos" disabled={valor <= min} onClick={() => onCambio(valor - 1)}>
        <svg viewBox="0 0 24 24" className="ico" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
      <output className="rv-pasos__n" aria-live="polite">
        {valor}
      </output>
      <button type="button" className="rv-pasos__btn" aria-label="Una persona más" disabled={valor >= max} onClick={() => onCambio(valor + 1)}>
        <Icon name="mas" />
      </button>
    </div>
  );
}

/** Reloj que avanza cada `ms` (cuenta atrás de las pre-reservas). */
export function useAhora(ms = 30_000): Date {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setT(new Date()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return t;
}

export type Ancho = 'movil' | 'media' | 'ancha';
/** movil < 700 px (lista por día) · media < 1024 (7 días) · ancha (14 días). */
export function useAncho(): Ancho {
  const calc = (): Ancho => (window.innerWidth < 700 ? 'movil' : window.innerWidth < 1024 ? 'media' : 'ancha');
  const [a, setA] = useState<Ancho>(calc);
  useEffect(() => {
    const on = () => setA(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return a;
}

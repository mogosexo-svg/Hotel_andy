import type { Database } from '../../lib/database.types';

export type Estado = Database['public']['Enums']['estado_habitacion'];
export type Rol = Database['public']['Enums']['rol_usuario'];

/** Palabras de la dueña. Color, ícono y palabra siempre juntos. */
export const ESTADOS: Record<Estado, { palabra: string; orden: number }> = {
  libre: { palabra: 'Libre', orden: 0 },
  ocupado: { palabra: 'Ocupado', orden: 1 },
  por_limpiar: { palabra: 'Por limpiar', orden: 2 },
  limpiando: { palabra: 'Limpiando', orden: 3 },
  mantenimiento: { palabra: 'En arreglo', orden: 4 },
};

export type AccionId = 'check_in' | 'check_out' | 'empezar' | 'listo' | 'danio' | 'liberar';

export interface ContextoCuarto {
  /** Hay un huésped con check-in hecho en este cuarto. */
  reservaEnCurso: boolean;
  /** Hay una reserva confirmada que llega hoy a este cuarto. */
  llegaHoy: boolean;
}

/** Acciones válidas según estado y rol. La base de datos las vuelve a validar. */
export function accionesPara(estado: Estado, rol: Rol, ctx: ContextoCuarto): AccionId[] {
  const gestiona = rol === 'duena' || rol === 'recepcion';
  const out: AccionId[] = [];
  switch (estado) {
    case 'libre':
      if (gestiona && ctx.llegaHoy) out.push('check_in');
      break;
    case 'ocupado':
      if (gestiona && ctx.reservaEnCurso) out.push('check_out');
      break;
    case 'por_limpiar':
      out.push('empezar');
      break;
    case 'limpiando':
      out.push('listo');
      break;
    case 'mantenimiento':
      if (rol === 'duena') out.push('liberar');
      break;
  }
  if (estado !== 'mantenimiento') out.push('danio');
  return out;
}

export const ROL_PALABRA: Record<Rol, string> = { duena: 'Dueña', recepcion: 'Recepción', limpieza: 'Limpieza' };

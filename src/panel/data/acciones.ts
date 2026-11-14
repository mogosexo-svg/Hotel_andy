import { useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useCuartos } from './cuartos';
import { usePerfil } from './sesion';
import { useToast } from '../ui/Toast';
import { mensajeError } from '../lib/errores';

export interface CuentaReserva {
  total_centavos: number | null;
  pagado_centavos: number;
  consumos_pendientes: { id: string; producto: string; cantidad: number; total_centavos: number }[];
  consumos_pendientes_centavos: number;
  saldo_centavos: number;
}

interface CuartoRef {
  id: string;
  numero: string;
}

/** Acciones sobre cuartos: optimistas cuando la base lo permite, con el error de la base tal cual. */
export function useAcciones() {
  const { hotelId } = usePerfil();
  const { cambiarLocal, refrescar } = useCuartos();
  const toast = useToast();

  return useMemo(() => {
    const fallo = (e: { message: string; code?: string }) => toast.error(mensajeError(e));

    async function empezar(c: CuartoRef): Promise<boolean> {
      const revertir = cambiarLocal(c.id, 'limpiando');
      const { error } = await supabase.rpc('empezar_limpieza', { p_habitacion: c.id });
      if (error) {
        revertir();
        fallo(error);
        return false;
      }
      toast.avisar(`Empezaste el cuarto ${c.numero}`, {
        deshacer: async () => {
          const rev = cambiarLocal(c.id, 'por_limpiar');
          const { error: e } = await supabase.rpc('deshacer_limpieza', { p_habitacion: c.id });
          if (e) {
            rev();
            fallo(e);
          }
        },
      });
      return true;
    }

    async function listo(c: CuartoRef): Promise<boolean> {
      const revertir = cambiarLocal(c.id, 'libre');
      const { error } = await supabase.rpc('marcar_listo', { p_habitacion: c.id });
      if (error) {
        revertir();
        fallo(error);
        return false;
      }
      toast.avisar(`Cuarto ${c.numero} listo y libre`);
      return true;
    }

    async function liberar(c: CuartoRef): Promise<boolean> {
      const revertir = cambiarLocal(c.id, 'libre');
      const { error } = await supabase.rpc('liberar_mantenimiento', { p_habitacion: c.id });
      if (error) {
        revertir();
        fallo(error);
        return false;
      }
      toast.avisar(`Cuarto ${c.numero} ya no está en arreglo`);
      return true;
    }

    async function danio(c: CuartoRef, nota: string, foto: File | null): Promise<boolean> {
      let fotoPath: string | undefined;
      let fotoFallo = false;
      if (foto) {
        const ext = foto.type === 'image/png' ? 'png' : 'jpg';
        const ruta = `${hotelId}/danos/${crypto.randomUUID()}.${ext}`;
        const { error: up } = await supabase.storage.from('hotel').upload(ruta, foto, { contentType: foto.type });
        if (up) fotoFallo = true;
        else fotoPath = ruta;
      }
      const revertir = cambiarLocal(c.id, 'mantenimiento');
      const { error } = await supabase.rpc('reportar_dano', {
        p_habitacion: c.id,
        p_nota: nota,
        p_foto_path: fotoPath,
      });
      if (error) {
        revertir();
        fallo(error);
        return false;
      }
      toast.avisar(
        fotoFallo
          ? `Cuarto ${c.numero} en arreglo. La foto no se pudo subir: quedó solo la nota.`
          : `Cuarto ${c.numero} quedó en arreglo`,
      );
      return true;
    }

    async function checkIn(c: CuartoRef, reservaId: string): Promise<boolean> {
      const revertir = cambiarLocal(c.id, 'ocupado');
      const { error } = await supabase.rpc('check_in', { p_reserva: reservaId });
      if (error) {
        revertir();
        fallo(error);
        return false;
      }
      void refrescar();
      toast.avisar(`Check-in hecho en el cuarto ${c.numero}`);
      return true;
    }

    async function cuenta(reservaId: string): Promise<CuentaReserva | null> {
      const { data, error } = await supabase.rpc('cuenta_reserva', { p_reserva: reservaId });
      if (error) {
        fallo(error);
        return null;
      }
      return data as unknown as CuentaReserva;
    }

    async function checkOut(c: CuartoRef, reservaId: string, medio: 'efectivo' | 'transferencia' | null): Promise<boolean> {
      const revertir = cambiarLocal(c.id, 'por_limpiar');
      const { error } = await supabase.rpc('check_out', { p_reserva: reservaId, p_medio_consumos: medio ?? undefined });
      if (error) {
        revertir();
        fallo(error);
        return false;
      }
      void refrescar();
      toast.avisar(`Salió el huésped del ${c.numero}. Ya avisamos a limpieza.`);
      return true;
    }

    return { empezar, listo, liberar, danio, checkIn, checkOut, cuenta };
  }, [hotelId, cambiarLocal, refrescar, toast]);
}

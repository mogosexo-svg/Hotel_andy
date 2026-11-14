import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Rol } from '../lib/estados';

export interface Perfil {
  userId: string;
  hotelId: string;
  rol: Rol;
  nombre: string;
  hotel: { nombre: string; checkOut: string | null };
}

type Fase = 'cargando' | 'fuera' | 'sin_hotel' | 'error' | 'listo';

interface SesionCtx {
  fase: Fase;
  perfil: Perfil | null;
  salir: () => Promise<void>;
  reintentar: () => void;
}

const Ctx = createContext<SesionCtx | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [fase, setFase] = useState<Fase>('cargando');
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [intento, setIntento] = useState(0);

  const cargarPerfil = useCallback(async (s: Session) => {
    const { data: u, error } = await supabase
      .from('usuarios_hotel')
      .select('hotel_id, rol, nombre')
      .eq('user_id', s.user.id)
      .eq('activo', true)
      .maybeSingle();
    if (error) return setFase('error');
    if (!u) return setFase('sin_hotel');
    const { data: h } = await supabase.from('hoteles').select('nombre, check_out').eq('id', u.hotel_id).maybeSingle();
    setPerfil({
      userId: s.user.id,
      hotelId: u.hotel_id,
      rol: u.rol,
      nombre: u.nombre,
      hotel: { nombre: h?.nombre ?? 'Hotel', checkOut: h?.check_out ?? null },
    });
    setFase('listo');
  }, []);

  useEffect(() => {
    let vivo = true;
    const aplicar = (s: Session | null) => {
      if (!vivo) return;
      if (!s) {
        setPerfil(null);
        return setFase('fuera');
      }
      // Fuera del callback de auth: supabase-js no admite otras llamadas dentro de él.
      window.setTimeout(() => void cargarPerfil(s).catch(() => vivo && setFase('error')), 0);
    };
    void supabase.auth
      .getSession()
      .then(({ data }) => aplicar(data.session))
      .catch(() => vivo && setFase('error'));
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') aplicar(s);
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [cargarPerfil, intento]);

  const valor = useMemo<SesionCtx>(
    () => ({
      fase,
      perfil,
      salir: async () => {
        await supabase.auth.signOut();
      },
      reintentar: () => {
        setFase('cargando');
        setIntento((n) => n + 1);
      },
    }),
    [fase, perfil],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSesion(): SesionCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSesion fuera de SesionProvider');
  return c;
}

export function usePerfil(): Perfil {
  const { perfil } = useSesion();
  if (!perfil) throw new Error('Sin perfil');
  return perfil;
}

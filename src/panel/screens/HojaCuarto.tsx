import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAcciones, type CuentaReserva } from '../data/acciones';
import { useCuartos, type Cuarto } from '../data/cuartos';
import { usePerfil } from '../data/sesion';
import { accionesPara, type AccionId } from '../lib/estados';
import { dinero, fechaCorta, hace, hoyEC } from '../lib/format';
import { Boton, ChipEstado, Hoja, Skeleton } from '../ui/kit';
import { Icon } from '../ui/Icon';

type Vista = 'menu' | 'salida' | 'danio';

/** Hoja con las acciones válidas del cuarto para el estado y el rol. */
export function HojaCuarto({ cuarto, onCerrar }: { cuarto: Cuarto; onCerrar: () => void }) {
  const { rol, hotel } = usePerfil();
  const { enCurso, llegaHoy } = useCuartos();
  const acc = useAcciones();
  const [vista, setVista] = useState<Vista>('menu');
  const [ocupado, setOcupado] = useState<AccionId | null>(null);

  const reserva = enCurso.get(cuarto.id);
  const llegada = llegaHoy.get(cuarto.id);
  const acciones = accionesPara(cuarto.estado, rol, { reservaEnCurso: !!reserva, llegaHoy: !!llegada });
  const ref = { id: cuarto.id, numero: cuarto.numero };

  async function correr(id: AccionId, fn: () => Promise<boolean>) {
    setOcupado(id);
    const ok = await fn();
    setOcupado(null);
    if (ok) onCerrar();
  }

  const titulo = vista === 'menu' ? `Cuarto ${cuarto.numero}` : vista === 'salida' ? `Salida del ${cuarto.numero}` : `Daño en el ${cuarto.numero}`;

  return (
    <Hoja titulo={titulo} onCerrar={onCerrar}>
      {vista === 'menu' && (
        <>
          <div className="hoja__meta">
            <ChipEstado estado={cuarto.estado} />
            <span>
              {cuarto.tipo} · Piso {cuarto.piso}
            </span>
            <span className="hoja__desde">{hace(cuarto.estadoDesde)}</span>
          </div>

          {reserva && cuarto.estado === 'ocupado' && (
            <dl className="datos">
              <div>
                <dt>Huésped</dt>
                <dd>{reserva.huesped ?? 'Sin nombre'}</dd>
              </div>
              <div>
                <dt>Personas</dt>
                <dd>{reserva.personas}</dd>
              </div>
              <div>
                <dt>Sale</dt>
                <dd>{salidaTexto(reserva.salida, hotel.checkOut)}</dd>
              </div>
            </dl>
          )}
          {llegada && cuarto.estado === 'libre' && (
            <dl className="datos">
              <div>
                <dt>Llega hoy</dt>
                <dd>{llegada.huesped ?? 'Sin nombre'}</dd>
              </div>
              <div>
                <dt>Personas</dt>
                <dd>{llegada.personas}</dd>
              </div>
            </dl>
          )}
          {cuarto.estado === 'mantenimiento' && <NotaDanio habitacionId={cuarto.id} />}

          <div className="hoja__acciones">
            {acciones.includes('check_in') && llegada && (
              <Boton huge icono="ocupado" cargando={ocupado === 'check_in'} onClick={() => void correr('check_in', () => acc.checkIn(ref, llegada.id))}>
                Hacer check-in
              </Boton>
            )}
            {acciones.includes('check_out') && (
              <Boton huge icono="sale" onClick={() => setVista('salida')}>
                Hacer check-out
              </Boton>
            )}
            {acciones.includes('empezar') && (
              <Boton huge icono="limpiando" cargando={ocupado === 'empezar'} onClick={() => void correr('empezar', () => acc.empezar(ref))}>
                Empezar a limpiar
              </Boton>
            )}
            {acciones.includes('listo') && (
              <Boton huge icono="libre" cargando={ocupado === 'listo'} onClick={() => void correr('listo', () => acc.listo(ref))}>
                Listo
              </Boton>
            )}
            {acciones.includes('liberar') && (
              <Boton huge icono="libre" cargando={ocupado === 'liberar'} onClick={() => void correr('liberar', () => acc.liberar(ref))}>
                Ya está arreglado
              </Boton>
            )}
            {acciones.includes('danio') && (
              <Boton variante="quiet" icono="mantenimiento" onClick={() => setVista('danio')}>
                Reportar daño
              </Boton>
            )}
            {acciones.length === 0 && (
              <p className="hoja__nada">
                {cuarto.estado === 'mantenimiento'
                  ? 'Solo la dueña puede marcar este cuarto como arreglado.'
                  : 'No hay nada que hacer en este cuarto ahora.'}
              </p>
            )}
          </div>
        </>
      )}

      {vista === 'salida' && reserva && (
        <FormSalida
          numero={cuarto.numero}
          reservaId={reserva.id}
          onAtras={() => setVista('menu')}
          onHecho={(medio) => acc.checkOut(ref, reserva.id, medio).then((ok) => ok && onCerrar())}
        />
      )}

      {vista === 'danio' && <FormDanio cuarto={ref} onAtras={() => setVista('menu')} onHecho={onCerrar} />}
    </Hoja>
  );
}

function salidaTexto(salida: string, checkOut: string | null): string {
  const hora = checkOut ? checkOut.slice(0, 5) : '';
  return salida === hoyEC() ? `hoy ${hora}`.trim() : `${fechaCorta(salida)} ${hora}`.trim();
}

function NotaDanio({ habitacionId }: { habitacionId: string }) {
  const [nota, setNota] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    void supabase
      .from('reportes_mantenimiento')
      .select('nota')
      .eq('habitacion_id', habitacionId)
      .is('resuelto_en', null)
      .order('creado_en', { ascending: false })
      .limit(1)
      .then(({ data }) => vivo && setNota(data?.[0]?.nota ?? null));
    return () => {
      vivo = false;
    };
  }, [habitacionId]);
  if (nota === undefined) return <Skeleton h="3.5rem" />;
  if (!nota) return null;
  return (
    <blockquote className="nota-danio">
      <span>Qué pasó</span>
      {nota}
    </blockquote>
  );
}

export function FormSalida({
  numero,
  reservaId,
  onAtras,
  onHecho,
}: {
  numero: string;
  reservaId: string;
  onAtras: () => void;
  onHecho: (medio: 'efectivo' | 'transferencia' | null) => Promise<unknown>;
}) {
  const acc = useAcciones();
  const [cuenta, setCuenta] = useState<CuentaReserva | null | undefined>(undefined);
  const [medio, setMedio] = useState<'efectivo' | 'transferencia' | 'despues'>('efectivo');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void acc.cuenta(reservaId).then((c) => vivo && setCuenta(c));
    return () => {
      vivo = false;
    };
  }, [acc, reservaId]);

  if (cuenta === undefined)
    return (
      <div className="pila">
        <Skeleton h="1.5rem" w="60%" />
        <Skeleton h="6rem" />
        <Skeleton h="4.5rem" r="20px" />
      </div>
    );
  if (cuenta === null)
    return (
      <div className="pila">
        <p>No pudimos traer la cuenta del cuarto {numero}.</p>
        <Boton variante="quiet" onClick={onAtras}>
          Volver
        </Boton>
      </div>
    );

  const hayConsumos = cuenta.consumos_pendientes.length > 0;
  return (
    <div className="pila">
      <p className="hoja__aviso">Revisa la cuenta antes de dejar salir al huésped. Esto no se puede deshacer.</p>
      <dl className="datos datos--cuenta">
        <div>
          <dt>Hospedaje</dt>
          <dd>{dinero(cuenta.total_centavos)}</dd>
        </div>
        <div>
          <dt>Ya pagó</dt>
          <dd>{dinero(cuenta.pagado_centavos)}</dd>
        </div>
        {cuenta.consumos_pendientes.map((c) => (
          <div key={c.id}>
            <dt>
              {c.cantidad} × {c.producto}
            </dt>
            <dd>{dinero(c.total_centavos)}</dd>
          </div>
        ))}
        <div className="datos__total">
          <dt>Falta cobrar</dt>
          <dd>{dinero(cuenta.saldo_centavos)}</dd>
        </div>
      </dl>

      {hayConsumos && (
        <fieldset className="opciones">
          <legend className="campo__etiqueta">Los consumos del cuarto ({dinero(cuenta.consumos_pendientes_centavos)})</legend>
          {(
            [
              ['efectivo', 'Cobrar ahora en efectivo'],
              ['transferencia', 'Cobrar ahora por transferencia'],
              ['despues', 'Dejarlos pendientes'],
            ] as const
          ).map(([v, t]) => (
            <label key={v} className={`opcion ${medio === v ? 'is-on' : ''}`}>
              <input type="radio" name="medio" checked={medio === v} onChange={() => setMedio(v)} />
              <span>{t}</span>
              {medio === v && <Icon name="check" size="sm" />}
            </label>
          ))}
        </fieldset>
      )}

      <div className="hoja__acciones">
        <Boton
          huge
          icono="sale"
          cargando={enviando}
          onClick={async () => {
            setEnviando(true);
            await onHecho(hayConsumos && medio !== 'despues' ? medio : null);
            setEnviando(false);
          }}
        >
          Sí, hacer check-out
        </Boton>
        <Boton variante="quiet" onClick={onAtras}>
          Volver
        </Boton>
      </div>
    </div>
  );
}

export function FormDanio({
  cuarto,
  onAtras,
  onHecho,
}: {
  cuarto: { id: string; numero: string };
  onAtras: () => void;
  onHecho: () => void;
}) {
  const acc = useAcciones();
  const [nota, setNota] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <form
      className="pila"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!nota.trim()) return;
        setEnviando(true);
        const ok = await acc.danio(cuarto, nota.trim(), foto);
        setEnviando(false);
        if (ok) onHecho();
      }}
    >
      <p className="hoja__aviso">El cuarto {cuarto.numero} quedará “En arreglo” y no se podrá dar a nadie hasta que la dueña lo libere.</p>
      <div className="campo">
        <label htmlFor="nota">¿Qué pasó?</label>
        <textarea id="nota" className="input" required maxLength={400} placeholder="Ej.: se fue el agua caliente" value={nota} onChange={(e) => setNota(e.target.value)} />
      </div>
      <div className="campo">
        <span className="campo__etiqueta">Foto (si puedes)</span>
        <label className="foto">
          <Icon name="foto" />
          <span>{foto ? foto.name : 'Tomar o elegir una foto'}</span>
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <div className="hoja__acciones">
        <Boton type="submit" huge icono="mantenimiento" cargando={enviando} disabled={!nota.trim()}>
          Reportar y bloquear el cuarto
        </Boton>
        <Boton variante="quiet" onClick={onAtras}>
          Volver
        </Boton>
      </div>
    </form>
  );
}

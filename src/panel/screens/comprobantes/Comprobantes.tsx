import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import '../../styles/comprobantes.css';
import { usePerfil } from '../../data/sesion';
import { useCuartos } from '../../data/cuartos';
import { aceptarComprobante, asociarComprobante, cargarCandidatas, rechazarComprobante, type Pendiente, type useComprobantes } from '../../data/comprobantes';
import { urlFirmada } from '../../data/insumos';
import { centavosATexto, dinero, fechaCorta, hace } from '../../lib/format';
import { Aviso, Boton, ErrorCarga, Hoja, Skeleton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';
import { ChipReserva, useAhora } from '../reservas/piezas';
import { cuentaAtras } from '../reservas/logica';
import { coincide, MOTIVOS_RAPIDOS, montoEditable, montoSugerido, type Candidata } from './logica';

type Datos = ReturnType<typeof useComprobantes>;
type Accion = { tipo: 'aceptar' | 'rechazar' | 'asociar' | 'foto'; id: string };

export function Comprobantes({ datos }: { datos: Datos }) {
  const { lista, cargando, error, recargar, refrescar } = datos;
  const [accion, setAccion] = useState<Accion | null>(null);
  const ahora = useAhora();
  // La hoja se cierra sola si otra persona ya resolvió ese comprobante.
  const actual = accion ? (lista.find((c) => c.comprobante_id === accion.id) ?? null) : null;
  const cerrar = () => setAccion(null);
  const listo = () => {
    cerrar();
    void refrescar();
  };

  return (
    <section className="pantalla pantalla--comp">
      <header className="pantalla__cab">
        <h1>Comprobantes por revisar</h1>
        <p className="pantalla__sub">
          {lista.length === 0 ? 'Aquí llegan las fotos de los anticipos que mandan por WhatsApp' : lista.length === 1 ? 'Hay 1 foto esperando tu revisión' : `Hay ${lista.length} fotos esperando tu revisión`}
        </p>
      </header>

      {error && lista.length === 0 ? (
        <ErrorCarga onReintentar={recargar} />
      ) : cargando ? (
        <div className="comp-lista" aria-busy="true" aria-label="Cargando comprobantes">
          <Skeleton h="16rem" r="22px" />
          <Skeleton h="16rem" r="22px" />
        </div>
      ) : lista.length === 0 ? (
        <Aviso icono="libre" titulo="Todo al día" texto="No hay comprobantes por revisar. Cuando un huésped mande su anticipo, aparece aquí al instante." />
      ) : (
        <ul className="comp-lista">
          {lista.map((c) => (
            <li key={c.comprobante_id}>
              <Tarjeta c={c} ahora={ahora} abrir={(tipo) => setAccion({ tipo, id: c.comprobante_id })} />
            </li>
          ))}
        </ul>
      )}

      {actual && accion?.tipo === 'foto' && (
        <Hoja titulo="Comprobante" onCerrar={cerrar}>
          <Foto path={actual.foto_path} grande />
        </Hoja>
      )}
      {actual && accion?.tipo === 'aceptar' && (
        <Hoja titulo="Aceptar comprobante" onCerrar={cerrar}>
          <FormAceptar c={actual} onHecho={listo} onAtras={cerrar} />
        </Hoja>
      )}
      {actual && accion?.tipo === 'rechazar' && (
        <Hoja titulo="Rechazar comprobante" onCerrar={cerrar}>
          <FormRechazar c={actual} onHecho={listo} onAtras={cerrar} />
        </Hoja>
      )}
      {actual && accion?.tipo === 'asociar' && (
        <Hoja titulo="Asociar a una reserva" onCerrar={cerrar}>
          <FormAsociar c={actual} onHecho={listo} onAtras={cerrar} />
        </Hoja>
      )}
    </section>
  );
}

function Tarjeta({ c, ahora, abrir }: { c: Pendiente; ahora: Date; abrir: (t: Accion['tipo']) => void }) {
  const asociado = !!c.reserva_id;
  return (
    <article className="card comp">
      <button type="button" className="comp__foto" onClick={() => abrir('foto')} aria-label="Ampliar la foto del comprobante">
        <Foto path={c.foto_path} />
        <span className="comp__ampliar">
          <Icon name="buscar" size="sm" /> Ampliar
        </span>
      </button>
      <div className="comp__cuerpo">
        <header className="comp__cab">
          <div>
            <h2>{c.huesped || 'Huésped sin nombre'}</h2>
            <p className="comp__tel">
              <Icon name="telefono" size="sm" /> {c.telefono}
            </p>
          </div>
          <span className="comp__hace">{hace(c.creado_en, ahora)}</span>
        </header>

        {asociado ? (
          <>
            <p className="comp__reserva">
              <b>{c.codigo}</b>
              {c.reserva_estado && <ChipReserva estado={c.reserva_estado} />}
            </p>
            <dl className="comp__datos">
              <div>
                <dt>Cuarto</dt>
                <dd>
                  {c.habitacion} · {c.tipo}
                </dd>
              </div>
              <div className="comp__ancho">
                <dt>Fechas</dt>
                <dd>
                  {fechaCorta(c.entrada)} al {fechaCorta(c.salida)}
                </dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{dinero(c.total_centavos)}</dd>
              </div>
              <div>
                <dt>Anticipo esperado</dt>
                <dd>{dinero(c.anticipo_centavos)}</dd>
              </div>
              <div>
                <dt>Ya pagado</dt>
                <dd>{dinero(c.pagado_centavos)}</dd>
              </div>
              {c.vence_en && c.reserva_estado === 'prereserva' && (
                <div>
                  <dt>Pre-reserva</dt>
                  <dd>{cuentaAtras(c.vence_en, ahora)}</dd>
                </div>
              )}
            </dl>
          </>
        ) : (
          <p className="comp__sin">
            <Icon name="alerta" size="sm" /> Este comprobante no tiene reserva. Asóciale una para poder aceptarlo.
          </p>
        )}
        {c.monto_declarado_centavos > 0 && <p className="comp__decl">El huésped dice que envió {dinero(c.monto_declarado_centavos)}</p>}

        <div className="comp__acciones">
          {asociado ? (
            <Boton icono="check" onClick={() => abrir('aceptar')}>
              Aceptar
            </Boton>
          ) : (
            <Boton icono="llave" onClick={() => abrir('asociar')}>
              Asociar a reserva
            </Boton>
          )}
          <Boton variante="quiet" icono="cerrar" onClick={() => abrir('rechazar')}>
            Rechazar
          </Boton>
          {asociado && (
            <Boton variante="ghost" onClick={() => abrir('asociar')}>
              Cambiar reserva
            </Boton>
          )}
        </div>
      </div>
    </article>
  );
}

/** Foto del bucket privado con enlace firmado (se pide al montar). */
function Foto({ path, grande }: { path: string; grande?: boolean }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    urlFirmada(path)
      .then((u) => vivo && setUrl(u))
      .catch(() => vivo && setUrl(null));
    return () => {
      vivo = false;
    };
  }, [path]);
  if (url === undefined) return <Skeleton h={grande ? '24rem' : '100%'} r="14px" />;
  if (url === null)
    return (
      <span className="comp__sinfoto">
        <Icon name="foto" /> No pudimos abrir la foto
      </span>
    );
  return <img className={grande ? 'comp__img comp__img--grande' : 'comp__img'} src={url} alt="Foto del comprobante de pago" loading="lazy" />;
}

interface FormProps {
  c: Pendiente;
  onHecho: () => void;
  onAtras: () => void;
}

function FormAceptar({ c, onHecho, onAtras }: FormProps) {
  const toast = useToast();
  const sugerido = montoSugerido(c.anticipo_centavos, c.pagado_centavos);
  const [texto, setTexto] = useState(centavosATexto(sugerido) || '0');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: SyntheticEvent) {
    e.preventDefault();
    const m = montoEditable(texto);
    if (m == null) return setError('Escribe el monto en dólares, por ejemplo 45,50.');
    setEnviando(true);
    const r = await aceptarComprobante(c.comprobante_id, m);
    setEnviando(false);
    if (!r.ok) return setError(r.mensaje);
    toast.avisar(`Comprobante de ${c.huesped || 'huésped'} aceptado. Se registró ${dinero(m)}${c.reserva_estado === 'prereserva' ? ' y la reserva quedó confirmada' : ''}`);
    onHecho();
  }

  return (
    <form className="pila" onSubmit={(e) => void enviar(e)} noValidate>
      <p className="hoja__aviso">
        {c.huesped || 'El huésped'} · {c.codigo}. Anticipo esperado {dinero(c.anticipo_centavos)}, ya pagado {dinero(c.pagado_centavos)}.
      </p>
      <div className="campo">
        <label htmlFor="cp-monto">Monto recibido (dólares)</label>
        <div className="rv-dinero">
          <span aria-hidden="true">$</span>
          <input id="cp-monto" className="input" inputMode="decimal" autoComplete="off" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <p className="comp__ayuda">Lo que falta del anticipo está puesto. Cámbialo si el huésped mandó otro monto.</p>
      </div>
      {error && (
        <p className="campo__error" role="alert">
          {error}
        </p>
      )}
      <div className="hoja__acciones">
        <Boton type="submit" huge icono="check" cargando={enviando}>
          Aceptar y registrar pago
        </Boton>
        <Boton variante="quiet" onClick={onAtras}>
          Volver
        </Boton>
      </div>
    </form>
  );
}

function FormRechazar({ c, onHecho, onAtras }: FormProps) {
  const toast = useToast();
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: SyntheticEvent) {
    e.preventDefault();
    const m = motivo.trim();
    if (!m) return setError('Cuéntale al huésped por qué se rechaza. Elige un motivo o escríbelo.');
    setEnviando(true);
    const r = await rechazarComprobante(c.comprobante_id, m);
    setEnviando(false);
    if (!r.ok) return setError(r.mensaje);
    toast.avisar('Comprobante rechazado. Le avisaremos al huésped');
    onHecho();
  }

  return (
    <form className="pila" onSubmit={(e) => void enviar(e)} noValidate>
      <p className="hoja__aviso">El huésped recibirá este motivo por WhatsApp.</p>
      <div className="rv-atajos">
        {MOTIVOS_RAPIDOS.map((m) => (
          <button key={m} type="button" className="filtro" aria-pressed={motivo === m} onClick={() => setMotivo(m)}>
            {m}
          </button>
        ))}
      </div>
      <div className="campo">
        <label htmlFor="cp-motivo">Motivo</label>
        <textarea id="cp-motivo" className="input rv-notas" maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      {error && (
        <p className="campo__error" role="alert">
          {error}
        </p>
      )}
      <div className="hoja__acciones">
        <Boton type="submit" variante="danger" huge icono="cerrar" cargando={enviando}>
          Rechazar comprobante
        </Boton>
        <Boton variante="quiet" onClick={onAtras}>
          Volver
        </Boton>
      </div>
    </form>
  );
}

function FormAsociar({ c, onHecho, onAtras }: FormProps) {
  const { hotelId } = usePerfil();
  const { cuartos } = useCuartos();
  const toast = useToast();
  const numeros = useMemo(() => new Map(cuartos.map((x) => [x.id, x.numero])), [cuartos]);
  const [todas, setTodas] = useState<Candidata[] | null | undefined>(undefined);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(c.reserva_id || null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void cargarCandidatas(hotelId, numeros).then((r) => vivo && setTodas(r));
    return () => {
      vivo = false;
    };
  }, [hotelId, numeros]);

  const vistas = useMemo(() => (todas ?? []).filter((x) => coincide(x, q)).slice(0, 30), [todas, q]);

  async function enviar(e: SyntheticEvent) {
    e.preventDefault();
    if (!sel) return setError('Elige la reserva a la que pertenece este comprobante.');
    setEnviando(true);
    const r = await asociarComprobante(c.comprobante_id, sel);
    setEnviando(false);
    if (!r.ok) return setError(r.mensaje);
    toast.avisar('Comprobante asociado a la reserva. Ya lo puedes aceptar');
    onHecho();
  }

  return (
    <form className="pila" onSubmit={(e) => void enviar(e)} noValidate>
      <p className="hoja__aviso">
        Comprobante de {c.huesped || c.telefono}. Busca la reserva por nombre, código o teléfono.
      </p>
      <div className="campo">
        <label htmlFor="cp-buscar">Buscar reserva</label>
        <input id="cp-buscar" type="search" className="input" autoComplete="off" placeholder="María, HA-0042 o 0987654321" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {todas === undefined ? (
        <Skeleton h="8rem" r="14px" />
      ) : todas === null ? (
        <p className="campo__error" role="alert">
          No pudimos cargar las reservas. Intenta otra vez en un momento.
        </p>
      ) : vistas.length === 0 ? (
        <p className="comp__ayuda">No encontramos reservas con eso.</p>
      ) : (
        <fieldset className="opciones comp__candidatas">
          <legend className="sr-only">Reservas</legend>
          {vistas.map((x) => (
            <label key={x.id} className={`opcion comp__cand ${sel === x.id ? 'is-on' : ''}`}>
              <input type="radio" name="cp-reserva" checked={sel === x.id} onChange={() => setSel(x.id)} />
              <span>
                <b>{x.huesped ?? 'Sin nombre'}</b>
                <small>
                  {x.codigo}
                  {x.cuarto && ` · cuarto ${x.cuarto}`}
                  {x.telefono && ` · ${x.telefono}`}
                </small>
              </span>
              {sel === x.id && <Icon name="check" size="sm" />}
            </label>
          ))}
        </fieldset>
      )}
      {error && (
        <p className="campo__error" role="alert">
          {error}
        </p>
      )}
      <div className="hoja__acciones">
        <Boton type="submit" huge icono="llave" cargando={enviando}>
          Asociar a esta reserva
        </Boton>
        <Boton variante="quiet" onClick={onAtras}>
          Volver
        </Boton>
      </div>
    </form>
  );
}

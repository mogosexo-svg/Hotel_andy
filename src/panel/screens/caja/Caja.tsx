import { useState, type ReactNode } from 'react';
import '../../styles/caja.css';
import { usePerfil } from '../../data/sesion';
import { cerrarCaja, pedirPermisoAvisos, permisoAvisos, type Cierre, type ResumenCaja, useCaja } from '../../data/caja';
import { dinero, fechaCorta, hoyEC } from '../../lib/format';
import { Aviso, Boton, ErrorCarga, Hoja, Skeleton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';
import { Salidas } from './Salidas';
import { montoEditable } from '../comprobantes/logica';
import { desdeTexto, enlaceWhatsApp, estadoDiferencia, nombreTurno, quienCerro, tituloTurno, trozosMensaje, type EstadoCaja } from './logica';

const CHIP: Record<EstadoCaja, { clase: string; icono: 'libre' | 'alerta' | 'mas' }> = {
  cuadra: { clase: 'e-libre', icono: 'libre' },
  faltan: { clase: 'e-ocupado', icono: 'alerta' },
  sobran: { clase: 'e-limpiando', icono: 'mas' },
};

/** Cuadra / Faltan / Sobran: siempre color + ícono + palabra. */
function ChipDif({ dif, grande }: { dif: number; grande?: boolean }) {
  const e = estadoDiferencia(dif);
  const c = CHIP[e.estado];
  return (
    <span className={`chip ${c.clase} ${grande ? 'caja-dif' : ''}`}>
      <Icon name={c.icono} />
      {e.texto}
    </span>
  );
}

function Burbuja({ mensaje }: { mensaje: string }) {
  return (
    <div className="caja-chat">
      <p className="caja-burbuja">
        {trozosMensaje(mensaje).map((x, i) => (x.b ? <strong key={i}>{x.t}</strong> : x.t))}
      </p>
    </div>
  );
}

function AccionesMensaje({ mensaje }: { mensaje: string }) {
  const toast = useToast();
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensaje);
      toast.avisar('Mensaje copiado');
    } catch {
      toast.error('No pudimos copiar. Mantén presionado el texto para copiarlo.');
    }
  };
  return (
    <div className="caja-acciones">
      <a className="btn btn--primary btn--block" href={enlaceWhatsApp(mensaje)} target="_blank" rel="noopener noreferrer">
        <Icon name="chat" size="sm" /> Enviar por WhatsApp
      </a>
      <Boton variante="quiet" block icono="copiar" onClick={() => void copiar()}>
        Copiar
      </Boton>
    </div>
  );
}

export function Caja() {
  const { hotelId } = usePerfil();
  const { resumen, cierres, cargando, error, recargar, refrescar } = useCaja();
  const [hecho, setHecho] = useState<Cierre | null>(null);
  const [abierto, setAbierto] = useState<Cierre | null>(null);
  const [permiso, setPermiso] = useState(permisoAvisos);

  const sub = hecho
    ? 'Caja cerrada'
    : resumen?.cerrado
      ? 'Todo listo por hoy'
      : resumen
        ? tituloTurno(resumen.turno, resumen.hora)
        : 'Cuenta lo que entró y cierra la caja';

  let cuerpo: ReactNode;
  if (error && !resumen) cuerpo = <ErrorCarga onReintentar={recargar} />;
  else if (cargando || !resumen)
    cuerpo = (
      <div className="caja-col" aria-busy="true" aria-label="Cargando la caja">
        <Skeleton h="12rem" r="22px" />
        <Skeleton h="14rem" r="22px" />
      </div>
    );
  else if (hecho)
    cuerpo = <Exito cierre={hecho} onListo={() => setHecho(null)} />;
  else if (resumen.cerrado)
    cuerpo = <Aviso icono="libre" titulo="Ya cerraste la caja de hoy" texto="Todo quedó guardado. El siguiente cierre empieza mañana." />;
  else
    cuerpo = (
      <Contar
        key={`${resumen.fecha}-${resumen.turno}`}
        resumen={resumen}
        hotelId={hotelId}
        onSalidas={refrescar}
        onCerrado={(c) => {
          setHecho(c);
          refrescar();
        }}
      />
    );

  return (
    <section className="pantalla pantalla--caja">
      <header className="pantalla__cab">
        <div>
          <h1>Caja</h1>
          <p className="pantalla__sub">{sub}</p>
        </div>
        {permiso === 'default' && (
          <Boton variante="ghost" icono="campana" onClick={() => void pedirPermisoAvisos().then(setPermiso)}>
            Avisarme en este dispositivo
          </Boton>
        )}
        {permiso === 'granted' && (
          <p className="caja-avisos-on">
            <Icon name="check" size="sm" /> Te avisamos en este dispositivo
          </p>
        )}
      </header>

      <div className="caja">
        <div className="caja-col">{cuerpo}</div>
        {resumen && (
          <aside className="caja-col" aria-label="Cierres anteriores">
            <h2 className="caja-titulo">Últimos cierres</h2>
            {cierres.length === 0 ? (
              <p className="caja-vacio">Cuando cierres la caja, el resumen queda guardado aquí.</p>
            ) : (
              <ul className="caja-hist">
                {cierres.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="card caja-fila" onClick={() => setAbierto(c)}>
                      <span className="caja-fila__quien">
                        <b>
                          Cierre de {nombreTurno(c.turno)} · {c.fecha === hoyEC() ? 'hoy' : fechaCorta(c.fecha)}
                        </b>
                        <small>{quienCerro(c.mensaje) ? `Cerró ${quienCerro(c.mensaje)}` : 'Cierre guardado'}</small>
                      </span>
                      <span className="caja-fila__monto">{dinero(c.total_centavos)}</span>
                      <ChipDif dif={c.diferencia_centavos ?? 0} />
                      <Icon name="siguiente" size="sm" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>

      {abierto && (
        <Hoja titulo={`Cierre de ${nombreTurno(abierto.turno)} · ${fechaCorta(abierto.fecha)}`} onCerrar={() => setAbierto(null)}>
          <div className="caja-hoja">
            <Burbuja mensaje={abierto.mensaje} />
            <AccionesMensaje mensaje={abierto.mensaje} />
          </div>
        </Hoja>
      )}
    </section>
  );
}

function Contar({ resumen, hotelId, onCerrado, onSalidas }: { resumen: ResumenCaja; hotelId: string; onCerrado: (c: Cierre) => void; onSalidas: () => void }) {
  const [texto, setTexto] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [salidas, setSalidas] = useState(false);
  const nSalidas = resumen.salidas_registradas ?? 0;
  const contado = montoEditable(texto);
  const raro = texto.trim() !== '' && contado === null;

  const cerrar = async () => {
    if (contado === null) return setError('Escribe cuánto efectivo hay en la caja, por ejemplo 25 o 25,50.');
    setEnviando(true);
    setError('');
    const r = await cerrarCaja(hotelId, resumen.turno, contado, nota);
    setEnviando(false);
    if (r.ok) onCerrado(r.cierre);
    else setError(r.mensaje);
  };

  return (
    <>
      <article className="card caja-resumen">
        <p className="caja-resumen__turno">{tituloTurno(resumen.turno, resumen.hora)}</p>
        <p className="caja-resumen__desde">Cuenta lo que entró {desdeTexto(resumen.desde)}</p>
        <dl className="caja-cifras">
          <div>
            <dt>Efectivo</dt>
            <dd>{dinero(resumen.efectivo_centavos)}</dd>
          </div>
          <div>
            <dt>Transferencias</dt>
            <dd>{dinero(resumen.transferencia_centavos)}</dd>
          </div>
          <div className="caja-cifras__total">
            <dt>Total</dt>
            <dd>{dinero(resumen.total_centavos)}</dd>
          </div>
        </dl>
        <details className="caja-movs">
          <summary>
            Ver movimientos ({resumen.movimientos.length})
            <Icon name="siguiente" size="sm" />
          </summary>
          {resumen.movimientos.length === 0 ? (
            <p className="caja-vacio">Todavía no ha entrado nada.</p>
          ) : (
            <ul>
              {resumen.movimientos.map((m, i) => (
                <li key={i}>
                  <span className="caja-movs__hora">{m.hora}</span>
                  <span className="caja-movs__txt">
                    {m.concepto}
                    <small>{m.medio === 'efectivo' ? 'Efectivo' : 'Transferencia'}</small>
                  </span>
                  <b>{dinero(m.monto_centavos)}</b>
                </li>
              ))}
            </ul>
          )}
        </details>
      </article>

      <article className="card caja-salidas">
        <h2 className="caja-salidas__titulo">Lo que salió en este turno</h2>
        <p className="caja-salidas__txt">{nSalidas === 0 ? 'Antes de cerrar, anota lo que se vendió y lo que se usó.' : `Anotaste ${nSalidas} ${nSalidas === 1 ? 'salida' : 'salidas'}.`}</p>
        <Boton variante={nSalidas === 0 ? 'primary' : 'quiet'} block icono={nSalidas === 0 ? 'inventario' : 'mas'} onClick={() => setSalidas(true)}>
          {nSalidas === 0 ? 'Anotar salidas' : 'Anotar más'}
        </Boton>
      </article>
      {salidas && <Salidas onCerrar={() => setSalidas(false)} onGuardado={onSalidas} />}

      <form
        className="card caja-contar"
        onSubmit={(e) => {
          e.preventDefault();
          void cerrar();
        }}
      >
        <div className="campo">
          <label htmlFor="caja-efectivo">¿Cuánto efectivo hay en la caja?</label>
          <div className="caja-monto">
            <span aria-hidden="true">$</span>
            <input id="caja-efectivo" className="input" inputMode="decimal" autoComplete="off" placeholder="0" value={texto} onChange={(e) => setTexto(e.target.value)} aria-describedby="caja-dif" />
          </div>
        </div>
        <div id="caja-dif" className="caja-dif-fila" aria-live="polite">
          {contado !== null ? (
            <>
              <ChipDif dif={contado - resumen.efectivo_centavos} grande />
              <span className="caja-dif-fila__sub">Debería haber {dinero(resumen.efectivo_centavos)} en efectivo</span>
            </>
          ) : (
            <span className="caja-dif-fila__sub">{raro ? 'Escribe solo números, como 25 o 25,50' : `Debería haber ${dinero(resumen.efectivo_centavos)} en efectivo`}</span>
          )}
        </div>
        <div className="campo">
          <label htmlFor="caja-nota">Nota (opcional)</label>
          <textarea id="caja-nota" className="input rv-notas" maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>
        {error && (
          <p className="campo__error" role="alert">
            {error}
          </p>
        )}
        <Boton type="submit" huge block cargando={enviando} icono="caja" disabled={contado === null}>
          Cerrar caja
        </Boton>
      </form>
    </>
  );
}

function Exito({ cierre, onListo }: { cierre: Cierre; onListo: () => void }) {
  return (
    <article className="card caja-exito" role="status">
      <span className="caja-exito__ico">
        <Icon name="libre" size="lg" />
      </span>
      <h2>Listo, cerraste la caja de {nombreTurno(cierre.turno)}</h2>
      <p className="caja-exito__sub">Este es el resumen. Mándalo por WhatsApp para que quede registrado.</p>
      <Burbuja mensaje={cierre.mensaje} />
      <AccionesMensaje mensaje={cierre.mensaje} />
      <Boton variante="ghost" block onClick={onListo}>
        Listo
      </Boton>
    </article>
  );
}

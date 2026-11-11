import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAcciones, type CuentaReserva } from '../../data/acciones';
import type { Cuarto } from '../../data/cuartos';
import { useOperaciones, type ReservaVista } from '../../data/reservas';
import { dinero, fechaCorta, hoyEC } from '../../lib/format';
import { Icon } from '../../ui/Icon';
import { Boton, Hoja, Skeleton } from '../../ui/kit';
import { useToast } from '../../ui/Toast';
import { FormSalida } from '../HojaCuarto';
import { anticipoSugerido, centavosATexto, cuentaAtras, diasEntre, fuenteTexto, montoACentavos, sumarDias } from './logica';
import { ChipReserva, Pasos, useAhora } from './piezas';

type Vista = 'menu' | 'pago' | 'mover' | 'editar' | 'cancelar' | 'salida';

interface Props {
  id: string;
  cuartos: Cuarto[];
  reservas: ReservaVista[];
  parchar: (id: string, patch: Partial<ReservaVista>) => () => void;
  refrescar: () => Promise<void>;
  onCerrar: () => void;
  /** Abre directo el formulario de pago (desde "Registrar anticipo" al crear). */
  pagar?: boolean;
}

const TITULOS: Record<Vista, string> = {
  menu: '',
  pago: 'Registrar pago',
  mover: 'Mover la reserva',
  editar: 'Editar datos',
  cancelar: 'Cancelar la reserva',
  salida: 'Salida del huésped',
};

export function HojaReserva({ id, cuartos, reservas, parchar, refrescar, onCerrar, pagar }: Props) {
  const ops = useOperaciones();
  const acc = useAcciones();
  const enLista = reservas.find((x) => x.id === id) ?? null;
  const [r, setR] = useState<ReservaVista | null>(enLista);
  const [fallo, setFallo] = useState(false);
  const [vista, setVista] = useState<Vista>(pagar ? 'pago' : 'menu');
  const [cuenta, setCuenta] = useState<CuentaReserva | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const ahora = useAhora();
  const hoy = hoyEC();

  const recargar = useCallback(async () => {
    const x = await ops.reserva(id);
    if (!x.ok) return setFallo(true);
    setFallo(false);
    setR(x.valor);
  }, [ops, id]);

  useEffect(() => {
    void recargar();
  }, [recargar, enLista]);

  const total = r?.total;
  const estado = r?.estado;
  const recargarCuenta = useCallback(() => {
    void acc.cuenta(id).then(setCuenta);
  }, [acc, id]);
  useEffect(() => {
    if (estado) recargarCuenta();
  }, [estado, total, recargarCuenta]);

  const cuarto = r ? (cuartos.find((c) => c.id === r.habitacionId) ?? null) : null;
  const volver = () => setVista('menu');

  if (fallo && !r)
    return (
      <Hoja titulo="Reserva" onCerrar={onCerrar}>
        <div className="pila">
          <p>No pudimos abrir esta reserva. Revisa tu señal e intenta otra vez.</p>
          <Boton variante="quiet" icono="recargar" onClick={() => void recargar()}>
            Intentar otra vez
          </Boton>
        </div>
      </Hoja>
    );
  if (!r || !cuarto)
    return (
      <Hoja titulo="Reserva" onCerrar={onCerrar}>
        <div className="pila" aria-busy="true" aria-label="Cargando la reserva">
          <Skeleton h="2rem" w="60%" />
          <Skeleton h="9rem" />
          <Skeleton h="4.5rem" r="20px" />
        </div>
      </Hoja>
    );

  const viva = r.estado === 'prereserva' || r.estado === 'confirmada' || r.estado === 'en_curso';
  const noEmpezo = r.estado === 'prereserva' || r.estado === 'confirmada';
  const noches = diasEntre(r.entrada, r.salida);
  const titulo = vista === 'menu' ? `Cuarto ${cuarto.numero}` : `${TITULOS[vista]} · ${cuarto.numero}`;

  async function checkIn() {
    if (!r || !cuarto) return;
    setOcupado(true);
    const ok = await acc.checkIn({ id: cuarto.id, numero: cuarto.numero }, r.id);
    setOcupado(false);
    if (ok) onCerrar();
  }

  return (
    <Hoja titulo={titulo} onCerrar={onCerrar}>
      {vista === 'menu' && (
        <>
          <div className="hoja__meta">
            <ChipReserva estado={r.estado} />
            <span>
              {fuenteTexto(r.fuente)} · código {r.codigo}
            </span>
          </div>

          {r.estado === 'prereserva' && r.venceEn && (
            <p className="rv-aviso-vence">
              <Icon name="reloj" size="sm" />
              <span>
                <b>{cuentaAtras(r.venceEn, ahora)}.</b> Si no llega el anticipo, el cuarto se libera solo.
              </span>
            </p>
          )}

          <dl className="datos">
            <div>
              <dt>Huésped</dt>
              <dd>{r.huesped ?? 'Sin nombre'}</dd>
            </div>
            <div>
              <dt>Entra</dt>
              <dd>{fechaCorta(r.entrada)}</dd>
            </div>
            <div>
              <dt>Sale</dt>
              <dd>{fechaCorta(r.salida)}</dd>
            </div>
            <div>
              <dt>Noches</dt>
              <dd>{noches}</dd>
            </div>
            <div>
              <dt>Personas</dt>
              <dd>
                {r.personas}
                {r.mascota ? ' · con mascota' : ''}
              </dd>
            </div>
            {r.notas && (
              <div>
                <dt>Notas</dt>
                <dd className="rv-nota">{r.notas}</dd>
              </div>
            )}
          </dl>

          <h3 className="rv-sub">Cuenta</h3>
          {cuenta === undefined ? (
            <Skeleton h="6rem" />
          ) : cuenta === null ? (
            <p className="rv-ayuda">No pudimos traer la cuenta. Cierra y vuelve a abrir.</p>
          ) : (
            <dl className="datos datos--cuenta">
              <div>
                <dt>Hospedaje</dt>
                <dd>{cuenta.total_centavos == null ? 'Por definir' : dinero(cuenta.total_centavos)}</dd>
              </div>
              <div>
                <dt>Ya pagó</dt>
                <dd>{dinero(cuenta.pagado_centavos)}</dd>
              </div>
              {cuenta.consumos_pendientes_centavos > 0 && (
                <div>
                  <dt>Consumos pendientes</dt>
                  <dd>{dinero(cuenta.consumos_pendientes_centavos)}</dd>
                </div>
              )}
              <div className="datos__total">
                <dt>Falta cobrar</dt>
                <dd>{cuenta.total_centavos == null ? '—' : dinero(cuenta.saldo_centavos)}</dd>
              </div>
            </dl>
          )}

          <div className="hoja__acciones">
            {noEmpezo && r.entrada <= hoy && (
              <Boton huge icono="ocupado" cargando={ocupado} onClick={() => void checkIn()}>
                Hacer check-in
              </Boton>
            )}
            {r.estado === 'en_curso' && (
              <Boton huge icono="sale" onClick={() => setVista('salida')}>
                Hacer check-out
              </Boton>
            )}
            {viva && (
              <Boton variante={noEmpezo && r.entrada <= hoy ? 'quiet' : 'primary'} icono="dinero" onClick={() => setVista('pago')}>
                {r.estado === 'prereserva' ? 'Registrar anticipo' : 'Registrar pago'}
              </Boton>
            )}
            {viva && (
              <div className="rv-acc2">
                <Boton variante="quiet" icono="mover" onClick={() => setVista('mover')}>
                  Mover
                </Boton>
                <Boton variante="quiet" icono="editar" onClick={() => setVista('editar')}>
                  Editar
                </Boton>
              </div>
            )}
            {noEmpezo && (
              <Boton variante="ghost" className="rv-cancelar" onClick={() => setVista('cancelar')}>
                Cancelar la reserva
              </Boton>
            )}
            {!viva && <p className="hoja__nada">{r.estado === 'cancelada' ? 'Esta reserva está cancelada.' : 'Esta reserva ya terminó.'}</p>}
          </div>
        </>
      )}

      {vista === 'salida' && (
        <FormSalida
          numero={cuarto.numero}
          reservaId={r.id}
          onAtras={volver}
          onHecho={(medio) => acc.checkOut({ id: cuarto.id, numero: cuarto.numero }, r.id, medio).then((ok) => ok && onCerrar())}
        />
      )}
      {vista === 'pago' && (
        <FormPago
          r={r}
          cuenta={cuenta ?? null}
          onAtras={volver}
          onHecho={() => {
            recargarCuenta();
            void recargar();
            void refrescar();
            volver();
          }}
        />
      )}
      {vista === 'mover' && (
        <FormMover
          r={r}
          cuartos={cuartos}
          reservas={reservas}
          parchar={parchar}
          refrescar={refrescar}
          onAtras={volver}
          onHecho={onCerrar}
        />
      )}
      {vista === 'editar' && (
        <FormEditar
          r={r}
          max={cuarto.maxPersonas || 12}
          onAtras={volver}
          onHecho={() => {
            void recargar();
            void refrescar();
            volver();
          }}
        />
      )}
      {vista === 'cancelar' && <FormCancelar r={r} parchar={parchar} refrescar={refrescar} onAtras={volver} onHecho={onCerrar} />}
    </Hoja>
  );
}

/* ---------- Pago ---------- */
function FormPago({ r, cuenta, onAtras, onHecho }: { r: ReservaVista; cuenta: CuentaReserva | null; onAtras: () => void; onHecho: () => void }) {
  const ops = useOperaciones();
  const toast = useToast();
  const [pct, setPct] = useState(50);
  const [texto, setTexto] = useState('');
  const [medio, setMedio] = useState<'efectivo' | 'transferencia'>('transferencia');
  const [foto, setFoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    void ops.anticipoPorcentaje().then(setPct);
  }, [ops]);

  const total = cuenta?.total_centavos ?? r.total;
  const pagado = cuenta?.pagado_centavos ?? 0;
  const sugerido = pagado === 0 ? anticipoSugerido(total, pct) : null;
  const saldo = total != null ? Math.max(0, total - pagado) : null;

  useEffect(() => {
    const base = sugerido ?? saldo;
    if (base && base > 0) setTexto((t) => t || centavosATexto(base));
  }, [sugerido, saldo]);

  async function enviar(e: { preventDefault(): void }) {
    e.preventDefault();
    const c = montoACentavos(texto);
    if (!c) return setError('Escribe cuánto pagó, por ejemplo 40 o 40,50.');
    setError(null);
    setEnviando(true);
    const res = await ops.pagar(r.id, c, medio, foto);
    setEnviando(false);
    if (!res.ok) return setError(res.mensaje);
    toast.avisar(
      `Pago de ${dinero(c)} registrado${r.estado === 'prereserva' ? '. La reserva quedó confirmada' : ''}${res.valor.fotoFallo ? '. La foto no se pudo subir' : ''}`,
    );
    onHecho();
  }

  return (
    <form className="pila" onSubmit={(e) => void enviar(e)} noValidate>
      {total == null ? (
        <p className="hoja__aviso">El total todavía está por definir, así que escribe el monto que recibiste.</p>
      ) : (
        <p className="hoja__aviso">
          Total {dinero(total)}. Ya pagó {dinero(pagado)}. Falta {dinero(saldo)}.
        </p>
      )}
      <div className="campo">
        <label htmlFor="rv-monto">Monto recibido (dólares)</label>
        <div className="rv-dinero">
          <span aria-hidden="true">$</span>
          <input id="rv-monto" className="input" inputMode="decimal" autoComplete="off" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <div className="rv-atajos">
          {sugerido != null && (
            <button type="button" className="filtro" onClick={() => setTexto(centavosATexto(sugerido))}>
              Anticipo {pct} %: {dinero(sugerido)}
            </button>
          )}
          {saldo != null && saldo > 0 && (
            <button type="button" className="filtro" onClick={() => setTexto(centavosATexto(saldo))}>
              Todo lo que falta: {dinero(saldo)}
            </button>
          )}
        </div>
      </div>
      <fieldset className="opciones">
        <legend className="campo__etiqueta">¿Cómo pagó?</legend>
        {(
          [
            ['transferencia', 'Transferencia'],
            ['efectivo', 'Efectivo'],
          ] as const
        ).map(([v, t]) => (
          <label key={v} className={`opcion ${medio === v ? 'is-on' : ''}`}>
            <input type="radio" name="medio-pago" checked={medio === v} onChange={() => setMedio(v)} />
            <span>{t}</span>
            {medio === v && <Icon name="check" size="sm" />}
          </label>
        ))}
      </fieldset>
      <div className="campo">
        <span className="campo__etiqueta">Foto del comprobante (si la tienes)</span>
        <label className="foto">
          <Icon name="foto" />
          <span>{foto ? foto.name : 'Tomar o elegir una foto'}</span>
          <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      {error && (
        <p className="campo__error" role="alert">
          {error}
        </p>
      )}
      <div className="hoja__acciones">
        <Boton type="submit" huge icono="dinero" cargando={enviando}>
          Registrar pago
        </Boton>
        <Boton variante="quiet" onClick={onAtras}>
          Volver
        </Boton>
      </div>
    </form>
  );
}

/* ---------- Mover ---------- */
function FormMover({
  r,
  cuartos,
  reservas,
  parchar,
  refrescar,
  onAtras,
  onHecho,
}: {
  r: ReservaVista;
  cuartos: Cuarto[];
  reservas: ReservaVista[];
  parchar: Props['parchar'];
  refrescar: () => Promise<void>;
  onAtras: () => void;
  onHecho: () => void;
}) {
  const ops = useOperaciones();
  const toast = useToast();
  const hoy = hoyEC();
  const enCurso = r.estado === 'en_curso';
  const [entrada, setEntrada] = useState(r.entrada);
  const [salida, setSalida] = useState(r.salida);
  const [hab, setHab] = useState(r.habitacionId);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const ocupados = useMemo(() => {
    const s = new Set<string>();
    reservas.forEach((x) => {
      if (x.id !== r.id && x.entrada < salida && x.salida > entrada) s.add(x.habitacionId);
    });
    return s;
  }, [reservas, r.id, entrada, salida]);

  function cambiarEntrada(v: string) {
    const noches = diasEntre(entrada, salida);
    setEntrada(v);
    if (v && (salida <= v || noches > 0)) setSalida(sumarDias(v, Math.max(1, noches)));
  }

  async function mover(e: { preventDefault(): void }) {
    e.preventDefault();
    if (salida <= entrada) return setError('La salida tiene que ser después de la entrada.');
    if (!enCurso && entrada < hoy) return setError('La entrada no puede ser un día que ya pasó.');
    if (entrada === r.entrada && salida === r.salida && hab === r.habitacionId) return setError('No cambiaste nada todavía.');
    setError(null);
    setEnviando(true);
    const antes = { entrada: r.entrada, salida: r.salida, habitacionId: r.habitacionId };
    const revertir = parchar(r.id, { entrada, salida, habitacionId: hab });
    const res = await ops.mover(r.id, { entrada, salida, habitacionId: hab });
    setEnviando(false);
    if (!res.ok) {
      revertir();
      return setError(res.mensaje);
    }
    void refrescar();
    toast.avisar('Reserva movida', {
      deshacer: async () => {
        const rev = parchar(r.id, antes);
        const b = await ops.mover(r.id, antes);
        if (!b.ok) {
          rev();
          toast.error(b.mensaje);
        } else void refrescar();
      },
    });
    onHecho();
  }

  return (
    <form className="pila rv-form" onSubmit={(e) => void mover(e)} noValidate>
      {enCurso && <p className="hoja__aviso">El huésped ya está en el cuarto: solo puedes cambiar el día de salida.</p>}
      <div className="rv-par">
        <div className="campo">
          <label htmlFor="mv-ent">Entra</label>
          <input id="mv-ent" type="date" className="input" disabled={enCurso} min={hoy} value={entrada} onChange={(e) => cambiarEntrada(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="mv-sal">Sale</label>
          <input id="mv-sal" type="date" className="input" min={sumarDias(entrada, 1)} value={salida} onChange={(e) => setSalida(e.target.value)} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="mv-cuarto">Cuarto</label>
        <select id="mv-cuarto" className="input" disabled={enCurso} value={hab} onChange={(e) => setHab(e.target.value)}>
          {[...cuartos]
            .sort((a, b) => a.numero.localeCompare(b.numero, 'es', { numeric: true }))
            .map((c) => (
              <option key={c.id} value={c.id} disabled={ocupados.has(c.id)}>
                {c.numero} · {c.tipo} (hasta {c.maxPersonas}){ocupados.has(c.id) ? ' · ocupado esas fechas' : ''}
              </option>
            ))}
        </select>
      </div>
      <p className="rv-ayuda">El total se vuelve a calcular con las fechas nuevas.</p>
      {error && (
        <p className="campo__error" role="alert">
          {error}
        </p>
      )}
      <div className="hoja__acciones">
        <Boton type="submit" huge icono="mover" cargando={enviando}>
          Mover reserva
        </Boton>
        <Boton variante="quiet" onClick={onAtras}>
          Volver
        </Boton>
      </div>
    </form>
  );
}

/* ---------- Editar ---------- */
function FormEditar({ r, max, onAtras, onHecho }: { r: ReservaVista; max: number; onAtras: () => void; onHecho: () => void }) {
  const ops = useOperaciones();
  const toast = useToast();
  const [personas, setPersonas] = useState(r.personas);
  const [mascota, setMascota] = useState(r.mascota);
  const [notas, setNotas] = useState(r.notas ?? '');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: { preventDefault(): void }) {
    e.preventDefault();
    setEnviando(true);
    const res = await ops.editar(r.id, { personas, mascota, notas });
    setEnviando(false);
    if (!res.ok) return setError(res.mensaje);
    toast.avisar('Cambios guardados');
    onHecho();
  }
  return (
    <form className="pila" onSubmit={(e) => void guardar(e)}>
      <div className="campo">
        <span className="campo__etiqueta">Personas (hasta {max})</span>
        <div className="rv-fila-campos">
          <Pasos valor={personas} max={max} onCambio={setPersonas} etiqueta="Personas" />
          <label className={`opcion rv-mascota ${mascota ? 'is-on' : ''}`}>
            <input type="checkbox" checked={mascota} onChange={(e) => setMascota(e.target.checked)} />
            <span>Trae mascota</span>
            {mascota && <Icon name="check" size="sm" />}
          </label>
        </div>
      </div>
      <div className="campo">
        <label htmlFor="ed-notas">Notas</label>
        <textarea id="ed-notas" className="input rv-notas" maxLength={300} value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>
      {error && (
        <p className="campo__error" role="alert">
          {error}
        </p>
      )}
      <div className="hoja__acciones">
        <Boton type="submit" huge icono="check" cargando={enviando}>
          Guardar cambios
        </Boton>
        <Boton variante="quiet" onClick={onAtras}>
          Volver
        </Boton>
      </div>
    </form>
  );
}

/* ---------- Cancelar (irreversible: pide motivo) ---------- */
const MOTIVOS = ['No pagó el anticipo', 'El huésped canceló', 'Se repitió por error'];

function FormCancelar({ r, parchar, refrescar, onAtras, onHecho }: { r: ReservaVista; parchar: Props['parchar']; refrescar: () => Promise<void>; onAtras: () => void; onHecho: () => void }) {
  const ops = useOperaciones();
  const toast = useToast();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cancelar(e: { preventDefault(): void }) {
    e.preventDefault();
    if (motivo.trim().length < 3) return setError('Escribe el motivo, aunque sea corto.');
    setError(null);
    setEnviando(true);
    const revertir = parchar(r.id, { estado: 'cancelada' });
    const res = await ops.cancelar(r.id, motivo);
    setEnviando(false);
    if (!res.ok) {
      revertir();
      return setError(res.mensaje);
    }
    void refrescar();
    toast.avisar('Reserva cancelada. El cuarto quedó libre.');
    onHecho();
  }
  return (
    <form className="pila" onSubmit={(e) => void cancelar(e)} noValidate>
      <p className="hoja__aviso">
        Esto no se puede deshacer: el cuarto queda libre para otra persona.
        {' '}Si ya pagó, acuerda con el huésped qué pasa con el dinero.
      </p>
      <div className="campo">
        <label htmlFor="cn-motivo">¿Por qué se cancela?</label>
        <div className="rv-atajos">
          {MOTIVOS.map((m) => (
            <button key={m} type="button" className="filtro" aria-pressed={motivo === m} onClick={() => setMotivo(m)}>
              {m}
            </button>
          ))}
        </div>
        <textarea id="cn-motivo" className="input rv-notas" maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      {error && (
        <p className="campo__error" role="alert">
          {error}
        </p>
      )}
      <div className="hoja__acciones">
        <Boton type="submit" huge variante="danger" icono="cerrar" cargando={enviando}>
          Sí, cancelar la reserva
        </Boton>
        <Boton variante="quiet" onClick={onAtras}>
          No, volver
        </Boton>
      </div>
    </form>
  );
}

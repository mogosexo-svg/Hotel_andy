import { useEffect, useMemo, useState } from 'react';
import type { Cuarto } from '../../data/cuartos';
import { useOperaciones, type HuespedFila, type ReservaVista } from '../../data/reservas';
import { dinero, fechaCorta, hoyEC } from '../../lib/format';
import { Boton, Hoja } from '../../ui/kit';
import { useToast } from '../../ui/Toast';
import { Icon } from '../../ui/Icon';
import { diasEntre, FUENTES, sumarDias, validarReserva, type Fuente } from './logica';
import { Pasos } from './piezas';

export interface Inicio {
  habitacionId?: string;
  entrada?: string;
  huesped?: HuespedFila;
}

interface Props {
  inicio: Inicio;
  cuartos: Cuarto[];
  /** Reservas ya cargadas: sirven para marcar cuartos ocupados en esas fechas. */
  reservas: ReservaVista[];
  onCerrar: () => void;
  onAbrir: (id: string, pagar?: boolean) => void;
}

const nuevoVacio = { nombre: '', documento: '', telefono: '', procedencia: '' };

export function HojaNueva({ inicio, cuartos, reservas, onCerrar, onAbrir }: Props) {
  const ops = useOperaciones();
  const toast = useToast();
  const hoy = hoyEC();
  const [entrada, setEntrada] = useState(inicio.entrada ?? hoy);
  const [salida, setSalida] = useState(sumarDias(inicio.entrada ?? hoy, 1));
  const [habitacionId, setHabitacionId] = useState<string>(inicio.habitacionId ?? '');
  const [personas, setPersonas] = useState(2);
  const [mascota, setMascota] = useState(false);
  const [fuente, setFuente] = useState<Fuente>('whatsapp');
  const [aparta, setAparta] = useState<boolean | null>(null); // null = según la fuente
  const [notas, setNotas] = useState('');
  const [huesped, setHuesped] = useState<HuespedFila | null>(inicio.huesped ?? null);
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState(nuevoVacio);
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<HuespedFila[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hecha, setHecha] = useState<{ id: string; codigo: string; total: number | null; deshecha: boolean } | null>(null);

  const cuarto = cuartos.find((c) => c.id === habitacionId) ?? null;
  const max = cuarto?.maxPersonas || 12;
  const apartaFinal = aparta ?? (fuente === 'whatsapp' || fuente === 'telefono' || fuente === 'web');
  const noches = Math.max(0, diasEntre(entrada, salida));

  useEffect(() => {
    if (personas > max) setPersonas(max);
  }, [max, personas]);

  // Búsqueda de huéspedes (espera a que deje de escribir)
  useEffect(() => {
    if (huesped || creando) return;
    let vivo = true;
    const id = window.setTimeout(() => {
      void ops.buscarHuespedes(q).then((r) => vivo && setResultados(r.ok ? r.valor : []));
    }, q ? 250 : 0);
    return () => {
      vivo = false;
      window.clearTimeout(id);
    };
  }, [q, huesped, creando, ops]);

  const ocupados = useMemo(() => {
    const s = new Set<string>();
    if (salida > entrada)
      reservas.forEach((r) => {
        if (r.entrada < salida && r.salida > entrada) s.add(r.habitacionId);
      });
    return s;
  }, [reservas, entrada, salida]);

  function cambiarEntrada(v: string) {
    setEntrada(v);
    if (v && salida <= v) setSalida(sumarDias(v, 1));
  }

  async function crear(e: { preventDefault(): void }) {
    e.preventDefault();
    const hayHuesped = !!huesped || (creando && nuevo.nombre.trim().length > 1);
    const falla = validarReserva({ entrada, salida, habitacionId: habitacionId || null, personas, maxPersonas: cuarto?.maxPersonas ?? 0, hayHuesped }, hoy);
    if (falla) return setError(falla);
    setError(null);
    setEnviando(true);
    const r = await ops.crear({
      habitacionId,
      entrada,
      salida,
      personas,
      mascota,
      fuente,
      estado: apartaFinal ? 'prereserva' : 'confirmada',
      notas,
      huespedId: huesped?.id ?? null,
      huespedNuevo: huesped ? null : nuevo,
    });
    setEnviando(false);
    if (!r.ok) return setError(r.mensaje);
    setHecha({ id: r.valor.id, codigo: r.valor.codigo, total: r.valor.total, deshecha: false });
  }

  async function deshacer() {
    if (!hecha) return;
    const c = await ops.cancelar(hecha.id, 'Creada por error');
    if (c.ok) setHecha({ ...hecha, deshecha: true });
    else toast.error(c.mensaje);
  }

  if (hecha)
    return (
      <Hoja titulo={hecha.deshecha ? 'Reserva deshecha' : 'Reserva creada'} onCerrar={onCerrar}>
        <div className="pila">
          <div className={`rv-listo ${hecha.deshecha ? 'is-deshecha' : ''}`}>
            <Icon name={hecha.deshecha ? 'deshacer' : 'check'} size="lg" />
            <div>
              <strong>
                Cuarto {cuarto?.numero} · {fechaCorta(entrada)} al {fechaCorta(salida)}
              </strong>
              <span>
                {huesped?.nombre ?? nuevo.nombre.trim()} · código {hecha.codigo}
              </span>
            </div>
          </div>
          {!hecha.deshecha && (
            <dl className="datos datos--cuenta">
              <div>
                <dt>Total ({noches} {noches === 1 ? 'noche' : 'noches'})</dt>
                <dd>{hecha.total == null ? 'Por definir' : dinero(hecha.total)}</dd>
              </div>
            </dl>
          )}
          {!hecha.deshecha && hecha.total == null && (
            <p className="rv-ayuda">Booking y Airbnb todavía no tienen tarifa cargada. El total se define cuando la dueña la cargue.</p>
          )}
          <div className="hoja__acciones">
            {!hecha.deshecha && (
              <Boton huge icono="dinero" onClick={() => onAbrir(hecha.id, true)}>
                Registrar anticipo
              </Boton>
            )}
            <Boton variante="quiet" onClick={onCerrar}>
              Listo
            </Boton>
            {!hecha.deshecha && (
              <Boton variante="ghost" icono="deshacer" onClick={() => void deshacer()}>
                Me equivoqué: deshacer la reserva
              </Boton>
            )}
          </div>
        </div>
      </Hoja>
    );

  return (
    <Hoja titulo="Nueva reserva" onCerrar={onCerrar}>
      <form className="pila rv-form" onSubmit={(e) => void crear(e)} noValidate>
        <div className="rv-par">
          <div className="campo">
            <label htmlFor="rv-ent">Entra</label>
            <input id="rv-ent" type="date" className="input" min={hoy} value={entrada} onChange={(e) => cambiarEntrada(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="rv-sal">Sale</label>
            <input id="rv-sal" type="date" className="input" min={sumarDias(entrada || hoy, 1)} value={salida} onChange={(e) => setSalida(e.target.value)} />
          </div>
        </div>
        {noches > 0 && (
          <p className="rv-ayuda">
            {noches} {noches === 1 ? 'noche' : 'noches'}: {fechaCorta(entrada)} al {fechaCorta(salida)}
          </p>
        )}

        <div className="campo">
          <label htmlFor="rv-cuarto">Cuarto</label>
          <select id="rv-cuarto" className="input" value={habitacionId} onChange={(e) => setHabitacionId(e.target.value)}>
            <option value="">Elige un cuarto…</option>
            {[...cuartos]
              .sort((a, b) => a.numero.localeCompare(b.numero, 'es', { numeric: true }))
              .map((c) => (
                <option key={c.id} value={c.id} disabled={ocupados.has(c.id)}>
                  {c.numero} · {c.tipo} (hasta {c.maxPersonas}){ocupados.has(c.id) ? ' · ocupado esas fechas' : ''}
                </option>
              ))}
          </select>
        </div>

        <div className="campo">
          <span className="campo__etiqueta" id="rv-pers">
            Personas
          </span>
          <div className="rv-fila-campos">
            <Pasos valor={personas} max={max} onCambio={setPersonas} etiqueta="Personas" />
            <label className={`opcion rv-mascota ${mascota ? 'is-on' : ''}`}>
              <input type="checkbox" checked={mascota} onChange={(e) => setMascota(e.target.checked)} />
              <span>Trae mascota</span>
              {mascota && <Icon name="check" size="sm" />}
            </label>
          </div>
          {cuarto && <p className="rv-ayuda">En el {cuarto.numero} caben hasta {cuarto.maxPersonas} personas.</p>}
        </div>

        <div className="campo">
          <span className="campo__etiqueta">Huésped</span>
          {huesped ? (
            <div className="rv-huesped-sel">
              <div>
                <strong>{huesped.nombre}</strong>
                <small>{[huesped.telefono, huesped.procedencia].filter(Boolean).join(' · ') || 'Sin más datos'}</small>
              </div>
              <Boton variante="ghost" onClick={() => setHuesped(null)}>
                Cambiar
              </Boton>
            </div>
          ) : creando ? (
            <div className="rv-nuevo">
              <div className="campo">
                <label htmlFor="rv-hn">Nombre completo</label>
                <input id="rv-hn" className="input" autoComplete="off" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
              </div>
              <div className="campo">
                <label htmlFor="rv-ht">Teléfono o WhatsApp</label>
                <input id="rv-ht" className="input" inputMode="tel" autoComplete="off" placeholder="099 123 4567" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} />
              </div>
              <div className="rv-par">
                <div className="campo">
                  <label htmlFor="rv-hd">Cédula o pasaporte</label>
                  <input id="rv-hd" className="input" autoComplete="off" value={nuevo.documento} onChange={(e) => setNuevo({ ...nuevo, documento: e.target.value })} />
                </div>
                <div className="campo">
                  <label htmlFor="rv-hp">De dónde viene</label>
                  <input id="rv-hp" className="input" autoComplete="off" placeholder="Quito, Cali…" value={nuevo.procedencia} onChange={(e) => setNuevo({ ...nuevo, procedencia: e.target.value })} />
                </div>
              </div>
              <Boton variante="ghost" onClick={() => setCreando(false)}>
                Buscar uno que ya existe
              </Boton>
            </div>
          ) : (
            <>
              <input
                type="search"
                className="input"
                placeholder="Busca por nombre o teléfono"
                aria-label="Buscar huésped por nombre o teléfono"
                autoComplete="off"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <ul className="rv-resultados">
                {resultados === null && <li className="rv-ayuda">Buscando…</li>}
                {resultados?.slice(0, q ? 6 : 3).map((h) => (
                  <li key={h.id}>
                    <button type="button" className="rv-resultado" onClick={() => setHuesped(h)}>
                      <strong>{h.nombre}</strong>
                      <small>{[h.telefono, h.procedencia].filter(Boolean).join(' · ') || 'Sin más datos'}</small>
                    </button>
                  </li>
                ))}
                {resultados?.length === 0 && <li className="rv-ayuda">No encontramos a nadie con eso.</li>}
              </ul>
              <Boton
                variante="quiet"
                icono="mas"
                onClick={() => {
                  setNuevo({ ...nuevoVacio, nombre: /\d/.test(q) ? '' : q, telefono: /\d/.test(q) ? q : '' });
                  setCreando(true);
                }}
              >
                Es un huésped nuevo
              </Boton>
            </>
          )}
        </div>

        <fieldset className="opciones rv-fuentes">
          <legend className="campo__etiqueta">¿Por dónde llegó la reserva?</legend>
          <div className="rv-fuentes__grid">
            {FUENTES.map((f) => (
              <label key={f.id} className={`opcion ${fuente === f.id ? 'is-on' : ''}`}>
                <input type="radio" name="fuente" checked={fuente === f.id} onChange={() => setFuente(f.id)} />
                <span>{f.texto}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="opciones">
          <legend className="campo__etiqueta">Cómo queda</legend>
          {(
            [
              [true, 'Apartar 2 horas', 'Se libera sola si no pagan el anticipo.'],
              [false, 'Ya está confirmada', 'Por ejemplo, viene de Booking o ya pagó.'],
            ] as const
          ).map(([v, t, s]) => (
            <label key={t} className={`opcion rv-opcion2 ${apartaFinal === v ? 'is-on' : ''}`}>
              <input type="radio" name="estado" checked={apartaFinal === v} onChange={() => setAparta(v)} />
              <span>
                {t}
                <small>{s}</small>
              </span>
              {apartaFinal === v && <Icon name="check" size="sm" />}
            </label>
          ))}
        </fieldset>

        <div className="campo">
          <label htmlFor="rv-notas">Notas (si hace falta)</label>
          <textarea id="rv-notas" className="input rv-notas" maxLength={300} placeholder="Ej.: llega tarde, pide cuna" value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>

        {error && (
          <p className="campo__error" role="alert">
            {error}
          </p>
        )}
        <div className="hoja__acciones">
          <Boton type="submit" huge icono="calendario" cargando={enviando}>
            Crear reserva
          </Boton>
        </div>
      </form>
    </Hoja>
  );
}

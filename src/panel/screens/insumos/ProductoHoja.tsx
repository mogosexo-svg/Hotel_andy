import { useEffect, useState } from 'react';
import { Boton, Skeleton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { listarMovimientos, urlFirmada, type InsumosApi, type Movimiento, type Prod } from '../../data/insumos';
import { ChipStock, HojaEstable, Quedan, Stepper } from './piezas';
import { dinero, hace, numero, unidadPlural } from '../../lib/format';

const TIPO_PALABRA: Record<Movimiento['tipo'], string> = {
  compra: 'Llegó',
  limpieza: 'Limpieza (antes)',
  venta: 'Se vendió',
  merma: 'Se perdió',
  conteo: 'Corregido',
  anulacion: 'Factura anulada',
  consumo_diario: 'Consumo del día (antes)',
  uso: 'Se usó',
};

type Modo = 'llego' | 'uso' | 'perdio' | 'contar';
const MODOS: Record<Modo, { titulo: string; pregunta: string; boton: string }> = {
  llego: { titulo: 'Llegó', pregunta: '¿Cuántos llegaron?', boton: 'Guardar lo que llegó' },
  uso: { titulo: 'Se usó', pregunta: '¿Cuántos se usaron?', boton: 'Guardar lo que se usó' },
  perdio: { titulo: 'Se perdió', pregunta: '¿Cuántos se perdieron? Roto, vencido o dañado', boton: 'Guardar lo que se perdió' },
  contar: { titulo: 'Corregir cantidad', pregunta: '¿Cuántos hay ahora, contados?', boton: 'Guardar la cantidad' },
};

interface Props {
  api: InsumosApi;
  producto: Prod;
  onEditar: () => void;
  onCerrar: () => void;
}

/** Un producto: cuánto queda y dos botones grandes, "Llegó" y "Se usó". Lo demás va abajo, más chico. */
export function ProductoHoja({ api, producto: p, onEditar, onCerrar }: Props) {
  const [modo, setModo] = useState<Modo | null>(null);
  const [cantidad, setCantidad] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mov, setMov] = useState<Movimiento[] | null | 'error'>(null);
  const [verMov, setVerMov] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);

  useEffect(() => {
    if (!verMov) return;
    let vivo = true;
    void listarMovimientos(p.id).then((m) => vivo && setMov(m ?? 'error'));
    return () => {
      vivo = false;
    };
  }, [p.id, p.stock, verMov]);
  useEffect(() => {
    if (p.foto) void urlFirmada(p.foto).then(setFoto);
  }, [p.foto]);

  function elegir(m: Modo) {
    setModo(m);
    setCantidad(m === 'contar' ? (p.stock ?? 0) : 1);
    setError(null);
  }

  async function guardar() {
    if (!modo) return;
    if (modo !== 'contar' && cantidad <= 0) return setError('Pon cuántos son: uno o más.');
    setError(null);
    setGuardando(true);
    let ok: boolean;
    if (modo === 'uso') {
      const r = await api.registrarSalidas([{ producto_id: p.id, cantidad }]);
      ok = r.ok;
      if (!r.ok) setError(r.mensaje);
    } else {
      ok = (await api.ajustar(p, modo === 'llego' ? 'compra' : modo === 'perdio' ? 'merma' : 'conteo', cantidad, null)) != null;
    }
    setGuardando(false);
    if (ok) setModo(null);
  }

  const unidad = (n: number) => unidadPlural(p.unidad, n);

  return (
    <HojaEstable titulo={p.nombre} onCerrar={onCerrar}>
      <div className="ins-detalle">
        {foto && <img className="ins-detalle__foto" src={foto} alt={`Foto de ${p.nombre}`} />}
        <div className="ins-stock">
          <Quedan stock={p.stock} unidad={p.unidad} />
          <div>
            <ChipStock nivel={p.nivel.nivel} />
          </div>
          <p className="ins-ayuda">
            {p.minimo != null ? `Avisamos cuando queden ${numero(p.minimo)} o menos.` : 'Sin mínimo: no avisamos.'}
            {p.seVende && p.venta != null && ` Se vende a ${dinero(p.venta)}.`}
          </p>
        </div>

        {!modo ? (
          <>
            <div className="ins-grandes">
              <Boton huge block icono="llega" onClick={() => elegir('llego')}>
                Llegó
              </Boton>
              <Boton huge block variante="quiet" icono="sale" onClick={() => elegir('uso')}>
                Se usó
              </Boton>
            </div>
            <div className="ins-enlaces">
              <Boton variante="ghost" onClick={() => elegir('perdio')}>
                Se perdió
              </Boton>
              <Boton variante="ghost" onClick={() => elegir('contar')}>
                Corregir cantidad
              </Boton>
              <Boton variante="ghost" onClick={onEditar}>
                Editar producto
              </Boton>
            </div>
          </>
        ) : (
          <form
            className="ins-form ins-paso"
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
          >
            <h3 className="ins-sub">{MODOS[modo].titulo}</h3>
            <div className="campo">
              <span className="campo__etiqueta">
                {MODOS[modo].pregunta} <span className="ins-ayuda">({unidad(2)})</span>
              </span>
              <Stepper grande valor={cantidad} onChange={setCantidad} etiqueta={p.nombre} />
            </div>
            {error && (
              <p className="campo__error" role="alert">
                {error}
              </p>
            )}
            <div className="ins-grandes">
              <Boton type="submit" huge block cargando={guardando}>
                {MODOS[modo].boton}
              </Boton>
              <Boton variante="ghost" block onClick={() => setModo(null)}>
                Atrás
              </Boton>
            </div>
          </form>
        )}

        <details className="ins-movs" onToggle={(e) => setVerMov(e.currentTarget.open)}>
          <summary>
            Ver movimientos
            <Icon name="siguiente" size="sm" />
          </summary>
          {mov === null ? (
            <div className="pila" aria-busy="true">
              <Skeleton h="3rem" />
              <Skeleton h="3rem" />
            </div>
          ) : mov === 'error' ? (
            <p className="ins-ayuda">No pudimos traer los movimientos. Cierra y vuelve a abrir.</p>
          ) : mov.length === 0 ? (
            <p className="ins-ayuda">Todavía no hay movimientos.</p>
          ) : (
            <ul className="ins-hist">
              {mov.map((m) => (
                <li key={m.id}>
                  <span className={`ins-hist__mas ${m.cantidad < 0 ? 'es-menos' : ''}`}>
                    <Icon name={m.cantidad < 0 ? 'sale' : 'llega'} size="sm" />
                    {m.tipo === 'conteo' ? `Quedó en ${numero(m.stock ?? 0)}` : `${m.cantidad > 0 ? '+' : '−'}${numero(Math.abs(m.cantidad))}`}
                  </span>
                  <span>
                    {TIPO_PALABRA[m.tipo]}
                    {m.nota ? ` · ${m.nota}` : ''}
                  </span>
                  <span className="ins-ayuda">{hace(m.cuando)}</span>
                </li>
              ))}
            </ul>
          )}
        </details>
      </div>
    </HojaEstable>
  );
}

import { useEffect, useState } from 'react';
import { Boton, BarraStock, Skeleton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { listarMovimientos, urlFirmada, type InsumosApi, type Movimiento, type Prod, type TipoAjuste } from '../../data/insumos';
import { HojaEstable, Campo, Opciones } from './piezas';
import { parseCantidad } from './logica';
import { dinero, hace, numero, unidadPlural } from '../../lib/format';

const AJUSTES: { id: TipoAjuste; texto: string; etiqueta: string; ayuda: string }[] = [
  { id: 'conteo', texto: 'Conté', etiqueta: 'Cuánto hay ahora', ayuda: 'Lo que contaste con tus manos. Reemplaza lo que decía el sistema.' },
  { id: 'merma', texto: 'Se perdió', etiqueta: 'Cuánto se perdió', ayuda: 'Roto, vencido o dañado. Se resta del stock.' },
  { id: 'compra', texto: 'Compré', etiqueta: 'Cuánto entró', ayuda: 'Compra suelta, sin factura. Se suma al stock.' },
];
const TIPO_PALABRA: Record<Movimiento['tipo'], string> = {
  compra: 'Compra',
  limpieza: 'Limpieza',
  venta: 'Venta',
  merma: 'Se perdió',
  conteo: 'Conteo',
  anulacion: 'Factura anulada',
  consumo_diario: 'Consumo del día',
};

interface Props {
  api: InsumosApi;
  producto: Prod;
  /** Abre la hoja con el modo "Contar" ya elegido. */
  contar?: boolean;
  puedeAjustar: boolean;
  onEditar: () => void;
  onVender: () => void;
  onCerrar: () => void;
}

/** Un producto: cuánto hay, ajuste de stock (RF-29) e historial de movimientos. */
export function ProductoHoja({ api, producto: p, contar, puedeAjustar, onEditar, onVender, onCerrar }: Props) {
  const [tipo, setTipo] = useState<TipoAjuste>('conteo');
  const [cantidad, setCantidad] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mov, setMov] = useState<Movimiento[] | null | 'error'>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [verAjuste, setVerAjuste] = useState(!!contar);
  const { nivel, pct, frase } = p.nivel;
  const alerta = api.alertas.find((a) => a.productoId === p.id);
  const ajuste = AJUSTES.find((a) => a.id === tipo) ?? AJUSTES[0];

  useEffect(() => {
    let vivo = true;
    void listarMovimientos(p.id).then((m) => vivo && setMov(m ?? 'error'));
    return () => {
      vivo = false;
    };
  }, [p.id, p.stock]);
  useEffect(() => {
    if (p.foto) void urlFirmada(p.foto).then(setFoto);
  }, [p.foto]);

  async function guardar() {
    const n = parseCantidad(cantidad);
    if (n == null) return setError('Escribe un número. Ejemplo: 12 o 0,5');
    if (tipo !== 'conteo' && n <= 0) return setError('La cantidad tiene que ser mayor que cero.');
    setError(null);
    setGuardando(true);
    const nuevo = await api.ajustar(p, tipo, n, nota.trim() || null);
    setGuardando(false);
    if (nuevo != null) {
      setCantidad('');
      setNota('');
      setVerAjuste(false);
    }
  }

  return (
    <HojaEstable titulo={p.nombre} onCerrar={onCerrar}>
      <div className="ins-detalle">
        {foto && <img className="ins-detalle__foto" src={foto} alt={`Foto de ${p.nombre}`} />}
        <div className="ins-stock">
          <p className="ins-stock__cifra">
            {p.stock == null ? <span className="ins-stock__nada">Sin contar</span> : <><span className="num">{numero(p.stock)}</span> <span className="ins-stock__u">{unidadPlural(p.unidad, p.stock)}</span></>}
          </p>
          <BarraStock nivel={nivel} pct={pct} />
          <p className={`insumo__frase n-${nivel}`}>{alerta && nivel !== 'sin_contar' ? alerta.mensaje : frase}</p>
          <p className="ins-ayuda">
            {p.minimo != null ? `Avisamos cuando queden ${numero(p.minimo)} o menos.` : 'Sin mínimo: no avisamos.'}
            {p.seVende && p.venta != null && ` Se vende a ${dinero(p.venta)}.`}
          </p>
        </div>

        {puedeAjustar && !verAjuste && (
          <div className="ins-acciones">
            <Boton block onClick={() => setVerAjuste(true)} icono="editar">
              {p.stock == null ? 'Contar ahora' : 'Contar o ajustar'}
            </Boton>
            {p.seVende && (
              <Boton variante="quiet" block onClick={onVender} icono="dinero">
                Vender
              </Boton>
            )}
            <Boton variante="quiet" block onClick={onEditar}>
              Editar producto
            </Boton>
          </div>
        )}

        {puedeAjustar && verAjuste && (
          <form
            className="ins-form ins-ajuste"
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
          >
            <Opciones nombre="Qué pasó" valor={tipo} opciones={AJUSTES} onChange={setTipo} />
            <Campo etiqueta={ajuste.etiqueta} ayuda={ajuste.ayuda} error={error}>
              {(id) => <input id={id} className="input" inputMode="decimal" autoFocus autoComplete="off" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder={`En ${p.unidad}. Ej.: 12 o 0,5`} />}
            </Campo>
            <Campo etiqueta="Nota (opcional)">{(id) => <input id={id} className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: Conteo del domingo" />}</Campo>
            <div className="ins-acciones ins-acciones--fila">
              <Boton variante="quiet" onClick={() => setVerAjuste(false)}>
                Cancelar
              </Boton>
              <Boton type="submit" cargando={guardando}>
                Guardar
              </Boton>
            </div>
          </form>
        )}

        <section aria-labelledby="ins-hist">
          <h3 id="ins-hist" className="ins-sub">
            Qué ha pasado con este producto
          </h3>
          {mov === null ? (
            <div className="pila" aria-busy="true">
              <Skeleton h="3rem" />
              <Skeleton h="3rem" />
            </div>
          ) : mov === 'error' ? (
            <p className="ins-ayuda">No pudimos traer el historial. Cierra y vuelve a abrir.</p>
          ) : mov.length === 0 ? (
            <p className="ins-ayuda">Todavía no hay movimientos. Cuenta el producto para empezar.</p>
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
        </section>
      </div>
    </HojaEstable>
  );
}

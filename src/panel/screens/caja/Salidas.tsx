import { useMemo, useState } from 'react';
import '../../styles/insumos.css';
import { useInsumos, type Medio } from '../../data/insumos';
import { dinero } from '../../lib/format';
import { Aviso, Boton, ErrorCarga, Hoja, Skeleton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';
import { coincide } from '../insumos/logica';
import { Stepper } from '../insumos/piezas';
import { armarSalidas, esVenta, totalVentas } from './logica';

/** Hoja "Lo que salió en este turno": qué se vendió y qué se usó, antes de cerrar la caja. */
export function Salidas({ onCerrar, onGuardado }: { onCerrar: () => void; onGuardado: () => void }) {
  const api = useInsumos();
  const toast = useToast();
  const [cant, setCant] = useState<Record<string, number>>({});
  const [medio, setMedio] = useState<Medio>('efectivo');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const activos = useMemo(() => (api.prods ?? []).filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [api.prods]);
  const vistos = activos.filter((p) => coincide(p.nombre, q));
  const vendidos = vistos.filter(esVenta);
  const usados = vistos.filter((p) => !esVenta(p));
  const items = armarSalidas(cant, activos, medio);
  const total = totalVentas(cant, activos);
  const hayVenta = activos.some((p) => esVenta(p) && (cant[p.id] ?? 0) > 0);

  async function guardar() {
    if (items.length === 0) return setError('Sube la cantidad de algo para guardar.');
    setError('');
    setGuardando(true);
    const r = await api.registrarSalidas(items);
    setGuardando(false);
    if (!r.ok) return setError(r.mensaje);
    const n = `${items.length} ${items.length === 1 ? 'salida' : 'salidas'}`;
    toast.avisar(r.ventas > 0 ? `Anotaste ${n} · ventas ${dinero(r.ventas)}` : `Anotaste ${n}`);
    onGuardado();
    onCerrar();
  }

  const fila = (p: (typeof activos)[number]) => (
    <li key={p.id} className="sal-fila">
      <span className="sal-fila__txt">
        <strong>{p.nombre}</strong>
        <span className="ins-ayuda">{esVenta(p) ? dinero(p.venta) : p.stock == null ? 'Sin contar' : `Quedan ${p.stock}`}</span>
      </span>
      <Stepper valor={cant[p.id] ?? 0} onChange={(n) => setCant((c) => ({ ...c, [p.id]: n }))} etiqueta={p.nombre} />
    </li>
  );

  return (
    <Hoja titulo="Lo que salió en este turno" onCerrar={onCerrar}>
      <form
        className="ins-form sal"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        {api.error ? (
          <ErrorCarga onReintentar={() => void api.recargar()} />
        ) : api.prods === null ? (
          <div className="pila" aria-busy="true" aria-label="Cargando productos">
            <Skeleton h="4.5rem" r="14px" />
            <Skeleton h="4.5rem" r="14px" />
            <Skeleton h="4.5rem" r="14px" />
          </div>
        ) : activos.length === 0 ? (
          <Aviso icono="inventario" titulo="Todavía no hay productos" texto="Créalos en Insumos y vuelve aquí." />
        ) : (
          <>
            <div className="ins-buscar">
              <Icon name="buscar" />
              <input type="search" className="input" aria-label="Buscar un producto" placeholder="Buscar un producto" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>

            {vendidos.length > 0 && (
              <section className="sal-sec" aria-labelledby="sal-vendio">
                <h3 id="sal-vendio" className="ins-sub">
                  Se vendió
                </h3>
                <div className="campo">
                  <span className="campo__etiqueta">¿Cómo pagaron?</span>
                  <div className="ins-opciones ins-opciones--2" role="radiogroup" aria-label="Cómo pagaron">
                    {(['efectivo', 'transferencia'] as const).map((m) => (
                      <button key={m} type="button" role="radio" aria-checked={medio === m} className="ins-opcion" onClick={() => setMedio(m)}>
                        {m === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                      </button>
                    ))}
                  </div>
                </div>
                <ul className="sal-lista">{vendidos.map(fila)}</ul>
              </section>
            )}

            {usados.length > 0 && (
              <section className="sal-sec" aria-labelledby="sal-uso">
                <h3 id="sal-uso" className="ins-sub">
                  Se usó
                </h3>
                <ul className="sal-lista">{usados.map(fila)}</ul>
              </section>
            )}

            {vistos.length === 0 && <p className="ins-ayuda">No hay productos con ese nombre.</p>}
          </>
        )}

        <div className="sal-pie">
          {error && (
            <p className="campo__error" role="alert">
              {error}
            </p>
          )}
          {hayVenta && (
            <p className="sal-total" aria-live="polite">
              <span>Total vendido</span>
              <strong>{dinero(total)}</strong>
            </p>
          )}
          <Boton type="submit" huge block cargando={guardando} disabled={items.length === 0}>
            Guardar
          </Boton>
        </div>
      </form>
    </Hoja>
  );
}

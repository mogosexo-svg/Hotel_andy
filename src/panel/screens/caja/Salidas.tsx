import { useMemo, useState } from 'react';
import '../../styles/insumos.css';
import { useInsumos, type Medio } from '../../data/insumos';
import { dinero, unidadPlural } from '../../lib/format';
import { Aviso, Boton, ErrorCarga, Hoja, Skeleton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';
import { coincide } from '../insumos/logica';
import { Stepper } from '../insumos/piezas';
import { armarConteo, armarSalidas, esVenta, totalVentas } from './logica';

/**
 * Hoja "Lo que salió en este turno": qué se vendió y el inventario (cuántos quedan), antes de cerrar la caja.
 * Con modo "inventario" (desde Insumos) solo muestra el conteo.
 */
export function Salidas({ onCerrar, onGuardado, modo = 'turno' }: { onCerrar: () => void; onGuardado: () => void; modo?: 'turno' | 'inventario' }) {
  const api = useInsumos();
  const toast = useToast();
  const [cant, setCant] = useState<Record<string, number>>({});
  const [contado, setContado] = useState<Record<string, number>>({});
  const [medio, setMedio] = useState<Medio>('efectivo');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const activos = useMemo(() => (api.prods ?? []).filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [api.prods]);
  const vistos = activos.filter((p) => coincide(p.nombre, q));
  const vendidos = modo === 'turno' ? vistos.filter(esVenta) : [];
  const usados = modo === 'turno' ? vistos.filter((p) => !esVenta(p)) : vistos;
  const items = modo === 'turno' ? armarSalidas(cant, activos, medio) : [];
  const conteos = armarConteo(contado, modo === 'turno' ? activos.filter((p) => !esVenta(p)) : activos);
  const total = totalVentas(cant, activos);
  const hayVenta = activos.some((p) => esVenta(p) && (cant[p.id] ?? 0) > 0);

  async function guardar() {
    if (items.length === 0 && conteos.length === 0) return setError('Anota una venta o cuenta algún producto para guardar.');
    setError('');
    setGuardando(true);
    let ventas = 0;
    if (items.length > 0) {
      const r = await api.registrarSalidas(items);
      if (!r.ok) {
        setGuardando(false);
        return setError(r.mensaje);
      }
      ventas = r.ventas;
    }
    if (conteos.length > 0) {
      const r = await api.contar(conteos);
      if (!r.ok) {
        setGuardando(false);
        return setError(r.mensaje);
      }
    }
    setGuardando(false);
    const partes = [ventas > 0 && `ventas ${dinero(ventas)}`, conteos.length > 0 && `contaste ${conteos.length} ${conteos.length === 1 ? 'producto' : 'productos'}`].filter(Boolean);
    toast.avisar(`Listo: ${partes.join(' · ') || 'guardado'}`);
    onGuardado();
    onCerrar();
  }

  const fila = (p: (typeof activos)[number]) => (
    <li key={p.id} className="sal-fila">
      <span className="sal-fila__txt">
        <strong>{p.nombre}</strong>
        <span className="ins-ayuda">{dinero(p.venta)}</span>
      </span>
      <Stepper valor={cant[p.id] ?? 0} onChange={(n) => setCant((c) => ({ ...c, [p.id]: n }))} etiqueta={`Vendidos de ${p.nombre}`} />
    </li>
  );
  // Inventario: arranca en lo que el sistema cree que hay; se guarda solo si cambia.
  const filaConteo = (p: (typeof activos)[number]) => {
    const cambio = contado[p.id] != null && contado[p.id] !== p.stock;
    return (
      <li key={p.id} className="sal-fila">
        <span className="sal-fila__txt">
          <strong>{p.nombre}</strong>
          <span className="ins-ayuda">{cambio ? `Antes: ${p.stock ?? 'sin contar'}` : p.stock == null ? 'Sin contar' : `Había ${p.stock} ${unidadPlural(p.unidad, p.stock)}`}</span>
        </span>
        <Stepper valor={contado[p.id] ?? p.stock ?? 0} onChange={(n) => setContado((c) => ({ ...c, [p.id]: n }))} etiqueta={`Cuántos quedan de ${p.nombre}`} />
      </li>
    );
  };

  return (
    <Hoja titulo={modo === 'turno' ? 'Lo que salió en este turno' : 'Hacer inventario'} onCerrar={onCerrar}>
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
                  Inventario: ¿cuántos quedan?
                </h3>
                <p className="ins-ayuda">Cuenta lo que hay y ajusta el número. Lo que no toques queda igual.</p>
                <ul className="sal-lista">{usados.map(filaConteo)}</ul>
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
          <Boton type="submit" huge block cargando={guardando} disabled={items.length === 0 && conteos.length === 0}>
            Guardar
          </Boton>
        </div>
      </form>
    </Hoja>
  );
}

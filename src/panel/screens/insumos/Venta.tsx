import { useMemo, useState } from 'react';
import { Boton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';
import { useCuartos } from '../../data/cuartos';
import type { InsumosApi, Medio, Prod } from '../../data/insumos';
import { BuscadorProducto, Campo, HojaEstable } from './piezas';
import { coincide, parseCantidad, parseDinero } from './logica';
import { dinero, numero } from '../../lib/format';

/** RF-62: producto + cantidad → al cuarto o pagado ya. Dos toques cuando la cantidad es 1. */
export function Venta({ api, inicial, onCerrar }: { api: InsumosApi; inicial?: string | null; onCerrar: () => void }) {
  const toast = useToast();
  const { cuartos, enCurso, llegaHoy } = useCuartos();
  const lista = api.prods ?? [];
  const [productoId, setProductoId] = useState<string | null>(inicial ?? null);
  const [cantidad, setCantidad] = useState('1');
  const [alCuarto, setAlCuarto] = useState(false);
  const [precio, setPrecio] = useState('');
  const [guardandoPrecio, setGuardandoPrecio] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const p: Prod | undefined = lista.find((x) => x.id === productoId);
  const n = parseCantidad(cantidad);
  const sinPrecio = !!p && (!p.venta || p.venta <= 0);

  const reservas = useMemo(() => {
    const num = new Map(cuartos.map((c) => [c.id, c.numero]));
    return [...enCurso.values(), ...llegaHoy.values()]
      .filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i)
      .map((r) => ({ id: r.id, cuarto: num.get(r.habitacionId) ?? '?', huesped: r.huesped }))
      .sort((a, b) => a.cuarto.localeCompare(b.cuarto, 'es', { numeric: true }));
  }, [cuartos, enCurso, llegaHoy]);

  const reservasFiltradas = reservas.filter((r) => r.cuarto.startsWith(filtro.trim()) || coincide(r.huesped ?? '', filtro));

  async function vender(destino: { reserva: string } | { medio: Medio }, cuando: string) {
    if (!p) return setError('Elige qué se vendió.');
    if (n == null || n <= 0) return setError('Escribe cuántos. Ejemplo: 2');
    setError(null);
    setTrabajando(true);
    const r = await api.registrarConsumo(p.id, n, destino);
    setTrabajando(false);
    if ('error' in r) return setError(r.error);
    toast.avisar(`${numero(n)} ${p.nombre} · ${dinero(Math.round(n * (p.venta ?? 0)))} · ${cuando}`, {
      deshacer: () => void api.anularConsumo(r.id),
    });
    onCerrar();
  }

  async function guardarPrecio() {
    const c = parseDinero(precio);
    if (!p || c == null || c <= 0) return setError('El precio debe verse así: 2,50');
    setError(null);
    setGuardandoPrecio(true);
    await api.guardarProducto(p.id, { venta: c, seVende: true });
    setGuardandoPrecio(false);
    setPrecio('');
  }

  return (
    <HojaEstable titulo="Registrar una venta" onCerrar={onCerrar}>
      <div className="ins-form">
        <div className="campo">
          <span className="campo__etiqueta">¿Qué se vendió?</span>
          <BuscadorProducto prods={lista} valor={productoId} soloVenta etiqueta="Producto vendido" autoFocus={!inicial} onElegir={(x) => setProductoId(x.id)} onLimpiar={() => setProductoId(null)} />
        </div>

        {p && sinPrecio && (
          <div className="ins-alerta" role="alert">
            <p>
              <strong>“{p.nombre}” no tiene precio de venta.</strong> Ponle uno para poder venderlo.
            </p>
            <div className="ins-precio">
              <Campo etiqueta="Precio de venta ($)">
                {(id) => <input id={id} className="input" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="2,50" />}
              </Campo>
              <Boton cargando={guardandoPrecio} onClick={() => void guardarPrecio()}>
                Guardar precio
              </Boton>
            </div>
          </div>
        )}

        {p && !sinPrecio && (
          <>
            <Campo etiqueta="¿Cuántos?" ayuda={n != null && n > 0 ? `Total: ${dinero(Math.round(n * (p.venta ?? 0)))} (${dinero(p.venta)} cada uno)` : undefined}>
              {(id) => (
                <div className="ins-cantidad">
                  <button type="button" className="icono-btn ins-cantidad__btn" aria-label="Uno menos" onClick={() => setCantidad(String(Math.max(1, Math.floor(n ?? 1) - 1)))}>
                    −
                  </button>
                  <input id={id} className="input" inputMode="decimal" autoComplete="off" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
                  <button type="button" className="icono-btn ins-cantidad__btn" aria-label="Uno más" onClick={() => setCantidad(String(Math.floor(n ?? 0) + 1))}>
                    +
                  </button>
                </div>
              )}
            </Campo>

            {alCuarto ? (
              <div className="campo">
                <span className="campo__etiqueta">¿A qué cuarto?</span>
                {reservas.length === 0 ? (
                  <p className="ins-ayuda">Ahora no hay huéspedes con reserva en curso o confirmada para cargarles la cuenta.</p>
                ) : (
                  <>
                    {reservas.length > 5 && (
                      <input
                        className="input"
                        type="search"
                        enterKeyHint="search"
                        autoComplete="off"
                        aria-label="Buscar por número de cuarto o nombre"
                        placeholder="Número de cuarto o nombre"
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                      />
                    )}
                  <ul className="ins-reservas">
                    {reservasFiltradas.map((r) => (
                      <li key={r.id}>
                        <button type="button" className="ins-reserva" disabled={trabajando} onClick={() => void vender({ reserva: r.id }, `al cuarto ${r.cuarto}`)}>
                          <strong>Cuarto {r.cuarto}</strong>
                          <span className="ins-ayuda">{r.huesped ?? 'Sin nombre'}</span>
                          <Icon name="siguiente" size="sm" />
                        </button>
                      </li>
                    ))}
                    {reservasFiltradas.length === 0 && <li className="ins-ayuda">No hay un cuarto o huésped con eso.</li>}
                  </ul>
                  </>
                )}
                <Boton variante="ghost" onClick={() => setAlCuarto(false)}>
                  Mejor otra forma de pago
                </Boton>
              </div>
            ) : (
              <div className="campo">
                <span className="campo__etiqueta">¿Cómo se paga?</span>
                <div className="ins-pagos">
                  <button type="button" className="ins-pago" disabled={trabajando} onClick={() => void vender({ medio: 'efectivo' }, 'en efectivo')}>
                    <Icon name="dinero" /> Pagó en efectivo
                  </button>
                  <button type="button" className="ins-pago" disabled={trabajando} onClick={() => void vender({ medio: 'transferencia' }, 'por transferencia')}>
                    <Icon name="dinero" /> Pagó por transferencia
                  </button>
                  <button type="button" className="ins-pago ins-pago--cuarto" disabled={trabajando} onClick={() => setAlCuarto(true)}>
                    <Icon name="cama" /> Cargar al cuarto
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {error && (
          <p className="campo__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </HojaEstable>
  );
}

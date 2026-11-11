import { useEffect, useMemo, useRef, useState } from 'react';
import { Boton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import type { InsumosApi, Prod } from '../../data/insumos';
import { BuscadorProducto, Campo } from './piezas';
import { ProductoForm } from './ProductoForm';
import { centavosATexto, subtotalLinea, totalFactura, validarFactura, type LineaBorrador } from './logica';
import { dinero, hoyEC } from '../../lib/format';

let seq = 0;
interface Linea extends LineaBorrador {
  k: number;
}
const vacia = (productoId: string | null = null, costo = ''): Linea => ({ k: ++seq, productoId, cantidad: '', costo });

interface Props {
  api: InsumosApi;
  proveedores: string[];
  /** Producto con el que arrancar (viene de "Cargar compra" en "Se está acabando"). */
  inicial?: string | null;
  onListo: () => void;
  onCancelar: () => void;
}

/** RF-29a: una factura entera en una pantalla. Pensada para el celular: teclado numérico y línea nueva rápida. */
export function CargarFactura({ api, proveedores, inicial, onListo, onCancelar }: Props) {
  const { prods } = api;
  const lista = prods ?? [];
  const [proveedor, setProveedor] = useState('');
  const [numeroF, setNumeroF] = useState('');
  const [fecha, setFecha] = useState(hoyEC());
  const [foto, setFoto] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [lineas, setLineas] = useState<Linea[]>(() => {
    const p = inicial ? lista.find((x) => x.id === inicial) : null;
    return [p ? vacia(p.id, centavosATexto(p.compra)) : vacia()];
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [crear, setCrear] = useState<{ k: number; nombre: string } | null>(null);
  const raiz = useRef<HTMLElement>(null);
  const foco = useRef<number | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    if (!foto) return setVista(null);
    const u = URL.createObjectURL(foto);
    setVista(u);
    return () => URL.revokeObjectURL(u);
  }, [foto]);

  // Tras elegir un producto o añadir una línea, el cursor salta a la cantidad.
  useEffect(() => {
    if (foco.current == null) return;
    raiz.current?.querySelector<HTMLInputElement>(`[data-k="${foco.current}"] input[data-cantidad]`)?.focus();
    foco.current = null;
  }, [lineas]);

  const total = useMemo(() => totalFactura(lineas), [lineas]);
  const usados = useMemo(() => new Set(lineas.flatMap((l) => (l.productoId ? [l.productoId] : []))), [lineas]);
  const cambiar = (k: number, d: Partial<Linea>) => setLineas((ls) => ls.map((l) => (l.k === k ? { ...l, ...d } : l)));
  const elegir = (k: number, p: Prod) => {
    foco.current = k;
    cambiar(k, { productoId: p.id, costo: centavosATexto(p.compra) });
  };

  async function guardar() {
    const v = validarFactura({ proveedor, numero: numeroF, fecha, lineas });
    if ('error' in v) return setError(v.error);
    setError(null);
    setGuardando(true);
    const ok = await api.cargarFactura({ proveedor, numero: numeroF, fecha, lineas: v.lineas, foto });
    setGuardando(false);
    if (ok) onListo();
  }

  return (
    <section className="pantalla ins-factura" ref={raiz}>
      <header className="ins-vuelta">
        <button type="button" className="icono-btn icono-btn--texto" onClick={onCancelar}>
          <Icon name="atras" size="sm" />
          <span>Insumos</span>
        </button>
      </header>
      <div className="pantalla__cab">
        <h1>Cargar compra</h1>
        <p className="pantalla__sub">Pon lo que dice la factura. El stock sube solo.</p>
      </div>

      <form
        className="ins-form"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <div className="ins-cabecera-factura">
          <Campo etiqueta="Proveedor">
            {(id) => (
              <>
                <input id={id} className="input" list="ins-proveedores" autoComplete="off" value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Ej.: Distribuidora Atacames" />
                <datalist id="ins-proveedores">
                  {proveedores.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </>
            )}
          </Campo>
          <Campo etiqueta="N.º de factura">{(id) => <input id={id} className="input" autoComplete="off" value={numeroF} onChange={(e) => setNumeroF(e.target.value)} placeholder="001-001-000123" />}</Campo>
          <Campo etiqueta="Fecha">{(id) => <input id={id} className="input" type="date" max={hoyEC()} value={fecha} onChange={(e) => setFecha(e.target.value)} />}</Campo>
          <div className="campo">
            <span className="campo__etiqueta">Foto de la factura</span>
            <label className="ins-foto">
              {vista ? <img src={vista} alt="Foto de la factura" /> : <Icon name="foto" />}
              <span>{vista ? 'Cambiar la foto' : 'Tomar una foto'}</span>
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>

        <h2 className="ins-sub">Productos de la factura</h2>
        <ol className="ins-lineas">
          {lineas.map((l, i) => {
            const p = lista.find((x) => x.id === l.productoId);
            const esUltima = i === lineas.length - 1;
            return (
              <li key={l.k} className="ins-linea" data-k={l.k}>
                <div className="ins-linea__cab">
                  <span className="ins-linea__n">{i + 1}</span>
                  <div className="ins-linea__prod">
                    <BuscadorProducto
                      prods={lista}
                      valor={l.productoId}
                      excluir={usados}
                      etiqueta={`Producto de la línea ${i + 1}`}
                      autoFocus={esUltima && !l.productoId && i > 0}
                      onElegir={(x) => elegir(l.k, x)}
                      onLimpiar={() => cambiar(l.k, { productoId: null })}
                      onCrear={(nombre) => setCrear({ k: l.k, nombre })}
                    />
                  </div>
                  {lineas.length > 1 && (
                    <button type="button" className="icono-btn" aria-label={`Quitar la línea ${i + 1}`} onClick={() => setLineas((ls) => ls.filter((x) => x.k !== l.k))}>
                      <Icon name="cerrar" />
                    </button>
                  )}
                </div>
                {l.productoId && (
                  <div className="ins-linea__nums">
                    <Campo etiqueta={`Cantidad${p ? ` (${p.unidad})` : ''}`}>
                      {(id) => <input id={id} data-cantidad className="input" inputMode="decimal" autoComplete="off" value={l.cantidad} onChange={(e) => cambiar(l.k, { cantidad: e.target.value })} placeholder="0" />}
                    </Campo>
                    <Campo etiqueta="Cada uno ($)">
                      {(id) => <input id={id} className="input" inputMode="decimal" autoComplete="off" value={l.costo} onChange={(e) => cambiar(l.k, { costo: e.target.value })} placeholder="0,00" />}
                    </Campo>
                    <p className="ins-linea__sub" aria-label="Subtotal de la línea">
                      {dinero(subtotalLinea(l))}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <Boton
          variante="quiet"
          block
          icono="mas"
          onClick={() => {
            setLineas((ls) => [...ls, vacia()]);
          }}
        >
          Añadir otro producto
        </Boton>

        <div className="ins-total" role="group" aria-label="Total de la factura">
          <div>
            <p className="ins-total__t">Total de la factura</p>
            <p className="ins-total__n" aria-live="polite">
              {dinero(total)}
            </p>
          </div>
          <Boton type="submit" cargando={guardando}>
            Guardar factura
          </Boton>
          {error && (
            <p className="campo__error ins-total__error" role="alert">
              {error}
            </p>
          )}
        </div>
      </form>

      {crear && (
        <ProductoForm
          api={api}
          nombreInicial={crear.nombre}
          onListo={(p) => {
            if (p) elegir(crear.k, p);
            setCrear(null);
          }}
          onCerrar={() => setCrear(null)}
        />
      )}
    </section>
  );
}

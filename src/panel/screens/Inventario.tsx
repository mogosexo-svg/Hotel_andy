import { useEffect, useMemo, useState } from 'react';
import '../styles/insumos.css';
import { tomarAccionInsumos, useInsumos, type Prod } from '../data/insumos';
import { esBajo } from '../lib/stock';
import { Aviso, Boton, ErrorCarga, Skeleton } from '../ui/kit';
import { Icon, IconoCat } from '../ui/Icon';
import { coincide } from './insumos/logica';
import { Categorias } from './insumos/Categorias';
import { CargarFactura } from './insumos/CargarFactura';
import { Facturas } from './insumos/Facturas';
import { ChipStock, Quedan } from './insumos/piezas';
import { ProductoForm } from './insumos/ProductoForm';
import { ProductoHoja } from './insumos/ProductoHoja';
import { Venta } from './insumos/Venta';
import { Salidas } from './caja/Salidas';

type Filtro = 'todo' | 'bajos' | 'inactivos' | string;
type Pestana = 'insumos' | 'compras';

export function Inventario() {
  const api = useInsumos();
  const { prods, cats } = api;
  const [pestana, setPestana] = useState<Pestana>('insumos');
  const [filtro, setFiltro] = useState<Filtro>('todo');
  const [q, setQ] = useState('');
  const [factura, setFactura] = useState<{ inicial: string | null } | null>(null);
  const [proveedores, setProveedores] = useState<string[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [form, setForm] = useState<{ producto?: Prod } | null>(null);
  const [verCats, setVerCats] = useState(false);
  const [venta, setVenta] = useState<{ inicial: string | null } | null>(null);
  const [inventario, setInventario] = useState(false);

  // Atajos desde Ctrl+K: "Registrar una venta" abre esta pantalla y la hoja correspondiente.
  useEffect(() => {
    const tomar = () => {
      const a = tomarAccionInsumos();
      if (a === 'venta') setVenta({ inicial: null });
      else if (a === 'compra') setFactura({ inicial: null });
      else if (a === 'producto') setForm({});
    };
    tomar();
    window.addEventListener('insumos:accion', tomar);
    return () => window.removeEventListener('insumos:accion', tomar);
  }, []);

  const activos = useMemo(() => (prods ?? []).filter((p) => p.activo), [prods]);
  const inactivos = useMemo(() => (prods ?? []).filter((p) => !p.activo), [prods]);
  const bajos = useMemo(() => activos.filter((p) => esBajo(p.nivel.nivel)), [activos]);
  const bajosPorCat = useMemo(() => {
    const m = new Map<string, number>();
    bajos.forEach((p) => m.set(p.categoriaId, (m.get(p.categoriaId) ?? 0) + 1));
    return m;
  }, [bajos]);

  const orden = (a: Prod, b: Prod) => Number(esBajo(b.nivel.nivel)) - Number(esBajo(a.nivel.nivel)) || a.nombre.localeCompare(b.nombre, 'es');
  const buscando = q.trim() !== '';
  const grupos = useMemo(() => {
    const base = filtro === 'inactivos' ? inactivos : activos;
    const lista = base.filter((p) => coincide(p.nombre, q) && (filtro === 'bajos' ? esBajo(p.nivel.nivel) : true));
    return cats
      .filter((c) => filtro === 'todo' || filtro === 'bajos' || filtro === 'inactivos' || filtro === c.id)
      .map((c) => ({ cat: c, items: lista.filter((p) => p.categoriaId === c.id).sort(orden) }))
      .filter((g) => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activos, inactivos, cats, filtro, q]);

  const abrirProd = prods?.find((p) => p.id === abierto);
  const sinContar = activos.filter((p) => p.nivel.nivel === 'sin_contar').length;

  if (factura)
    return (
      <CargarFactura
        api={api}
        proveedores={proveedores}
        inicial={factura.inicial}
        onCancelar={() => setFactura(null)}
        onListo={() => {
          setFactura(null);
          setPestana('compras');
        }}
      />
    );

  const fila = (p: Prod) => <Fila key={p.id} p={p} onAbrir={() => setAbierto(p.id)} onReactivar={() => void api.activar(p, true)} />;

  return (
    <section className="pantalla">
      <header className="pantalla__cab">
        <div>
          <h1>Insumos</h1>
          <p className="pantalla__sub">
            {prods === null
              ? 'Contando…'
              : bajos.length
                ? `${bajos.length} ${bajos.length === 1 ? 'se está acabando' : 'se están acabando'}`
                : sinContar
                  ? `Nada se está acabando · ${sinContar} sin contar`
                  : 'Nada se está acabando'}
          </p>
        </div>
      </header>

      <div className="ins-acciones-cab">
        <Boton icono="dinero" onClick={() => setVenta({ inicial: null })}>
          Vender
        </Boton>
        <Boton variante="quiet" icono="inventario" onClick={() => setInventario(true)}>
          Hacer inventario
        </Boton>
        <Boton variante="quiet" icono="mas" onClick={() => setForm({})}>
          Nuevo producto
        </Boton>
      </div>

      <div className="ins-tabs" role="tablist" aria-label="Qué quieres ver">
        {(
          [
            ['insumos', 'Inventario'],
            ['compras', 'Compras'],
          ] as [Pestana, string][]
        ).map(([id, texto]) => (
          <button key={id} type="button" role="tab" aria-selected={pestana === id} className="ins-tab" onClick={() => setPestana(id)}>
            {texto}
          </button>
        ))}
      </div>

      {pestana === 'compras' && (
        <>
          <Boton icono="factura" onClick={() => setFactura({ inicial: null })}>
            Cargar compra
          </Boton>
          <Facturas api={api} onNueva={() => setFactura({ inicial: null })} onProveedores={setProveedores} />
        </>
      )}

      {pestana === 'insumos' &&
        (api.error ? (
          <ErrorCarga onReintentar={() => void api.recargar()} />
        ) : prods === null ? (
          <div className="pila" aria-busy="true" aria-label="Cargando insumos">
            <Skeleton h="3rem" r="14px" />
            <Skeleton h="3rem" w="70%" r="999px" />
            <Skeleton h="5.5rem" r="14px" />
            <Skeleton h="5.5rem" r="14px" />
            <Skeleton h="5.5rem" r="14px" />
          </div>
        ) : prods.length === 0 ? (
          <Aviso icono="inventario" titulo="Todavía no hay productos" texto="Crea el primero, o carga una compra desde la factura y créalos ahí mismo." accion={{ texto: 'Nuevo producto', onClick: () => setForm({}), icono: 'mas' }} />
        ) : (
          <>
            <div className="ins-buscar">
              <Icon name="buscar" />
              <input type="search" className="input" aria-label="Buscar un producto" placeholder="Buscar un producto" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="filtros filtros--scroll" role="group" aria-label="Filtrar por categoría">
              <button type="button" className="filtro" aria-pressed={filtro === 'todo'} onClick={() => setFiltro('todo')}>
                Todo
              </button>
              {bajos.length > 0 && (
                <button type="button" className="filtro" aria-pressed={filtro === 'bajos'} onClick={() => setFiltro('bajos')}>
                  <Icon name="alerta" size="sm" /> Se está acabando
                  <span className="filtro__n filtro__n--alerta">{bajos.length}</span>
                </button>
              )}
              {cats.map((c) => (
                <button key={c.id} type="button" className="filtro" aria-pressed={filtro === c.id} onClick={() => setFiltro(c.id)}>
                  {c.nombre}
                  {!!bajosPorCat.get(c.id) && <span className="filtro__n filtro__n--alerta">{bajosPorCat.get(c.id)}</span>}
                </button>
              ))}
              <button type="button" className="filtro filtro--accion" onClick={() => setVerCats(true)}>
                <Icon name="editar" size="sm" /> Categorías
              </button>
              {inactivos.length > 0 && (
                <button type="button" className="filtro" aria-pressed={filtro === 'inactivos'} onClick={() => setFiltro('inactivos')}>
                  Apagados <span className="filtro__n">{inactivos.length}</span>
                </button>
              )}
            </div>

            {grupos.length === 0 ? (
              <Aviso
                icono="buscar"
                titulo={buscando ? `No encontramos “${q.trim()}”` : 'No hay productos aquí'}
                texto={buscando ? 'Revisa cómo está escrito, o crea el producto.' : undefined}
                accion={buscando ? { texto: 'Crear este producto', onClick: () => setForm({ producto: undefined }), icono: 'mas' } : undefined}
              />
            ) : (
              grupos.map(({ cat, items }) => {
                const n = bajosPorCat.get(cat.id) ?? 0;
                const sc = items.filter((p) => p.nivel.nivel === 'sin_contar').length;
                return (
                  <div className="grupo" key={cat.id}>
                    <h2 className="grupo__titulo">
                      <span className="grupo__ico" aria-hidden="true">
                        <IconoCat clave={cat.icono} size="sm" />
                      </span>
                      {cat.nombre}
                      {filtro !== 'inactivos' && (
                        <span className={`grupo__estado ${n ? 'is-alerta' : ''}`}>{n ? `${n} por comprar` : sc ? `${sc} sin contar` : 'Todo bien'}</span>
                      )}
                    </h2>
                    <ul className="insumos">{items.map((p) => fila(p))}</ul>
                  </div>
                );
              })
            )}
          </>
        ))}

      {abrirProd && (
        <ProductoHoja
          api={api}
          producto={abrirProd}
          onCerrar={() => setAbierto(null)}
          onEditar={() => {
            setAbierto(null);
            setForm({ producto: abrirProd });
          }}
        />
      )}
      {form && (
        <ProductoForm
          key={form.producto?.id ?? 'nuevo'}
          api={api}
          producto={form.producto}
          nombreInicial={form.producto ? undefined : q.trim() || undefined}
          categoriaInicial={cats.some((c) => c.id === filtro) ? filtro : undefined}
          onListo={() => setForm(null)}
          onCerrar={() => setForm(null)}
        />
      )}
      {verCats && <Categorias api={api} onCerrar={() => setVerCats(false)} />}
      {venta && <Venta api={api} inicial={venta.inicial} onCerrar={() => setVenta(null)} />}
      {inventario && <Salidas modo="inventario" onCerrar={() => setInventario(false)} onGuardado={() => void api.recargar()} />}
    </section>
  );
}

function Fila({ p, onAbrir, onReactivar }: { p: Prod; onAbrir: () => void; onReactivar: () => void }) {
  const { nivel } = p.nivel;
  return (
    <li className={`insumo ${!p.activo ? 'insumo--apagado' : ''}`}>
      <button type="button" className="insumo__abrir" onClick={onAbrir} aria-label={`${p.nombre}: ${p.nivel.frase}. Abrir`}>
        <span className="insumo__nombre">{p.nombre}</span>
        <Quedan stock={p.stock} unidad={p.unidad} />
        <ChipStock nivel={nivel} />
      </button>
      {!p.activo && (
        <Boton variante="quiet" onClick={onReactivar}>
          Volver a la lista
        </Boton>
      )}
    </li>
  );
}

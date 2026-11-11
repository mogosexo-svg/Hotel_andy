import { useEffect, useMemo, useState } from 'react';
import '../styles/insumos.css';
import { tomarAccionInsumos, useInsumos, type AlertaStock, type Prod } from '../data/insumos';
import { numero } from '../lib/format';
import { esBajo } from '../lib/stock';
import { Aviso, BarraStock, Boton, ErrorCarga, Skeleton } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { coincide } from './insumos/logica';
import { Categorias } from './insumos/Categorias';
import { CargarFactura } from './insumos/CargarFactura';
import { CuadreDia } from './insumos/Cuadre';
import { Facturas } from './insumos/Facturas';
import { ProductoForm } from './insumos/ProductoForm';
import { ProductoHoja } from './insumos/ProductoHoja';
import { Venta } from './insumos/Venta';

type Filtro = 'todo' | 'bajos' | 'inactivos' | string;
type Pestana = 'insumos' | 'facturas' | 'cuadre';

/** "⚠️ Se está acabando Cloro: quedan 4 kg (…)" → "Quedan 4 kg (…)": el grupo ya dice que se está acabando. */
function textoAlerta(a: AlertaStock): string {
  const t = a.mensaje.replace(/^[^\p{L}\p{N}]+/u, '');
  const resto = t.includes(': ') ? t.slice(t.indexOf(': ') + 2) : t;
  return resto.charAt(0).toUpperCase() + resto.slice(1);
}

export function Inventario() {
  const api = useInsumos();
  const { prods, cats, alertas } = api;
  const [pestana, setPestana] = useState<Pestana>('insumos');
  const [filtro, setFiltro] = useState<Filtro>('todo');
  const [q, setQ] = useState('');
  const [factura, setFactura] = useState<{ inicial: string | null } | null>(null);
  const [proveedores, setProveedores] = useState<string[]>([]);
  const [abierto, setAbierto] = useState<{ id: string; contar: boolean } | null>(null);
  const [form, setForm] = useState<{ producto?: Prod } | null>(null);
  const [verCats, setVerCats] = useState(false);
  const [venta, setVenta] = useState<{ inicial: string | null } | null>(null);

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
  const alertaDe = useMemo(() => new Map<string, AlertaStock>(alertas.map((a) => [a.productoId, a])), [alertas]);
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

  const abrirProd = prods?.find((p) => p.id === abierto?.id);
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
          setPestana('facturas');
        }}
      />
    );

  const fila = (p: Prod, enAlerta = false) => (
    <Fila
      key={p.id}
      p={p}
      aviso={enAlerta ? alertaDe.get(p.id) : undefined}
      onAbrir={(contar) => setAbierto({ id: p.id, contar })}
      onComprar={() => setFactura({ inicial: p.id })}
      onReactivar={() => void api.activar(p, true)}
    />
  );

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
        <Boton icono="factura" onClick={() => setFactura({ inicial: null })}>
          Cargar compra
        </Boton>
        <Boton variante="quiet" icono="dinero" onClick={() => setVenta({ inicial: null })}>
          Vender
        </Boton>
        <Boton variante="quiet" icono="mas" onClick={() => setForm({})}>
          Nuevo producto
        </Boton>
      </div>

      <div className="ins-tabs" role="tablist" aria-label="Qué quieres ver">
        {(
          [
            ['insumos', 'Insumos'],
            ['facturas', 'Facturas'],
            ['cuadre', 'Cuadre del día'],
          ] as [Pestana, string][]
        ).map(([id, texto]) => (
          <button key={id} type="button" role="tab" aria-selected={pestana === id} className="ins-tab" onClick={() => setPestana(id)}>
            {texto}
          </button>
        ))}
      </div>

      {pestana === 'facturas' && <Facturas api={api} onNueva={() => setFactura({ inicial: null })} onProveedores={setProveedores} />}
      {pestana === 'cuadre' && <CuadreDia api={api} onVender={() => setVenta({ inicial: null })} />}

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

            {filtro === 'todo' && !buscando && bajos.length > 0 && (
              <div className="grupo grupo--alerta">
                <h2 className="grupo__titulo">
                  <Icon name="alerta" /> Se está acabando
                </h2>
                <ul className="insumos">{bajos.map((p) => fila(p, true))}</ul>
              </div>
            )}

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
                      {cat.icono && (
                        <span className="grupo__ico" aria-hidden="true">
                          {cat.icono}
                        </span>
                      )}
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
          contar={abierto?.contar}
          puedeAjustar
          onCerrar={() => setAbierto(null)}
          onEditar={() => {
            setAbierto(null);
            setForm({ producto: abrirProd });
          }}
          onVender={() => {
            setAbierto(null);
            setVenta({ inicial: abrirProd.id });
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
    </section>
  );
}

function Fila({ p, aviso, onAbrir, onComprar, onReactivar }: { p: Prod; aviso?: AlertaStock; onAbrir: (contar: boolean) => void; onComprar: () => void; onReactivar: () => void }) {
  const { nivel, pct, frase } = p.nivel;
  const bajo = esBajo(nivel);
  return (
    <li className={`insumo ${!p.activo ? 'insumo--apagado' : ''}`}>
      <button type="button" className="insumo__abrir" onClick={() => onAbrir(false)} aria-label={`${p.nombre}: ${frase}. Abrir`}>
        <span className="insumo__cab">
          <span className="insumo__nombre">{p.nombre}</span>
          <span className={`insumo__frase n-${nivel}`}>{aviso ? textoAlerta(aviso) : frase}</span>
        </span>
        <BarraStock nivel={nivel} pct={pct} />
        <span className="insumo__pie">
          {nivel === 'sin_contar' ? 'Nadie ha contado este producto todavía' : p.minimo != null ? `Mínimo ${numero(p.minimo)}` : 'Sin mínimo'}
          {p.seVende && ' · Se vende'}
        </span>
      </button>
      {!p.activo ? (
        <Boton variante="quiet" onClick={onReactivar}>
          Volver a la lista
        </Boton>
      ) : bajo ? (
        <Boton variante="quiet" icono="factura" onClick={onComprar}>
          Cargar compra
        </Boton>
      ) : nivel === 'sin_contar' ? (
        <Boton variante="quiet" onClick={() => onAbrir(true)}>
          Contar ahora
        </Boton>
      ) : null}
    </li>
  );
}

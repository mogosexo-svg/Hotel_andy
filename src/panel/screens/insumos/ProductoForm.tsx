import { useEffect, useState } from 'react';
import { Boton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import type { InsumosApi, Prod, ProdDraft } from '../../data/insumos';
import { urlFirmada } from '../../data/insumos';
import { Campo, HojaEstable, Interruptor } from './piezas';
import { cantidadATexto, centavosATexto, parseCantidad, parseDinero } from './logica';

const UNIDADES = ['unidad', 'rollo', 'kg', 'litro', 'lata', 'botella', 'paquete', 'par', 'juego', 'recarga'];

interface Props {
  api: InsumosApi;
  /** Producto a editar; sin él, se crea uno nuevo. */
  producto?: Prod;
  nombreInicial?: string;
  categoriaInicial?: string;
  onListo: (p: Prod | null) => void;
  onCerrar: () => void;
}

/** Crear o editar un producto. `stock` no se edita aquí: el stock inicial y los cambios van por conteo. */
export function ProductoForm({ api, producto, nombreInicial = '', categoriaInicial, onListo, onCerrar }: Props) {
  const { cats } = api;
  const [nombre, setNombre] = useState(producto?.nombre ?? nombreInicial);
  const [categoria, setCategoria] = useState(producto?.categoriaId ?? categoriaInicial ?? cats[0]?.id ?? '');
  const [unidad, setUnidad] = useState(producto?.unidad ?? 'unidad');
  const [minimo, setMinimo] = useState(cantidadATexto(producto?.minimo));
  const [seVende, setSeVende] = useState(producto?.seVende ?? false);
  const [venta, setVenta] = useState(centavosATexto(producto?.venta));
  const [compra, setCompra] = useState(centavosATexto(producto?.compra));
  const [stock, setStock] = useState('');
  const [activo, setActivo] = useState(producto?.activo ?? true);
  const [foto, setFoto] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (foto) {
      const u = URL.createObjectURL(foto);
      setVista(u);
      return () => URL.revokeObjectURL(u);
    }
    if (producto?.foto) void urlFirmada(producto.foto).then(setVista);
  }, [foto, producto?.foto]);

  async function guardar() {
    const n = nombre.trim();
    if (!n) return setError('Ponle un nombre al producto.');
    if (!categoria) return setError('Elige una categoría. Si no hay, créala primero.');
    const min = minimo.trim() ? parseCantidad(minimo) : null;
    if (minimo.trim() && min == null) return setError('El mínimo debe ser un número. Ejemplo: 10 o 0,5');
    const pv = venta.trim() ? parseDinero(venta) : null;
    if (seVende && venta.trim() && pv == null) return setError('El precio de venta debe verse así: 2,50');
    if (seVende && pv == null) return setError('Si se vende, ponle el precio de venta.');
    const pc = compra.trim() ? parseDinero(compra) : null;
    if (compra.trim() && pc == null) return setError('El precio de compra debe verse así: 1,20');
    const st = !producto && stock.trim() ? parseCantidad(stock) : null;
    if (!producto && stock.trim() && st == null) return setError('Lo que hay ahora debe ser un número. Ejemplo: 12');
    setError(null);
    setGuardando(true);
    let fotoPath = producto?.foto ?? null;
    if (foto) fotoPath = (await api.subirFoto('productos', foto)) ?? fotoPath;
    const d: ProdDraft = { nombre: n, categoriaId: categoria, unidad: unidad.trim() || 'unidad', minimo: min, seVende, venta: seVende ? pv : (pv ?? producto?.venta ?? null), compra: pc, foto: fotoPath };
    if (producto) {
      const ok = await api.guardarProducto(producto.id, d);
      if (ok && activo !== producto.activo) await api.activar({ ...producto, ...d, activo: producto.activo }, activo);
      setGuardando(false);
      if (ok) onListo(null);
    } else {
      const p = await api.crearProducto(d, st);
      setGuardando(false);
      if (p) onListo(p);
    }
  }

  return (
    <HojaEstable titulo={producto ? 'Editar producto' : 'Producto nuevo'} onCerrar={onCerrar}>
      <form
        className="ins-form"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <Campo etiqueta="Nombre">
          {(id) => <input id={id} className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" autoFocus={!producto} placeholder="Ej.: Papel higiénico" />}
        </Campo>
        <Campo etiqueta="Categoría" error={cats.length === 0 ? 'Todavía no hay categorías. Crea una desde "Categorías".' : null}>
          {(id) => (
            <select id={id} className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <div className="ins-par">
          <Campo etiqueta="Se cuenta en">
            {(id) => (
              <>
                <input id={id} className="input" list="ins-unidades" value={unidad} onChange={(e) => setUnidad(e.target.value)} autoComplete="off" />
                <datalist id="ins-unidades">
                  {UNIDADES.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </>
            )}
          </Campo>
          <Campo etiqueta="Avisar si queda" ayuda="Opcional">
            {(id) => <input id={id} className="input" inputMode="decimal" value={minimo} onChange={(e) => setMinimo(e.target.value)} placeholder="10" />}
          </Campo>
        </div>
        {!producto && (
          <Campo etiqueta="¿Cuánto hay ahora?" ayuda="Opcional. Si lo dejas vacío quedará “Sin contar”.">
            {(id) => <input id={id} className="input" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Ej.: 12 o 0,5" />}
          </Campo>
        )}
        <Interruptor marcado={seVende} onChange={setSeVende} texto="Se vende a los huéspedes" />
        <div className="ins-par">
          {seVende && (
            <Campo etiqueta="Se vende a ($)">
              {(id) => <input id={id} className="input" inputMode="decimal" value={venta} onChange={(e) => setVenta(e.target.value)} placeholder="2,50" />}
            </Campo>
          )}
          <Campo etiqueta="Se compra a ($)" ayuda="Opcional">
            {(id) => <input id={id} className="input" inputMode="decimal" value={compra} onChange={(e) => setCompra(e.target.value)} placeholder="1,20" />}
          </Campo>
        </div>
        <div className="campo">
          <span className="campo__etiqueta">Foto (opcional)</span>
          <label className="ins-foto">
            {vista ? <img src={vista} alt="" /> : <Icon name="foto" />}
            <span>{vista ? 'Cambiar la foto' : 'Tomar o elegir una foto'}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        {producto && <Interruptor marcado={activo} onChange={setActivo} texto="Aparece en la lista (si lo apagas, se guarda el historial)" />}
        {error && (
          <p className="campo__error" role="alert">
            {error}
          </p>
        )}
        <div className="hoja__acciones">
          <Boton type="submit" cargando={guardando} block>
            {producto ? 'Guardar cambios' : 'Crear producto'}
          </Boton>
        </div>
      </form>
    </HojaEstable>
  );
}

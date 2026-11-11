import { useCallback, useEffect, useState } from 'react';
import { usePerfil } from '../../data/sesion';
import { Aviso, Boton, ErrorCarga, Skeleton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { lineasDeFactura, listarFacturas, urlFirmada, type FilaFactura, type InsumosApi, type LineaFactura } from '../../data/insumos';
import { HojaEstable, Campo } from './piezas';
import { dinero, fechaCorta, numero } from '../../lib/format';

/** Lista de facturas cargadas, con detalle y anulación (solo la dueña). */
export function Facturas({ api, onNueva, onProveedores }: { api: InsumosApi; onNueva: () => void; onProveedores: (p: string[]) => void }) {
  const { hotelId } = usePerfil();
  const [filas, setFilas] = useState<FilaFactura[] | null>(null);
  const [error, setError] = useState(false);
  const [abierta, setAbierta] = useState<FilaFactura | null>(null);

  const cargar = useCallback(async () => {
    const f = await listarFacturas(hotelId);
    if (!f) return setError(true);
    setError(false);
    setFilas(f);
    onProveedores([...new Set(f.map((x) => x.proveedor))]);
  }, [hotelId, onProveedores]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (error) return <ErrorCarga onReintentar={() => void cargar()} />;
  if (!filas)
    return (
      <div className="pila" aria-busy="true" aria-label="Cargando facturas">
        <Skeleton h="5rem" r="14px" />
        <Skeleton h="5rem" r="14px" />
        <Skeleton h="5rem" r="14px" />
      </div>
    );
  if (filas.length === 0)
    return (
      <Aviso icono="factura" titulo="Todavía no hay facturas" texto="Cuando llegue un pedido, cárgalo desde la factura y el stock sube solo." accion={{ texto: 'Cargar compra', onClick: onNueva, icono: 'mas' }} />
    );

  return (
    <>
      <ul className="ins-facturas">
        {filas.map((f) => (
          <li key={f.id}>
            <button type="button" className={`ins-factura-fila ${f.anulada ? 'es-anulada' : ''}`} onClick={() => setAbierta(f)}>
              <span className="ins-factura-fila__ico">
                <Icon name="factura" />
              </span>
              <span className="ins-factura-fila__txt">
                <strong>{f.proveedor}</strong>
                <span className="ins-ayuda">
                  {fechaCorta(f.fecha)}
                  {f.numero ? ` · N.º ${f.numero}` : ''}
                </span>
              </span>
              <span className="ins-factura-fila__monto">
                <strong>{dinero(f.total)}</strong>
                {f.anulada && <span className="ins-etiqueta">Anulada</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {abierta && (
        <DetalleFactura
          api={api}
          factura={abierta}
          onCerrar={() => setAbierta(null)}
          onAnulada={() => {
            setAbierta(null);
            void cargar();
          }}
        />
      )}
    </>
  );
}

function DetalleFactura({ api, factura: f, onCerrar, onAnulada }: { api: InsumosApi; factura: FilaFactura; onCerrar: () => void; onAnulada: () => void }) {
  const { rol } = usePerfil();
  const [lineas, setLineas] = useState<LineaFactura[] | null | 'error'>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const nombre = (id: string) => api.prods?.find((p) => p.id === id);

  useEffect(() => {
    void lineasDeFactura(f.id).then((l) => setLineas(l ?? 'error'));
    if (f.foto) void urlFirmada(f.foto).then(setFoto);
  }, [f.id, f.foto]);

  async function anular() {
    setTrabajando(true);
    const ok = await api.anularFactura(f.id, motivo);
    setTrabajando(false);
    if (ok) onAnulada();
  }

  return (
    <HojaEstable titulo={f.proveedor} onCerrar={onCerrar}>
      <div className="ins-detalle">
        <p className="ins-ayuda">
          {fechaCorta(f.fecha)}
          {f.numero ? ` · N.º ${f.numero}` : ''}
        </p>
        {f.anulada && (
          <p className="ins-alerta" role="status">
            <strong>Factura anulada.</strong> El stock volvió a lo de antes.{f.motivo ? ` Motivo: ${f.motivo}` : ''}
          </p>
        )}
        {lineas === null ? (
          <div className="pila" aria-busy="true">
            <Skeleton h="3rem" />
            <Skeleton h="3rem" />
          </div>
        ) : lineas === 'error' ? (
          <p className="ins-ayuda">No pudimos traer los productos. Cierra y vuelve a abrir.</p>
        ) : (
          <ul className="ins-hist ins-hist--factura">
            {lineas.map((l) => {
              const p = nombre(l.productoId);
              return (
                <li key={l.productoId}>
                  <span>{p?.nombre ?? 'Producto'}</span>
                  <span className="ins-ayuda">
                    {numero(l.cantidad)} × {dinero(l.costo)}
                  </span>
                  <strong>{dinero(Math.round(l.cantidad * l.costo))}</strong>
                </li>
              );
            })}
            <li className="ins-hist__total">
              <span>Total</span>
              <span />
              <strong>{dinero(f.total)}</strong>
            </li>
          </ul>
        )}
        {foto && (
          <a href={foto} target="_blank" rel="noreferrer" className="ins-detalle__enlace">
            <img className="ins-detalle__foto" src={foto} alt="Foto de la factura" />
          </a>
        )}
        {!f.anulada &&
          (rol !== 'duena' ? (
            <p className="ins-ayuda">Solo la dueña puede anular una factura.</p>
          ) : confirmando ? (
            <div className="ins-alerta" role="alertdialog" aria-label="Confirmar anulación">
              <p>
                <strong>¿Anular esta factura?</strong> El stock de cada producto vuelve a lo de antes. No se puede deshacer.
              </p>
              <Campo etiqueta="Motivo (opcional)">{(id) => <input id={id} className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: Se cargó dos veces" />}</Campo>
              <div className="ins-acciones ins-acciones--fila">
                <Boton variante="quiet" onClick={() => setConfirmando(false)}>
                  Mejor no
                </Boton>
                <Boton variante="danger" cargando={trabajando} onClick={() => void anular()}>
                  Sí, anular
                </Boton>
              </div>
            </div>
          ) : (
            <Boton variante="quiet" block onClick={() => setConfirmando(true)}>
              Anular esta factura
            </Boton>
          ))}
      </div>
    </HojaEstable>
  );
}

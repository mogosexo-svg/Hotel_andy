import { useEffect, useState } from 'react';
import { usePerfil } from '../../data/sesion';
import { cargarCuenta, cargarHotel, guardarCuenta, guardarHotel, useCarga } from '../../data/config';
import { Boton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { Aviso, Cambiar, Estados, HojaCambio, Intro, Opciones, Renglon, useGuardar } from './ui';
import { PLANES, enmascarar, leerCuenta, validarCuenta, type Cuenta, type PlanId } from './logica';

export function PlanCuenta() {
  return (
    <div className="cfg-seccion">
      <Intro titulo="Plan y cuenta para transferencias" />
      <PlanDelHotel />
      <CuentaBancaria />
    </div>
  );
}

function PlanDelHotel() {
  const { hotelId } = usePerfil();
  const { datos, error, recargar, reintentar } = useCarga(() => cargarHotel(hotelId), [hotelId]);
  const guardar = useGuardar(recargar);
  const [abierto, setAbierto] = useState(false);
  const [plan, setPlan] = useState<PlanId | ''>('');

  return (
    <section className="card cfg-card" aria-labelledby="pl-t">
      <h3 id="pl-t" className="cfg-card__titulo">
        Plan del hotel
      </h3>
      <p className="cfg-nota">El plan decide qué funciones están encendidas en el panel y en la web.</p>
      <Estados
        datos={datos}
        error={error}
        onReintentar={reintentar}
        hijos={(h) => (
          <>
            <ul className="cfg-lista">
              <Renglon
                etiqueta="Plan contratado"
                ayuda={h.plan ? PLANES[h.plan].texto : 'Aún no se ha definido con Mogolicous.'}
                valor={h.plan ? PLANES[h.plan].nombre : 'Sin definir'}
                sinDefinir={!h.plan}
                acciones={
                  <Cambiar
                    texto={h.plan ? 'Cambiar' : 'Elegir'}
                    etiqueta="plan del hotel"
                    onClick={() => {
                      setPlan(h.plan ?? '');
                      setAbierto(true);
                    }}
                  />
                }
              />
            </ul>
            {abierto && (
              <HojaCambio
                titulo="Plan del hotel"
                ayuda="Al cambiarlo, se encienden o se apagan funciones. Puedes volver al anterior con Deshacer."
                onCerrar={() => setAbierto(false)}
                onGuardar={async () => {
                  if (!plan) return 'Elige un plan.';
                  if (plan === h.plan) return null;
                  const ok = await guardar(
                    () => guardarHotel(hotelId, { plan }, { plan: h.plan }),
                    `El plan ahora es ${PLANES[plan].nombre}`,
                  );
                  return ok ? null : 'No se pudo guardar. Intenta otra vez.';
                }}
              >
                <Opciones<PlanId>
                  nombre="Plan"
                  valor={plan}
                  onCambio={setPlan}
                  opciones={(Object.keys(PLANES) as PlanId[]).map((k) => ({
                    valor: k,
                    titulo: PLANES[k].nombre,
                    texto: PLANES[k].texto,
                  }))}
                />
              </HojaCambio>
            )}
          </>
        )}
      />
    </section>
  );
}

const VACIA: Cuenta = {
  banco: '',
  tipo: 'ahorros',
  numero: '',
  titular: '',
  documento: '',
};

function CuentaBancaria() {
  const { hotelId } = usePerfil();
  const { datos, error, recargar, reintentar } = useCarga(() => cargarCuenta(hotelId), [hotelId]);
  const guardar = useGuardar(recargar);
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState<Cuenta>(VACIA);
  const [visible, setVisible] = useState(false);

  // El número completo se oculta solo a los 15 segundos.
  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => setVisible(false), 15000);
    return () => window.clearTimeout(t);
  }, [visible]);

  const campo = (k: keyof Cuenta, etiqueta: string, extra: { inputMode?: 'numeric'; autoFocus?: boolean } = {}) => (
    <div className="campo">
      <label htmlFor={`cta-${k}`}>{etiqueta}</label>
      <input
        id={`cta-${k}`}
        className="input"
        autoComplete="off"
        {...extra}
        value={f[k] ?? ''}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
      />
    </div>
  );

  return (
    <section className="card cfg-card" aria-labelledby="ct-t">
      <h3 id="ct-t" className="cfg-card__titulo">
        Cuenta para recibir transferencias
      </h3>
      <p className="cfg-nota cfg-nota--aviso">
        <Icon name="llave" size="sm" />
        <span>Solo tú ves esta cuenta. Recepción y limpieza no la ven, y nunca aparece en la web.</span>
      </p>
      <Estados
        datos={datos === null ? null : { c: leerCuenta(datos.cuenta), crudo: datos.cuenta }}
        error={error}
        onReintentar={reintentar}
        hijos={({ c, crudo }) => (
          <>
            {!c ? (
              <Aviso
                icono="dinero"
                titulo="Aún no has puesto tu cuenta"
                texto="Es la cuenta a la que los huéspedes transfieren el anticipo de su reserva."
                accion={{
                  texto: 'Poner mi cuenta',
                  icono: 'dinero',
                  onClick: () => {
                    setF(VACIA);
                    setAbierto(true);
                  },
                }}
              />
            ) : (
              <ul className="cfg-lista">
                <Renglon etiqueta="Banco" valor={c.banco || 'Sin definir'} sinDefinir={!c.banco} acciones={null} />
                <Renglon
                  etiqueta={`Cuenta de ${c.tipo}`}
                  valor={visible ? c.numero : enmascarar(c.numero)}
                  acciones={
                    <Boton variante="quiet" icono={visible ? 'cerrar' : 'llave'} onClick={() => setVisible(!visible)}>
                      {visible ? 'Ocultar número' : 'Ver número'}
                    </Boton>
                  }
                />
                <Renglon etiqueta="A nombre de" valor={c.titular || 'Sin definir'} sinDefinir={!c.titular} acciones={null} />
                {c.documento && <Renglon etiqueta="Cédula o RUC" valor={c.documento} acciones={null} />}
                <li className="cfg-pie">
                  <Boton
                    variante="quiet"
                    onClick={() => {
                      setF({ ...c, documento: c.documento ?? '' });
                      setAbierto(true);
                    }}
                  >
                    Cambiar mi cuenta
                  </Boton>
                </li>
              </ul>
            )}

            {abierto && (
              <HojaCambio
                titulo="Mi cuenta para transferencias"
                ayuda="Revisa bien el número: es el que verán los huéspedes."
                onCerrar={() => setAbierto(false)}
                onGuardar={async () => {
                  const r = validarCuenta(f);
                  if (!r.ok) return r.error;
                  // Se conserva lo que ya hubiera en la cuenta y esta pantalla no maneja.
                  const base = crudo && typeof crudo === 'object' ? (crudo as Record<string, unknown>) : {};
                  const ok = await guardar(
                    () => guardarCuenta(hotelId, { ...base, ...r.valor }, crudo),
                    'Guardaste tu cuenta para transferencias',
                  );
                  return ok ? null : 'No se pudo guardar. Intenta otra vez.';
                }}
              >
                {campo('banco', 'Banco', { autoFocus: true })}
                <div className="campo">
                  <span className="campo__etiqueta">Tipo de cuenta</span>
                  <Opciones<Cuenta['tipo']>
                    nombre="Tipo de cuenta"
                    valor={f.tipo}
                    onCambio={(tipo) => setF({ ...f, tipo })}
                    opciones={[
                      { valor: 'ahorros', titulo: 'Ahorros' },
                      { valor: 'corriente', titulo: 'Corriente' },
                    ]}
                  />
                </div>
                {campo('numero', 'Número de cuenta', { inputMode: 'numeric' })}
                {campo('titular', 'A nombre de')}
                {campo('documento', 'Cédula o RUC (opcional)', {
                  inputMode: 'numeric',
                })}
              </HojaCambio>
            )}
          </>
        )}
      />
    </section>
  );
}

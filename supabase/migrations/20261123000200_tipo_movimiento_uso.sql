-- Salida manual de insumo usado en el turno (registrar_salidas_turno). Aparte: ADD VALUE no se usa en su misma transacción.
alter type tipo_movimiento add value if not exists 'uso';

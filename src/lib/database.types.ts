export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      alertas: {
        Row: {
          creada_en: string;
          habitacion_id: string | null;
          hotel_id: string;
          id: string;
          mensaje: string;
          notificada_en: string | null;
          producto_id: string | null;
          reserva_id: string | null;
          resuelta_en: string | null;
          tipo: Database["public"]["Enums"]["tipo_alerta"];
        };
        ComputedFields: never;
        Insert: {
          creada_en?: string;
          habitacion_id?: string | null;
          hotel_id: string;
          id?: string;
          mensaje: string;
          notificada_en?: string | null;
          producto_id?: string | null;
          reserva_id?: string | null;
          resuelta_en?: string | null;
          tipo: Database["public"]["Enums"]["tipo_alerta"];
        };
        Update: {
          creada_en?: string;
          habitacion_id?: string | null;
          hotel_id?: string;
          id?: string;
          mensaje?: string;
          notificada_en?: string | null;
          producto_id?: string | null;
          reserva_id?: string | null;
          resuelta_en?: string | null;
          tipo?: Database["public"]["Enums"]["tipo_alerta"];
        };
        Relationships: [
          {
            foreignKeyName: "alertas_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alertas_hotel_id_habitacion_id_fkey";
            columns: ["hotel_id", "habitacion_id"];
            isOneToOne: false;
            referencedRelation: "habitaciones";
            referencedColumns: ["hotel_id", "id"];
          },
          {
            foreignKeyName: "alertas_hotel_id_producto_id_fkey";
            columns: ["hotel_id", "producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["hotel_id", "id"];
          },
          {
            foreignKeyName: "alertas_hotel_id_reserva_id_fkey";
            columns: ["hotel_id", "reserva_id"];
            isOneToOne: false;
            referencedRelation: "reservas";
            referencedColumns: ["hotel_id", "id"];
          },
        ];
      };
      auditoria: {
        Row: {
          accion: string;
          antes: Json | null;
          creado_en: string;
          despues: Json | null;
          hotel_id: string;
          id: number;
          registro_id: string;
          tabla: string;
          usuario_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          accion: string;
          antes?: Json | null;
          creado_en?: string;
          despues?: Json | null;
          hotel_id: string;
          id?: never;
          registro_id: string;
          tabla: string;
          usuario_id?: string | null;
        };
        Update: {
          accion?: string;
          antes?: Json | null;
          creado_en?: string;
          despues?: Json | null;
          hotel_id?: string;
          id?: never;
          registro_id?: string;
          tabla?: string;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "auditoria_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
        ];
      };
      calendarios_ical: {
        Row: {
          activo: boolean;
          canal: Database["public"]["Enums"]["canal_venta"];
          habitacion_id: string;
          hotel_id: string;
          id: string;
          token_exportar: string;
          ultima_sincronizacion: string | null;
          ultimo_error: string | null;
          url_importar: string | null;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          canal: Database["public"]["Enums"]["canal_venta"];
          habitacion_id: string;
          hotel_id: string;
          id?: string;
          token_exportar?: string;
          ultima_sincronizacion?: string | null;
          ultimo_error?: string | null;
          url_importar?: string | null;
        };
        Update: {
          activo?: boolean;
          canal?: Database["public"]["Enums"]["canal_venta"];
          habitacion_id?: string;
          hotel_id?: string;
          id?: string;
          token_exportar?: string;
          ultima_sincronizacion?: string | null;
          ultimo_error?: string | null;
          url_importar?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calendarios_ical_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendarios_ical_hotel_id_habitacion_id_fkey";
            columns: ["hotel_id", "habitacion_id"];
            isOneToOne: false;
            referencedRelation: "habitaciones";
            referencedColumns: ["hotel_id", "id"];
          },
        ];
      };
      categorias: {
        Row: {
          clave: string | null;
          hotel_id: string;
          icono: string | null;
          id: string;
          nombre: string;
          orden: number;
        };
        ComputedFields: never;
        Insert: {
          clave?: string | null;
          hotel_id: string;
          icono?: string | null;
          id?: string;
          nombre: string;
          orden?: number;
        };
        Update: {
          clave?: string | null;
          hotel_id?: string;
          icono?: string | null;
          id?: string;
          nombre?: string;
          orden?: number;
        };
        Relationships: [
          {
            foreignKeyName: "categorias_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
        ];
      };
      compras: {
        Row: {
          anulada_en: string | null;
          anulada_por: string | null;
          creada_por: string | null;
          creado_en: string;
          fecha: string;
          foto_path: string | null;
          hotel_id: string;
          id: string;
          motivo_anulacion: string | null;
          numero_factura: string | null;
          proveedor: string;
          total_centavos: number;
        };
        ComputedFields: never;
        Insert: {
          anulada_en?: string | null;
          anulada_por?: string | null;
          creada_por?: string | null;
          creado_en?: string;
          fecha: string;
          foto_path?: string | null;
          hotel_id: string;
          id?: string;
          motivo_anulacion?: string | null;
          numero_factura?: string | null;
          proveedor: string;
          total_centavos: number;
        };
        Update: {
          anulada_en?: string | null;
          anulada_por?: string | null;
          creada_por?: string | null;
          creado_en?: string;
          fecha?: string;
          foto_path?: string | null;
          hotel_id?: string;
          id?: string;
          motivo_anulacion?: string | null;
          numero_factura?: string | null;
          proveedor?: string;
          total_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: "compras_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
        ];
      };
      compras_lineas: {
        Row: {
          cantidad: number;
          compra_id: string;
          costo_unit_centavos: number;
          hotel_id: string;
          id: string;
          producto_id: string;
        };
        ComputedFields: never;
        Insert: {
          cantidad: number;
          compra_id: string;
          costo_unit_centavos: number;
          hotel_id: string;
          id?: string;
          producto_id: string;
        };
        Update: {
          cantidad?: number;
          compra_id?: string;
          costo_unit_centavos?: number;
          hotel_id?: string;
          id?: string;
          producto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "compras_lineas_hotel_id_compra_id_fkey";
            columns: ["hotel_id", "compra_id"];
            isOneToOne: false;
            referencedRelation: "compras";
            referencedColumns: ["hotel_id", "id"];
          },
          {
            foreignKeyName: "compras_lineas_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "compras_lineas_hotel_id_producto_id_fkey";
            columns: ["hotel_id", "producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["hotel_id", "id"];
          },
        ];
      };
      config: {
        Row: {
          actualizado_en: string;
          cuenta_transferencia: Json | null;
          hotel_id: string;
        };
        ComputedFields: never;
        Insert: {
          actualizado_en?: string;
          cuenta_transferencia?: Json | null;
          hotel_id: string;
        };
        Update: {
          actualizado_en?: string;
          cuenta_transferencia?: Json | null;
          hotel_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "config_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: true;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
        ];
      };
      consumos: {
        Row: {
          anulado_en: string | null;
          anulado_por: string | null;
          cantidad: number;
          costo_unit_centavos: number | null;
          creado_en: string;
          hotel_id: string;
          id: string;
          medio: Database["public"]["Enums"]["medio_pago"] | null;
          motivo_anulacion: string | null;
          pagado_en: string | null;
          precio_unit_centavos: number;
          producto_id: string;
          registrado_por: string | null;
          reserva_id: string | null;
          total_centavos: number | null;
        };
        ComputedFields: never;
        Insert: {
          anulado_en?: string | null;
          anulado_por?: string | null;
          cantidad: number;
          costo_unit_centavos?: number | null;
          creado_en?: string;
          hotel_id: string;
          id?: string;
          medio?: Database["public"]["Enums"]["medio_pago"] | null;
          motivo_anulacion?: string | null;
          pagado_en?: string | null;
          precio_unit_centavos: number;
          producto_id: string;
          registrado_por?: string | null;
          reserva_id?: string | null;
          total_centavos?: never;
        };
        Update: {
          anulado_en?: string | null;
          anulado_por?: string | null;
          cantidad?: number;
          costo_unit_centavos?: number | null;
          creado_en?: string;
          hotel_id?: string;
          id?: string;
          medio?: Database["public"]["Enums"]["medio_pago"] | null;
          motivo_anulacion?: string | null;
          pagado_en?: string | null;
          precio_unit_centavos?: number;
          producto_id?: string;
          registrado_por?: string | null;
          reserva_id?: string | null;
          total_centavos?: never;
        };
        Relationships: [
          {
            foreignKeyName: "consumos_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consumos_hotel_id_producto_id_fkey";
            columns: ["hotel_id", "producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["hotel_id", "id"];
          },
          {
            foreignKeyName: "consumos_hotel_id_reserva_id_fkey";
            columns: ["hotel_id", "reserva_id"];
            isOneToOne: false;
            referencedRelation: "reservas";
            referencedColumns: ["hotel_id", "id"];
          },
        ];
      };
      habitaciones: {
        Row: {
          activa: boolean;
          estado: Database["public"]["Enums"]["estado_habitacion"];
          estado_desde: string;
          hotel_id: string;
          id: string;
          numero: string;
          piso: number;
          tipo_id: string;
        };
        ComputedFields: never;
        Insert: {
          activa?: boolean;
          estado?: Database["public"]["Enums"]["estado_habitacion"];
          estado_desde?: string;
          hotel_id: string;
          id?: string;
          numero: string;
          piso: number;
          tipo_id: string;
        };
        Update: {
          activa?: boolean;
          estado?: Database["public"]["Enums"]["estado_habitacion"];
          estado_desde?: string;
          hotel_id?: string;
          id?: string;
          numero?: string;
          piso?: number;
          tipo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habitaciones_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "habitaciones_hotel_id_tipo_id_fkey";
            columns: ["hotel_id", "tipo_id"];
            isOneToOne: false;
            referencedRelation: "tipos_habitacion";
            referencedColumns: ["hotel_id", "id"];
          },
        ];
      };
      hoteles: {
        Row: {
          booking_calificacion: number | null;
          booking_resenas: number | null;
          check_in: string | null;
          check_out: string | null;
          ciudad: string | null;
          creado_en: string;
          dominio: string | null;
          estrellas: number | null;
          id: string;
          idioma: string;
          moneda: string;
          nombre: string;
          pais: string | null;
          plan: string | null;
          provincia: string | null;
          reglas: NonNullable<Json>;
          slug: string;
          telefono: string | null;
          zona_horaria: string;
        };
        ComputedFields: never;
        Insert: {
          booking_calificacion?: number | null;
          booking_resenas?: number | null;
          check_in?: string | null;
          check_out?: string | null;
          ciudad?: string | null;
          creado_en?: string;
          dominio?: string | null;
          estrellas?: number | null;
          id?: string;
          idioma?: string;
          moneda?: string;
          nombre: string;
          pais?: string | null;
          plan?: string | null;
          provincia?: string | null;
          reglas?: NonNullable<Json>;
          slug: string;
          telefono?: string | null;
          zona_horaria?: string;
        };
        Update: {
          booking_calificacion?: number | null;
          booking_resenas?: number | null;
          check_in?: string | null;
          check_out?: string | null;
          ciudad?: string | null;
          creado_en?: string;
          dominio?: string | null;
          estrellas?: number | null;
          id?: string;
          idioma?: string;
          moneda?: string;
          nombre?: string;
          pais?: string | null;
          plan?: string | null;
          provincia?: string | null;
          reglas?: NonNullable<Json>;
          slug?: string;
          telefono?: string | null;
          zona_horaria?: string;
        };
        Relationships: [];
      };
      huespedes: {
        Row: {
          acepta_campanas: boolean;
          consentimiento_en: string | null;
          creado_en: string;
          documento: string | null;
          hotel_id: string;
          id: string;
          nombre: string;
          notas: string | null;
          procedencia: string | null;
          telefono: string | null;
        };
        ComputedFields: never;
        Insert: {
          acepta_campanas?: boolean;
          consentimiento_en?: string | null;
          creado_en?: string;
          documento?: string | null;
          hotel_id: string;
          id?: string;
          nombre: string;
          notas?: string | null;
          procedencia?: string | null;
          telefono?: string | null;
        };
        Update: {
          acepta_campanas?: boolean;
          consentimiento_en?: string | null;
          creado_en?: string;
          documento?: string | null;
          hotel_id?: string;
          id?: string;
          nombre?: string;
          notas?: string | null;
          procedencia?: string | null;
          telefono?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "huespedes_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
        ];
      };
      kit_por_tipo: {
        Row: {
          cantidad: number;
          hotel_id: string;
          por: Database["public"]["Enums"]["kit_por"];
          producto_id: string;
          tipo_id: string;
        };
        ComputedFields: never;
        Insert: {
          cantidad: number;
          hotel_id: string;
          por: Database["public"]["Enums"]["kit_por"];
          producto_id: string;
          tipo_id: string;
        };
        Update: {
          cantidad?: number;
          hotel_id?: string;
          por?: Database["public"]["Enums"]["kit_por"];
          producto_id?: string;
          tipo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kit_por_tipo_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "kit_por_tipo_hotel_id_producto_id_fkey";
            columns: ["hotel_id", "producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["hotel_id", "id"];
          },
          {
            foreignKeyName: "kit_por_tipo_hotel_id_tipo_id_fkey";
            columns: ["hotel_id", "tipo_id"];
            isOneToOne: false;
            referencedRelation: "tipos_habitacion";
            referencedColumns: ["hotel_id", "id"];
          },
        ];
      };
      mensajes_whatsapp: {
        Row: {
          contenido: NonNullable<Json>;
          creado_en: string;
          direccion: string;
          estado: string | null;
          hotel_id: string;
          id: string;
          plantilla: string | null;
          reserva_id: string | null;
          telefono: string;
          wa_message_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          contenido?: NonNullable<Json>;
          creado_en?: string;
          direccion: string;
          estado?: string | null;
          hotel_id: string;
          id?: string;
          plantilla?: string | null;
          reserva_id?: string | null;
          telefono: string;
          wa_message_id?: string | null;
        };
        Update: {
          contenido?: NonNullable<Json>;
          creado_en?: string;
          direccion?: string;
          estado?: string | null;
          hotel_id?: string;
          id?: string;
          plantilla?: string | null;
          reserva_id?: string | null;
          telefono?: string;
          wa_message_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "mensajes_whatsapp_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mensajes_whatsapp_hotel_id_reserva_id_fkey";
            columns: ["hotel_id", "reserva_id"];
            isOneToOne: false;
            referencedRelation: "reservas";
            referencedColumns: ["hotel_id", "id"];
          },
        ];
      };
      movimientos_insumo: {
        Row: {
          cantidad: number;
          compra_id: string | null;
          consumo_id: string | null;
          creado_en: string;
          habitacion_id: string | null;
          hotel_id: string;
          id: number;
          nota: string | null;
          producto_id: string;
          stock_resultante: number | null;
          tipo: Database["public"]["Enums"]["tipo_movimiento"];
          usuario_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          cantidad: number;
          compra_id?: string | null;
          consumo_id?: string | null;
          creado_en?: string;
          habitacion_id?: string | null;
          hotel_id: string;
          id?: never;
          nota?: string | null;
          producto_id: string;
          stock_resultante?: number | null;
          tipo: Database["public"]["Enums"]["tipo_movimiento"];
          usuario_id?: string | null;
        };
        Update: {
          cantidad?: number;
          compra_id?: string | null;
          consumo_id?: string | null;
          creado_en?: string;
          habitacion_id?: string | null;
          hotel_id?: string;
          id?: never;
          nota?: string | null;
          producto_id?: string;
          stock_resultante?: number | null;
          tipo?: Database["public"]["Enums"]["tipo_movimiento"];
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "movimientos_insumo_hotel_id_compra_id_fkey";
            columns: ["hotel_id", "compra_id"];
            isOneToOne: false;
            referencedRelation: "compras";
            referencedColumns: ["hotel_id", "id"];
          },
          {
            foreignKeyName: "movimientos_insumo_hotel_id_consumo_id_fkey";
            columns: ["hotel_id", "consumo_id"];
            isOneToOne: false;
            referencedRelation: "consumos";
            referencedColumns: ["hotel_id", "id"];
          },
          {
            foreignKeyName: "movimientos_insumo_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_insumo_hotel_id_habitacion_id_fkey";
            columns: ["hotel_id", "habitacion_id"];
            isOneToOne: false;
            referencedRelation: "habitaciones";
            referencedColumns: ["hotel_id", "id"];
          },
          {
            foreignKeyName: "movimientos_insumo_hotel_id_producto_id_fkey";
            columns: ["hotel_id", "producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["hotel_id", "id"];
          },
        ];
      };
      nfc_destinos: {
        Row: {
          activo: boolean;
          hotel_id: string;
          id: string;
          lugar: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          hotel_id: string;
          id?: string;
          lugar: string;
          url: string;
        };
        Update: {
          activo?: boolean;
          hotel_id?: string;
          id?: string;
          lugar?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nfc_destinos_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
        ];
      };
      nfc_toques: {
        Row: {
          creado_en: string;
          destino_id: string;
          hotel_id: string;
          id: number;
        };
        ComputedFields: never;
        Insert: {
          creado_en?: string;
          destino_id: string;
          hotel_id: string;
          id?: never;
        };
        Update: {
          creado_en?: string;
          destino_id?: string;
          hotel_id?: string;
          id?: never;
        };
        Relationships: [
          {
            foreignKeyName: "nfc_toques_hotel_id_destino_id_fkey";
            columns: ["hotel_id", "destino_id"];
            isOneToOne: false;
            referencedRelation: "nfc_destinos";
            referencedColumns: ["hotel_id", "id"];
          },
          {
            foreignKeyName: "nfc_toques_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
        ];
      };
      pagos: {
        Row: {
          comprobante_path: string | null;
          creado_en: string;
          hotel_id: string;
          id: string;
          medio: Database["public"]["Enums"]["medio_pago"];
          monto_centavos: number;
          registrado_por: string | null;
          reserva_id: string;
        };
        ComputedFields: never;
        Insert: {
          comprobante_path?: string | null;
          creado_en?: string;
          hotel_id: string;
          id?: string;
          medio: Database["public"]["Enums"]["medio_pago"];
          monto_centavos: number;
          registrado_por?: string | null;
          reserva_id: string;
        };
        Update: {
          comprobante_path?: string | null;
          creado_en?: string;
          hotel_id?: string;
          id?: string;
          medio?: Database["public"]["Enums"]["medio_pago"];
          monto_centavos?: number;
          registrado_por?: string | null;
          reserva_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pagos_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagos_hotel_id_reserva_id_fkey";
            columns: ["hotel_id", "reserva_id"];
            isOneToOne: false;
            referencedRelation: "reservas";
            referencedColumns: ["hotel_id", "id"];
          },
        ];
      };
      productos: {
        Row: {
          activo: boolean;
          categoria_id: string;
          clave: string | null;
          consumo_diario: number | null;
          creado_en: string;
          foto_path: string | null;
          hotel_id: string;
          id: string;
          minimo: number | null;
          nombre: string;
          precio_compra_centavos: number | null;
          precio_venta_centavos: number | null;
          se_vende: boolean;
          stock: number | null;
          unidad: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          categoria_id: string;
          clave?: string | null;
          consumo_diario?: number | null;
          creado_en?: string;
          foto_path?: string | null;
          hotel_id: string;
          id?: string;
          minimo?: number | null;
          nombre: string;
          precio_compra_centavos?: number | null;
          precio_venta_centavos?: number | null;
          se_vende?: boolean;
          stock?: number | null;
          unidad?: string;
        };
        Update: {
          activo?: boolean;
          categoria_id?: string;
          clave?: string | null;
          consumo_diario?: number | null;
          creado_en?: string;
          foto_path?: string | null;
          hotel_id?: string;
          id?: string;
          minimo?: number | null;
          nombre?: string;
          precio_compra_centavos?: number | null;
          precio_venta_centavos?: number | null;
          se_vende?: boolean;
          stock?: number | null;
          unidad?: string;
        };
        Relationships: [
          {
            foreignKeyName: "productos_hotel_id_categoria_id_fkey";
            columns: ["hotel_id", "categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["hotel_id", "id"];
          },
          {
            foreignKeyName: "productos_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
        ];
      };
      reportes_mantenimiento: {
        Row: {
          creado_en: string;
          foto_path: string | null;
          habitacion_id: string;
          hotel_id: string;
          id: string;
          nota: string;
          reportado_por: string | null;
          resuelto_en: string | null;
          resuelto_por: string | null;
        };
        ComputedFields: never;
        Insert: {
          creado_en?: string;
          foto_path?: string | null;
          habitacion_id: string;
          hotel_id: string;
          id?: string;
          nota: string;
          reportado_por?: string | null;
          resuelto_en?: string | null;
          resuelto_por?: string | null;
        };
        Update: {
          creado_en?: string;
          foto_path?: string | null;
          habitacion_id?: string;
          hotel_id?: string;
          id?: string;
          nota?: string;
          reportado_por?: string | null;
          resuelto_en?: string | null;
          resuelto_por?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reportes_mantenimiento_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reportes_mantenimiento_hotel_id_habitacion_id_fkey";
            columns: ["hotel_id", "habitacion_id"];
            isOneToOne: false;
            referencedRelation: "habitaciones";
            referencedColumns: ["hotel_id", "id"];
          },
        ];
      };
      reservas: {
        Row: {
          canal: Database["public"]["Enums"]["canal_venta"];
          check_in_en: string | null;
          check_in_por: string | null;
          check_out_en: string | null;
          check_out_por: string | null;
          codigo: string;
          creado_en: string;
          creado_por: string | null;
          entrada: string;
          estado: Database["public"]["Enums"]["estado_reserva"];
          fuente: Database["public"]["Enums"]["fuente_reserva"];
          habitacion_id: string;
          hotel_id: string;
          huesped_id: string | null;
          ical_uid: string | null;
          id: string;
          mascota: boolean;
          motivo_cancelacion: string | null;
          notas: string | null;
          personas: number;
          salida: string;
          total_centavos: number | null;
          vence_en: string | null;
        };
        ComputedFields: never;
        Insert: {
          canal: Database["public"]["Enums"]["canal_venta"];
          check_in_en?: string | null;
          check_in_por?: string | null;
          check_out_en?: string | null;
          check_out_por?: string | null;
          codigo?: string;
          creado_en?: string;
          creado_por?: string | null;
          entrada: string;
          estado?: Database["public"]["Enums"]["estado_reserva"];
          fuente: Database["public"]["Enums"]["fuente_reserva"];
          habitacion_id: string;
          hotel_id: string;
          huesped_id?: string | null;
          ical_uid?: string | null;
          id?: string;
          mascota?: boolean;
          motivo_cancelacion?: string | null;
          notas?: string | null;
          personas: number;
          salida: string;
          total_centavos?: number | null;
          vence_en?: string | null;
        };
        Update: {
          canal?: Database["public"]["Enums"]["canal_venta"];
          check_in_en?: string | null;
          check_in_por?: string | null;
          check_out_en?: string | null;
          check_out_por?: string | null;
          codigo?: string;
          creado_en?: string;
          creado_por?: string | null;
          entrada?: string;
          estado?: Database["public"]["Enums"]["estado_reserva"];
          fuente?: Database["public"]["Enums"]["fuente_reserva"];
          habitacion_id?: string;
          hotel_id?: string;
          huesped_id?: string | null;
          ical_uid?: string | null;
          id?: string;
          mascota?: boolean;
          motivo_cancelacion?: string | null;
          notas?: string | null;
          personas?: number;
          salida?: string;
          total_centavos?: number | null;
          vence_en?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reservas_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservas_hotel_id_habitacion_id_fkey";
            columns: ["hotel_id", "habitacion_id"];
            isOneToOne: false;
            referencedRelation: "habitaciones";
            referencedColumns: ["hotel_id", "id"];
          },
          {
            foreignKeyName: "reservas_hotel_id_huesped_id_fkey";
            columns: ["hotel_id", "huesped_id"];
            isOneToOne: false;
            referencedRelation: "huespedes";
            referencedColumns: ["hotel_id", "id"];
          },
        ];
      };
      tarifas: {
        Row: {
          canal: Database["public"]["Enums"]["canal_venta"];
          hotel_id: string;
          id: string;
          precio_centavos: number;
          temporada_id: string | null;
          tipo_id: string;
        };
        ComputedFields: never;
        Insert: {
          canal: Database["public"]["Enums"]["canal_venta"];
          hotel_id: string;
          id?: string;
          precio_centavos: number;
          temporada_id?: string | null;
          tipo_id: string;
        };
        Update: {
          canal?: Database["public"]["Enums"]["canal_venta"];
          hotel_id?: string;
          id?: string;
          precio_centavos?: number;
          temporada_id?: string | null;
          tipo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tarifas_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tarifas_hotel_id_temporada_id_fkey";
            columns: ["hotel_id", "temporada_id"];
            isOneToOne: false;
            referencedRelation: "temporadas";
            referencedColumns: ["hotel_id", "id"];
          },
          {
            foreignKeyName: "tarifas_hotel_id_tipo_id_fkey";
            columns: ["hotel_id", "tipo_id"];
            isOneToOne: false;
            referencedRelation: "tipos_habitacion";
            referencedColumns: ["hotel_id", "id"];
          },
        ];
      };
      temporadas: {
        Row: {
          clave: string | null;
          es_base: boolean;
          fechas: unknown;
          hotel_id: string;
          id: string;
          nombre: string;
        };
        ComputedFields: never;
        Insert: {
          clave?: string | null;
          es_base?: boolean;
          fechas?: unknown;
          hotel_id: string;
          id?: string;
          nombre: string;
        };
        Update: {
          clave?: string | null;
          es_base?: boolean;
          fechas?: unknown;
          hotel_id?: string;
          id?: string;
          nombre?: string;
        };
        Relationships: [
          {
            foreignKeyName: "temporadas_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
        ];
      };
      tipos_habitacion: {
        Row: {
          clave: string;
          descripcion: string | null;
          hotel_id: string;
          id: string;
          max_personas: number;
          nombre: string;
          orden: number;
        };
        ComputedFields: never;
        Insert: {
          clave: string;
          descripcion?: string | null;
          hotel_id: string;
          id?: string;
          max_personas: number;
          nombre: string;
          orden?: number;
        };
        Update: {
          clave?: string;
          descripcion?: string | null;
          hotel_id?: string;
          id?: string;
          max_personas?: number;
          nombre?: string;
          orden?: number;
        };
        Relationships: [
          {
            foreignKeyName: "tipos_habitacion_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
        ];
      };
      usuarios_hotel: {
        Row: {
          activo: boolean;
          creado_en: string;
          hotel_id: string;
          nombre: string;
          rol: Database["public"]["Enums"]["rol_usuario"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          creado_en?: string;
          hotel_id: string;
          nombre: string;
          rol: Database["public"]["Enums"]["rol_usuario"];
          user_id: string;
        };
        Update: {
          activo?: boolean;
          creado_en?: string;
          hotel_id?: string;
          nombre?: string;
          rol?: Database["public"]["Enums"]["rol_usuario"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usuarios_hotel_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hoteles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      ajustar_stock: {
        Args: {
          p_cantidad: number;
          p_nota?: string;
          p_producto: string;
          p_tipo: Database["public"]["Enums"]["tipo_movimiento"];
        };
        Returns: number;
      };
      anular_consumo: {
        Args: { p_consumo: string; p_motivo?: string };
        Returns: undefined;
      };
      anular_factura: {
        Args: { p_compra: string; p_motivo?: string };
        Returns: undefined;
      };
      calendario_publico: {
        Args: {
          p_desde: string;
          p_hasta: string;
          p_hotel?: string;
          p_personas: number;
        };
        Returns: {
          cuartos_libres: number;
          desde_centavos: number;
          dia: string;
          temporada_alta: boolean;
        }[];
      };
      cancelar_reserva: {
        Args: { p_motivo?: string; p_reserva: string };
        Returns: undefined;
      };
      cargar_factura: {
        Args: {
          p_fecha: string;
          p_foto_path?: string;
          p_hotel: string;
          p_lineas: Json;
          p_numero: string;
          p_proveedor: string;
        };
        Returns: string;
      };
      catalogo_publico: { Args: { p_hotel?: string }; Returns: Json };
      check_in: { Args: { p_reserva: string }; Returns: undefined };
      check_out: {
        Args: {
          p_medio_consumos?: Database["public"]["Enums"]["medio_pago"];
          p_reserva: string;
        };
        Returns: Json;
      };
      consultar_disponibilidad: {
        Args: {
          p_entrada: string;
          p_hotel?: string;
          p_personas: number;
          p_salida: string;
        };
        Returns: {
          clave: string;
          cuartos_libres: number;
          max_personas: number;
          noches: number;
          nombre: string;
          tipo_id: string;
          total_centavos: number;
        }[];
      };
      crear_prereserva: {
        Args: {
          p_consentimiento: boolean;
          p_entrada: string;
          p_hotel?: string;
          p_mascota?: boolean;
          p_nombre: string;
          p_personas: number;
          p_salida: string;
          p_telefono: string;
          p_tipo_id: string;
        };
        Returns: Json;
      };
      cuadre_dia: {
        Args: { p_fecha?: string; p_hotel: string };
        Returns: Json;
      };
      cuartos_por_limpiar: {
        Args: { p_hotel: string };
        Returns: {
          estado: Database["public"]["Enums"]["estado_habitacion"];
          habitacion_id: string;
          llega_hoy: boolean;
          numero: string;
          piso: number;
          proxima_llegada: string;
          tipo: string;
        }[];
      };
      cuenta_reserva: { Args: { p_reserva: string }; Returns: Json };
      deshacer_limpieza: { Args: { p_habitacion: string }; Returns: undefined };
      empezar_limpieza: { Args: { p_habitacion: string }; Returns: undefined };
      liberar_mantenimiento: {
        Args: { p_habitacion: string };
        Returns: undefined;
      };
      marcar_listo: { Args: { p_habitacion: string }; Returns: undefined };
      ocupacion_ingresos: {
        Args: { p_dias?: number; p_hotel: string };
        Returns: {
          canal: Database["public"]["Enums"]["canal_venta"];
          cuartos_ocupados: number;
          cuartos_totales: number;
          dia: string;
          ingresos_centavos: number;
        }[];
      };
      registrar_consumo: {
        Args: {
          p_cantidad: number;
          p_medio?: Database["public"]["Enums"]["medio_pago"];
          p_producto: string;
          p_reserva?: string;
        };
        Returns: string;
      };
      registrar_pago: {
        Args: {
          p_comprobante_path?: string;
          p_medio: Database["public"]["Enums"]["medio_pago"];
          p_monto_centavos: number;
          p_reserva: string;
        };
        Returns: string;
      };
      reportar_dano: {
        Args: { p_foto_path?: string; p_habitacion: string; p_nota: string };
        Returns: string;
      };
      resumen_inicio: { Args: { p_hotel: string }; Returns: Json };
    };
    Enums: {
      canal_venta: "directo" | "booking" | "airbnb";
      estado_habitacion:
        "libre" | "ocupado" | "por_limpiar" | "limpiando" | "mantenimiento";
      estado_reserva:
        "prereserva" | "confirmada" | "en_curso" | "finalizada" | "cancelada";
      fuente_reserva:
        "whatsapp" | "telefono" | "web" | "booking" | "airbnb" | "walk_in";
      kit_por: "limpieza" | "persona";
      medio_pago: "efectivo" | "transferencia";
      rol_usuario: "duena" | "recepcion" | "limpieza";
      tipo_alerta:
        | "stock_bajo"
        | "por_limpiar"
        | "mantenimiento"
        | "cuarto_no_listo"
        | "conflicto_ical";
      tipo_movimiento:
        | "compra"
        | "limpieza"
        | "venta"
        | "merma"
        | "conteo"
        | "anulacion"
        | "consumo_diario";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      canal_venta: ["directo", "booking", "airbnb"],
      estado_habitacion: [
        "libre",
        "ocupado",
        "por_limpiar",
        "limpiando",
        "mantenimiento",
      ],
      estado_reserva: [
        "prereserva",
        "confirmada",
        "en_curso",
        "finalizada",
        "cancelada",
      ],
      fuente_reserva: [
        "whatsapp",
        "telefono",
        "web",
        "booking",
        "airbnb",
        "walk_in",
      ],
      kit_por: ["limpieza", "persona"],
      medio_pago: ["efectivo", "transferencia"],
      rol_usuario: ["duena", "recepcion", "limpieza"],
      tipo_alerta: [
        "stock_bajo",
        "por_limpiar",
        "mantenimiento",
        "cuarto_no_listo",
        "conflicto_ical",
      ],
      tipo_movimiento: [
        "compra",
        "limpieza",
        "venta",
        "merma",
        "conteo",
        "anulacion",
        "consumo_diario",
      ],
    },
  },
} as const;

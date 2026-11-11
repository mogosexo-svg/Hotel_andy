interface Fallo {
  message: string;
  code?: string;
}

/** Mensajes de negocio (P0001) llegan en español: se muestran tal cual. El resto, en palabras humanas. */
export function mensajeError(e: Fallo | null | undefined): string {
  if (!e) return 'Algo salió mal. Intenta otra vez.';
  if (e.code === 'P0001') return e.message;
  if (e.code === '42501') return 'Tu usuario no tiene permiso para hacer esto.';
  if (e.code === '23P01') return 'Ese cuarto ya está reservado en esas fechas.';
  if (/invalid login/i.test(e.message)) return 'El correo o la contraseña no coinciden. Revísalos e intenta otra vez.';
  if (/failed to fetch|network|load failed/i.test(e.message))
    return 'No hay conexión. Revisa tu señal e intenta otra vez.';
  return 'No pudimos completar la acción. Intenta otra vez en un momento.';
}

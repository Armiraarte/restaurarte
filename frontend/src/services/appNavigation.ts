export type AppInicio = 'meseros' | 'caja';

export function appActual(): AppInicio {
  return /^\/tablet(?:\/|$)/.test(window.location.pathname) ? 'meseros' : 'caja';
}

/** Cambia de app dentro del mismo documento para conservar la ventana instalada y la pantalla completa. */
export function navegarApp(app: AppInicio, { formulario = false, reemplazar = false } = {}) {
  const ruta = app === 'meseros' ? '/tablet' : '/';
  const destino = formulario ? `${ruta}?app=${app}` : ruta;
  if (reemplazar) window.history.replaceState(null, '', destino);
  else window.history.pushState(null, '', destino);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

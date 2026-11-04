const appManifest = require('../../app.json');

const expoConfig = appManifest?.expo || {};

/**
 * Identidad y metadatos visibles del producto.
 * Mantener este archivo como única fuente para el login y futuras pantallas
 * de soporte. La versión se obtiene de app.json para evitar duplicaciones.
 */
export const PRODUCT_CONFIG = {
  id: expoConfig.slug || 'takeordersks',
  name: expoConfig.name || 'TakeOrdersKS',
  logo: require('../../assets/branding/takeorders-logo.png'),
  subtitle: 'Sistema de gestión gastronómica',
  tagline: 'Gestión gastronómica profesional',
  version: expoConfig.version || '0.0.0',
  branding: {
    primary: '#356A4B',
    primaryDark: '#183B2A',
    primaryBright: '#5A9870',
    background: '#07130D',
  },
  attribution: {
    prefix: 'Desarrollado por',
    label: 'manageopy',
    url: 'https://manageopy.com',
  },
};

export const APP_VERSION_LABEL = `v${PRODUCT_CONFIG.version}`;

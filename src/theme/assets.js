/**
 * ADMINISTRADOR DE IMÁGENES DEL MENÚ (Assets)
 *
 * Imágenes locales importadas con require() para las pizzas y hamburguesas.
 * Para URLs externas (Unsplash), se usan strings directamente en PRODUCT_IMAGES.
 */

// --- Imágenes locales ---
const LOCAL_IMAGES = {
  pizza_muzzarella: require('./products/pizza_muzzarella.jpg'),
  pizza_napolitana: require('./products/pizza_napolitana.jpg'),
  pizza_pepperoni: require('./products/pizza_pepperoni.jpg'),
  pizza_choclo: require('./products/pizza_choclo.jpg'),
  pizza_katupiry: require('./products/pizza_katupiry.jpg'),
  pizza_jyq: require('./products/pizza_jyq.png'),
  hamburguesa_doble: require('./products/hamburguesa-doble.webp'),
  hamburguesa_sencilla: require('./products/hamburguesa-sencilla.jpg'),
};

export const APP_ICONS = {
  todos: require('./Assets/todos.png'),
  lomito: require('./Assets/lomito.png'),
  hamburguesa: require('./Assets/hamburguesa.png'),
  pizza: require('./Assets/pizza.png'),
  papas: require('./Assets/papas-fritas.png'),
  bebidas: require('./Assets/bebidas.png'),
  extras: require('./Assets/extras.png'),
  kitchen: require('./Assets/kitchen.png'),
  logout: require('./Assets/logout.png'),
  reload: require('./Assets/reload.png'),
  statistics: require('./Assets/statistics.png'),
  userDefault: require('./Assets/userDefault.png'),
  admin: require('./Assets/admin.png'),
};

export const PRODUCT_IMAGES = {
  // Categoría: Lomitos
  lomo: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=300&auto=format&fit=crop&q=80',
  sandwich: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=300&auto=format&fit=crop&q=80',
  sándwich: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=300&auto=format&fit=crop&q=80',

  // Categoría: Hamburguesas
  hamburguesa: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&auto=format&fit=crop&q=80',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&auto=format&fit=crop&q=80',

  // Categoría: Pizzas (genérica como fallback)
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&auto=format&fit=crop&q=80',

  // Categoría: Papas Fritas
  papas: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300&auto=format&fit=crop&q=80',
  fritas: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300&auto=format&fit=crop&q=80',

  // Categoría: Bebidas
  coca: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300&auto=format&fit=crop&q=80',
  gaseosa: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300&auto=format&fit=crop&q=80',
  refresco: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300&auto=format&fit=crop&q=80',
  bebida: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?w=300&auto=format&fit=crop&q=80',
  cerveza: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=300&auto=format&fit=crop&q=80',
  beer: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=300&auto=format&fit=crop&q=80',
  jugo: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=300&auto=format&fit=crop&q=80',
  agua: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=300&auto=format&fit=crop&q=80',

  // Categoría: Extras / Postres
  cafe: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&auto=format&fit=crop&q=80',
  café: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&auto=format&fit=crop&q=80',
  helado: 'https://images.unsplash.com/photo-1501443782907-f74122d882d3?w=300&auto=format&fit=crop&q=80',
  postre: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=300&auto=format&fit=crop&q=80',
  pollo: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=300&auto=format&fit=crop&q=80',
  empanada: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=300&auto=format&fit=crop&q=80',
  ensalada: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&auto=format&fit=crop&q=80',

  // Imagen genérica por defecto
  default: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=300&auto=format&fit=crop&q=80'
};

/**
 * Retorna la imagen que corresponde al nombre del producto.
 * Siempre retorna un valor válido para el prop `source` de <Image>:
 * - Imágenes locales (require): se retornan como número directamente.
 * - URLs remotas: se retornan como { uri: '...' }.
 * @param {string} name Nombre del producto.
 * @returns {number|{uri: string}} Fuente de imagen válida para React Native.
 */
export const getProductImage = (name) => {
  if (!name) return { uri: PRODUCT_IMAGES.default };
  const normalized = name.toLowerCase();

  // 1. Coincidencias específicas con imágenes locales (más precisas, van primero)
  if (normalized.includes('muzzarella') || normalized.includes('mozzarella')) return LOCAL_IMAGES.pizza_muzzarella;
  if (normalized.includes('napolitana'))   return LOCAL_IMAGES.pizza_napolitana;
  if (normalized.includes('pepperoni'))    return LOCAL_IMAGES.pizza_pepperoni;
  if (normalized.includes('choclo'))       return LOCAL_IMAGES.pizza_choclo;
  if (normalized.includes('katupiry'))     return LOCAL_IMAGES.pizza_katupiry;
  if (normalized.includes('jyq') || normalized.includes('j&q') || normalized.includes('j y q')) return LOCAL_IMAGES.pizza_jyq;
  if (normalized.includes('doble'))        return LOCAL_IMAGES.hamburguesa_doble;
  if (normalized.includes('sencilla') || normalized.includes('simple')) return LOCAL_IMAGES.hamburguesa_sencilla;

  // 2. Búsqueda genérica por palabra clave en PRODUCT_IMAGES (URLs remotas)
  for (const key of Object.keys(PRODUCT_IMAGES)) {
    if (key !== 'default' && normalized.includes(key)) {
      return { uri: PRODUCT_IMAGES[key] };
    }
  }

  return { uri: PRODUCT_IMAGES.default };
};

/**
 * Retorna la imagen de icono que corresponde al nombre de la categoría.
 * @param {string} name Nombre de la categoría.
 * @returns {number} Recurso local importado con require().
 */
export const getCategoryIcon = (name) => {
  if (!name) return APP_ICONS.todos;
  const normalized = name.toLowerCase();
  if (normalized.includes('todos')) return APP_ICONS.todos;
  if (normalized.includes('lomito')) return APP_ICONS.lomito;
  if (normalized.includes('hamburguesa') || normalized.includes('burger')) return APP_ICONS.hamburguesa;
  if (normalized.includes('pizza')) return APP_ICONS.pizza;
  if (normalized.includes('papas') || normalized.includes('fritas')) return APP_ICONS.papas;
  if (normalized.includes('bebida') || normalized.includes('refresco') || normalized.includes('gaseosa')) return APP_ICONS.bebidas;
  if (normalized.includes('extra') || normalized.includes('postre')) return APP_ICONS.extras;
  return APP_ICONS.todos;
};

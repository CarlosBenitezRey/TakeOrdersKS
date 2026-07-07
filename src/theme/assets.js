/**
 * ADMINISTRADOR DE IMÁGENES DEL MENÚ (Assets)
 * 
 * En este archivo puedes mapear las palabras clave de los nombres de tus productos
 * con enlaces a imágenes PNG/SVG/JPG, o recursos locales importados con 'require()'.
 * 
 * Si deseas usar imágenes locales en el futuro, puedes importarlas así:
 * import hamburguesaImg from '../../assets/hamburguesa.png';
 * y luego asignarla en la lista: burger: hamburguesaImg
 */

export const PRODUCT_IMAGES = {
  // Categoría: Lomitos
  lomo: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=300&auto=format&fit=crop&q=80',
  sandwich: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=300&auto=format&fit=crop&q=80',
  sándwich: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=300&auto=format&fit=crop&q=80',

  // Categoría: Hamburguesas
  hamburguesa: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&auto=format&fit=crop&q=80',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&auto=format&fit=crop&q=80',

  // Categoría: Pizzas
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
 * Retorna la URL de imagen o recurso que coincida con el nombre del producto.
 * @param {string} name Nombre del producto.
 * @returns {string|number} Enlace web o recurso de imagen.
 */
export const getProductImage = (name) => {
  if (!name) return PRODUCT_IMAGES.default;
  const normalized = name.toLowerCase();
  
  // Buscar coincidencia por palabra clave
  for (const key of Object.keys(PRODUCT_IMAGES)) {
    if (key !== 'default' && normalized.includes(key)) {
      return PRODUCT_IMAGES[key];
    }
  }
  
  return PRODUCT_IMAGES.default;
};

import productoRepository from '../repositories/ProductoRepository';

/**
 * ProductService
 * Lógica de negocio relacionada con el catálogo de productos:
 * carga del catálogo, filtrado, búsqueda, validaciones y operaciones CRUD de CMS.
 */
class ProductService {
  /**
   * Carga el catálogo completo: productos, categorías y sucursales en paralelo.
   * Inyecta la categoría "Todos" al inicio de la lista de categorías.
   *
   * @returns {Promise<{
   *   productos: Array,
   *   categorias: Array,  // incluye {id: 'all', nombre: 'Todos'} al inicio
   *   sucursales: Array
   * }>}
   */
  async cargarCatalogo() {
    const [productos, categorias, sucursales] = await Promise.all([
      productoRepository.getAll(),
      productoRepository.getCategorias(),
      productoRepository.getSucursales(),
    ]);

    // Inyectar categoría "Todos" al inicio de la lista
    const categoriasConTodos = [
      { id: 'all', nombre: 'Todos' },
      ...categorias,
    ];

    return { productos, categorias: categoriasConTodos, sucursales };
  }

  /**
   * Filtra una lista de productos según una búsqueda de texto y/o categoría.
   * Esta función es pura y no tiene efectos secundarios.
   *
   * @param {Array}  productos       - Lista completa de productos.
   * @param {string} searchQuery     - Texto de búsqueda (puede estar vacío).
   * @param {string} categoriaId     - ID de la categoría o 'all' para todas.
   * @returns {Array} Lista de productos que cumplen ambos filtros.
   */
  filtrar(productos, searchQuery, categoriaId) {
    const query = (searchQuery || '').trim().toLowerCase();

    return productos.filter((producto) => {
      const coincideBusqueda =
        !query ||
        producto.nombre?.toLowerCase().includes(query) ||
        producto.descripcion?.toLowerCase().includes(query);

      const coincideCategoria =
        categoriaId === 'all' || producto.categoria_id === categoriaId;

      return coincideBusqueda && coincideCategoria;
    });
  }

  /**
   * Obtiene la lista de todas las sucursales registradas.
   * @returns {Promise<Array>} Lista de sucursales.
   */
  async getSucursales() {
    return await productoRepository.getSucursales();
  }

  /**
   * Calcula métricas y KPIs del catálogo para el CMS.
   * @param {Array} productos 
   * @param {Array} categorias 
   * @returns {object} KPIs calculados
   */
  getKpisCatalogo(productos = [], categorias = []) {
    const totalPlatos = productos.length;
    const disponibles = productos.filter((p) => p.disponible !== false).length;
    const pausados = totalPlatos - disponibles;

    const categoriasReales = categorias.filter((c) => c.id !== 'all');
    const totalCategorias = categoriasReales.length;

    const sumaPrecios = productos.reduce((acc, p) => acc + Number(p.precio || 0), 0);
    const precioPromedio = totalPlatos > 0 ? Math.round(sumaPrecios / totalPlatos) : 0;

    return {
      totalPlatos,
      disponibles,
      pausados,
      totalCategorias,
      precioPromedio,
    };
  }

  // ─── Operaciones CRUD de Productos ──────────────────────────────────────────

  /**
   * Valida y crea un nuevo producto en el catálogo.
   * @param {object} datos - { nombre, precio, categoria_id, descripcion, imagen_url, disponible }
   * @returns {Promise<object>}
   */
  async crearProducto(datos) {
    if (!datos.nombre || !datos.nombre.trim()) {
      throw new Error('El nombre del plato es obligatorio');
    }

    const precioNum = Number(datos.precio);
    if (isNaN(precioNum) || precioNum <= 0) {
      throw new Error('El precio debe ser un número mayor a 0');
    }

    if (!datos.categoria_id) {
      throw new Error('Debes seleccionar una categoría para el plato');
    }

    const payload = {
      nombre: datos.nombre.trim(),
      precio: Math.round(precioNum),
      categoria_id: datos.categoria_id,
      descripcion: datos.descripcion?.trim() || null,
      imagen_url: datos.imagen_url?.trim() || null,
      disponible: datos.disponible !== false,
    };

    return await productoRepository.crearProducto(payload);
  }

  /**
   * Valida y actualiza los datos de un plato existente.
   * @param {string|number} id
   * @param {object} datos
   * @returns {Promise<object>}
   */
  async actualizarProducto(id, datos) {
    if (!id) throw new Error('Se requiere el ID del plato');

    if (!datos.nombre || !datos.nombre.trim()) {
      throw new Error('El nombre del plato no puede estar vacío');
    }

    const precioNum = Number(datos.precio);
    if (isNaN(precioNum) || precioNum <= 0) {
      throw new Error('El precio debe ser un número mayor a 0');
    }

    if (!datos.categoria_id) {
      throw new Error('Debes seleccionar una categoría válida');
    }

    const payload = {
      nombre: datos.nombre.trim(),
      precio: Math.round(precioNum),
      categoria_id: datos.categoria_id,
      descripcion: datos.descripcion?.trim() || null,
      imagen_url: datos.imagen_url?.trim() || null,
      disponible: datos.disponible !== false,
    };

    return await productoRepository.actualizarProducto(id, payload);
  }

  /**
   * Modificación rápida atómica de precio en Gs.
   * @param {string|number} id
   * @param {number|string} nuevoPrecio
   * @returns {Promise<object>}
   */
  async actualizarPrecio(id, nuevoPrecio) {
    if (!id) throw new Error('Se requiere el ID del plato');

    const precioNum = Number(nuevoPrecio);
    if (isNaN(precioNum) || precioNum <= 0) {
      throw new Error('El precio debe ser un número positivo');
    }

    return await productoRepository.actualizarPrecio(id, Math.round(precioNum));
  }

  /**
   * Alterna la disponibilidad de un plato (Activar / Pausar por falta de insumos).
   * @param {string|number} id
   * @param {boolean} nuevoEstado
   * @returns {Promise<object>}
   */
  async toggleDisponibilidad(id, nuevoEstado) {
    if (!id) throw new Error('Se requiere el ID del plato');
    return await productoRepository.toggleDisponibilidad(id, nuevoEstado);
  }

  /**
   * Elimina un plato del catálogo.
   * @param {string|number} id
   * @returns {Promise<boolean>}
   */
  async eliminarProducto(id) {
    if (!id) throw new Error('Se requiere el ID del plato a eliminar');
    return await productoRepository.eliminarProducto(id);
  }

  // ─── Operaciones CRUD de Categorías ─────────────────────────────────────────

  /**
   * Valida y crea una nueva categoría.
   * @param {object} datos - { nombre }
   * @returns {Promise<object>}
   */
  async crearCategoria(datos) {
    if (!datos.nombre || !datos.nombre.trim()) {
      throw new Error('El nombre de la categoría es obligatorio');
    }

    const payload = {
      nombre: datos.nombre.trim(),
    };

    return await productoRepository.crearCategoria(payload);
  }

  /**
   * Valida y actualiza el nombre de una categoría.
   * @param {string|number} id
   * @param {object} datos
   * @returns {Promise<object>}
   */
  async actualizarCategoria(id, datos) {
    if (!id) throw new Error('Se requiere el ID de la categoría');
    if (!datos.nombre || !datos.nombre.trim()) {
      throw new Error('El nombre de la categoría no puede estar vacío');
    }

    const payload = {
      nombre: datos.nombre.trim(),
    };

    return await productoRepository.actualizarCategoria(id, payload);
  }

  /**
   * Elimina una categoría verificando que no posea productos asociados.
   * @param {string|number} id
   * @param {Array} productosActuales
   * @returns {Promise<boolean>}
   */
  async eliminarCategoria(id, productosActuales = []) {
    if (!id) throw new Error('Se requiere el ID de la categoría');

    const productosAsociados = productosActuales.filter((p) => p.categoria_id === id);
    if (productosAsociados.length > 0) {
      throw new Error(
        `No se puede eliminar la categoría porque tiene ${productosAsociados.length} plato(s) asociado(s). Reasigna los platos primero.`
      );
    }

    return await productoRepository.eliminarCategoria(id);
  }
}

// Exportar como Singleton
export default new ProductService();

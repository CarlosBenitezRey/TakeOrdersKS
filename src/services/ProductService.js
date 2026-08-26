import productoRepository from '../repositories/ProductoRepository';

/**
 * ProductService
 * Lógica de negocio relacionada con el catálogo de productos:
 * carga del catálogo, filtrado y búsqueda.
 */
class ProductService {
  /**
   * Carga el catálogo completo: productos, categorías y sucursales en paralelo.
   * Inyecta la categoría "Todos" al inicio de la lista de categorías.
   *
   * @returns {{
   *   productos: Array,
   *   categorias: Array,  // incluye {id: 'all', nombre: 'Todos'} al inicio
   *   sucursales: Array
   * }}
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
    return productos.filter((producto) => {
      const coincideBusqueda = producto.nombre
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const coincideCategoria =
        categoriaId === 'all' || producto.categoria_id === categoriaId;

      return coincideBusqueda && coincideCategoria;
    });
  }
}

// Exportar como Singleton
export default new ProductService();

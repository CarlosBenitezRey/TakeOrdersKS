import { supabase } from '../services/supabase';

/**
 * ProductoRepository
 * Responsable de todas las operaciones de base de datos
 * sobre las tablas `productos`, `categorias` y `sucursales`.
 */
class ProductoRepository {
  // ─── Consultas de Catálogo ──────────────────────────────────────────────────

  /**
   * Obtiene todos los productos con el nombre de su categoría asociada.
   * @returns {Promise<Array>} Lista de productos.
   */
  async getAll() {
    const { data, error } = await supabase
      .from('productos')
      .select(`
        *,
        categorias (
          id,
          nombre
        )
      `)
      .order('nombre', { ascending: true });

    if (error) {
      // Si la relación falla por esquema antiguo, fallback a select simple
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });

      if (fallbackError) throw fallbackError;
      return fallbackData || [];
    }

    return data || [];
  }

  /**
   * Obtiene todas las categorías ordenadas por nombre.
   * @returns {Promise<Array>} Lista de categorías.
   */
  async getCategorias() {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Obtiene todas las sucursales registradas.
   * @returns {Promise<Array>} Lista de sucursales.
   */
  async getSucursales() {
    const { data, error } = await supabase
      .from('sucursales')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // ─── ABM de Productos (Platos) ──────────────────────────────────────────────

  /**
   * Inserta un nuevo producto en la base de datos.
   * @param {object} productoData - { nombre, precio, categoria_id, descripcion, imagen_url, disponible }
   * @returns {Promise<object>} Producto recién creado.
   */
  async crearProducto(productoData) {
    const { data, error } = await supabase
      .from('productos')
      .insert(productoData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Actualiza los datos de un producto existente.
   * @param {string|number} id - ID del producto.
   * @param {object} productoData - Campos a actualizar.
   * @returns {Promise<object>} Producto actualizado.
   */
  async actualizarProducto(id, productoData) {
    const { data, error } = await supabase
      .from('productos')
      .update(productoData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Actualización atómica rápida del precio de un plato.
   * @param {string|number} id - ID del producto.
   * @param {number} nuevoPrecio - Monto en Guaraníes.
   * @returns {Promise<object>}
   */
  async actualizarPrecio(id, nuevoPrecio) {
    const { data, error } = await supabase
      .from('productos')
      .update({ precio: Number(nuevoPrecio) })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Alterna la disponibilidad de un producto (Disponible / Agotado).
   * @param {string|number} id - ID del producto.
   * @param {boolean} disponible - true o false.
   * @returns {Promise<object>}
   */
  async toggleDisponibilidad(id, disponible) {
    const { data, error } = await supabase
      .from('productos')
      .update({ disponible: Boolean(disponible) })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Elimina un producto de la carta.
   * @param {string|number} id - ID del producto a eliminar.
   * @returns {Promise<boolean>}
   */
  async eliminarProducto(id) {
    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  // ─── ABM de Categorías ──────────────────────────────────────────────────────

  /**
   * Inserta una nueva categoría en la base de datos.
   * @param {object} categoriaData - { nombre }
   * @returns {Promise<object>} Categoría creada.
   */
  async crearCategoria(categoriaData) {
    const { data, error } = await supabase
      .from('categorias')
      .insert(categoriaData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Actualiza el nombre de una categoría existente.
   * @param {string|number} id - ID de la categoría.
   * @param {object} categoriaData - { nombre }
   * @returns {Promise<object>} Categoría actualizada.
   */
  async actualizarCategoria(id, categoriaData) {
    const { data, error } = await supabase
      .from('categorias')
      .update(categoriaData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Elimina una categoría.
   * @param {string|number} id - ID de la categoría.
   * @returns {Promise<boolean>}
   */
  async eliminarCategoria(id) {
    const { error } = await supabase
      .from('categorias')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
}

// Exportar como Singleton
export default new ProductoRepository();

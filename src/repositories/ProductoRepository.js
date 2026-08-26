import { supabase } from '../services/supabase';

/**
 * ProductoRepository
 * Único responsable de todas las operaciones de base de datos
 * sobre las tablas `productos`, `categorias` y `sucursales`.
 */
class ProductoRepository {
  /**
   * Obtiene todos los productos disponibles.
   * @returns {Array} Lista de productos.
   */
  async getAll() {
    const { data, error } = await supabase
      .from('productos')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  /**
   * Obtiene todas las categorías.
   * @returns {Array} Lista de categorías.
   */
  async getCategorias() {
    const { data, error } = await supabase
      .from('categorias')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  /**
   * Obtiene todas las sucursales registradas.
   * @returns {Array} Lista de sucursales.
   */
  async getSucursales() {
    const { data, error } = await supabase
      .from('sucursales')
      .select('*');

    if (error) throw error;
    return data || [];
  }
}

// Exportar como Singleton
export default new ProductoRepository();

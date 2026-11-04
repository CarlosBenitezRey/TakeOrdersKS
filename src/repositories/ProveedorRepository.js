import { supabase } from '../services/supabase';

/**
 * ProveedorRepository
 * Único responsable de todas las operaciones de base de datos
 * sobre la tabla `proveedores`.
 */
class ProveedorRepository {
  /**
   * Obtiene todos los proveedores activos, opcionalmente filtrados por sucursal.
   * Si sucursal_id es null en la BD, se considera un proveedor general/global.
   * @param {string|null} sucursalId - ID de sucursal para filtrar.
   * @returns {Array} Lista de proveedores activos.
   */
  async getActivos(sucursalId = null) {
    let query = supabase
      .from('proveedores')
      .select(`
        *,
        sucursales ( nombre )
      `)
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (sucursalId && sucursalId !== 'all') {
      // Filtrar proveedores de la sucursal o proveedores generales (sucursal_id is null)
      query = query.or(`sucursal_id.eq.${sucursalId},sucursal_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Obtiene todos los proveedores (activos e inactivos).
   * @returns {Array} Lista completa.
   */
  async getTodos() {
    const { data, error } = await supabase
      .from('proveedores')
      .select(`*, sucursales ( nombre )`)
      .order('nombre', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Crea un nuevo proveedor en la base de datos.
   * @param {object} proveedorData - Datos del proveedor.
   * @returns {object} El registro insertado.
   */
  async crear(proveedorData) {
    const { data, error } = await supabase
      .from('proveedores')
      .insert(proveedorData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Actualiza los datos de un proveedor existente.
   * @param {string} id - UUID del proveedor.
   * @param {object} proveedorData - Campos a actualizar.
   * @returns {object} El registro actualizado.
   */
  async actualizar(id, proveedorData) {
    const { data, error } = await supabase
      .from('proveedores')
      .update(proveedorData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Da de baja lógica a un proveedor (soft delete: activo = false).
   * @param {string} id - UUID del proveedor.
   */
  async darDeBaja(id) {
    const { error } = await supabase
      .from('proveedores')
      .update({ activo: false })
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Reactiva un proveedor previamente dado de baja.
   * @param {string} id - UUID del proveedor.
   */
  async reactivar(id) {
    const { error } = await supabase
      .from('proveedores')
      .update({ activo: true })
      .eq('id', id);

    if (error) throw error;
  }
}

// Exportar como Singleton
export default new ProveedorRepository();

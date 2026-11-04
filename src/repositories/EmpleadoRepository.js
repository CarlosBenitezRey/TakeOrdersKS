import { supabase } from '../services/supabase';

/**
 * EmpleadoRepository
 * Único responsable de todas las operaciones de base de datos
 * sobre la tabla `empleados`.
 */
class EmpleadoRepository {
  /**
   * Obtiene todos los empleados activos, con datos de su sucursal.
   * @param {string|null} sucursalId - Filtra por sucursal. Si es null, trae todos.
   * @returns {Array} Lista de empleados activos.
   */
  async getActivos(sucursalId = null) {
    let query = supabase
      .from('empleados')
      .select(`
        *,
        sucursales ( nombre )
      `)
      .neq('activo', false)
      .order('nombre', { ascending: true });

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Fallback en getActivos empleados sin join:', error.message);
      let fallback = supabase
        .from('empleados')
        .select('*')
        .neq('activo', false)
        .order('nombre', { ascending: true });

      if (sucursalId) {
        fallback = fallback.eq('sucursal_id', sucursalId);
      }

      const { data: fallbackData, error: fallbackError } = await fallback;
      if (fallbackError) throw fallbackError;
      return fallbackData || [];
    }
    return data || [];
  }

  /**
   * Obtiene todos los empleados (activos e inactivos), útil para reportes.
   * @returns {Array} Lista completa de empleados.
   */
  async getTodos() {
    const { data, error } = await supabase
      .from('empleados')
      .select(`*, sucursales ( nombre )`)
      .order('nombre', { ascending: true });

    if (error) {
      console.warn('Fallback en getTodos empleados sin join:', error.message);
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('empleados')
        .select('*')
        .order('nombre', { ascending: true });

      if (fallbackError) throw fallbackError;
      return fallbackData || [];
    }
    return data || [];
  }

  /**
   * Crea un nuevo empleado.
   * @param {object} empleadoData - Datos del empleado a crear.
   * @returns {object} El empleado recién creado.
   */
  async crear(empleadoData) {
    const { data, error } = await supabase
      .from('empleados')
      .insert(empleadoData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Actualiza los datos de un empleado existente.
   * @param {string} id            - UUID del empleado.
   * @param {object} empleadoData  - Campos a actualizar.
   * @returns {object} El empleado actualizado.
   */
  async actualizar(id, empleadoData) {
    const { data, error } = await supabase
      .from('empleados')
      .update(empleadoData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Da de baja a un empleado (soft delete: marca activo = false).
   * Los datos históricos (salarios, etc.) se preservan.
   * @param {string} id - UUID del empleado.
   */
  async darDeBaja(id) {
    const { error } = await supabase
      .from('empleados')
      .update({ activo: false })
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Reactiva un empleado previamente dado de baja.
   * @param {string} id - UUID del empleado.
   */
  async reactivar(id) {
    const { error } = await supabase
      .from('empleados')
      .update({ activo: true })
      .eq('id', id);

    if (error) throw error;
  }
}

// Exportar como Singleton
export default new EmpleadoRepository();

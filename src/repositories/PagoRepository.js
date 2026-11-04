import { supabase } from '../services/supabase';

/**
 * PagoRepository
 * Responsable exclusivo de las operaciones de base de datos
 * sobre las tablas `pagos_salarios` y `pagos_proveedores`.
 */
class PagoRepository {
  // ─── Pagos de Salarios (RR.HH.) ──────────────────────────────────────────────

  /**
   * Obtiene el listado de pagos de salarios, con información del empleado y sucursal.
   * @param {string|null} sucursalId - ID de la sucursal o 'all'.
   * @param {string|null} periodo    - Período a filtrar (ej: '2026-10').
   * @returns {Array} Lista de pagos de salarios.
   */
  async getPagosSalarios(sucursalId = null, periodo = null) {
    let query = supabase
      .from('pagos_salarios')
      .select(`
        *,
        empleados (
          id,
          nombre,
          rol,
          sueldo_base,
          sucursal_id,
          sucursales ( nombre )
        )
      `)
      .order('fecha_pago', { ascending: false });

    if (periodo) {
      query = query.eq('periodo', periodo);
    }

    const { data, error } = await query;
    if (error) throw error;

    let resultado = data || [];

    // Si se especifica sucursal, filtrar por la sucursal del empleado
    if (sucursalId && sucursalId !== 'all') {
      resultado = resultado.filter(
        (p) => p.empleados?.sucursal_id === sucursalId
      );
    }

    return resultado;
  }

  /**
   * Registra un nuevo pago de salario.
   * @param {object} pagoData - Datos del pago de salario.
   * @returns {object} El registro creado.
   */
  async crearPagoSalario(pagoData) {
    const { data, error } = await supabase
      .from('pagos_salarios')
      .insert(pagoData)
      .select(`
        *,
        empleados (
          id,
          nombre,
          rol,
          sueldo_base,
          sucursales ( nombre )
        )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Elimina un pago de salario registrado.
   * @param {string} id - UUID del pago.
   */
  async eliminarPagoSalario(id) {
    const { error } = await supabase
      .from('pagos_salarios')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ─── Pagos a Proveedores (Egresos Operativos) ─────────────────────────────────

  /**
   * Obtiene el listado de pagos/facturas de proveedores.
   * @param {string|null} sucursalId - ID de sucursal o 'all'.
   * @param {string|null} estado     - 'pagado' o 'pendiente' (null = todos).
   * @returns {Array} Lista de pagos a proveedores.
   */
  async getPagosProveedores(sucursalId = null, estado = null) {
    let query = supabase
      .from('pagos_proveedores')
      .select(`
        *,
        proveedores (
          id,
          nombre,
          ruc,
          categoria,
          telefono
        ),
        sucursales ( nombre )
      `)
      .order('fecha', { ascending: false });

    if (sucursalId && sucursalId !== 'all') {
      query = query.eq('sucursal_id', sucursalId);
    }

    if (estado) {
      query = query.eq('estado', estado);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Registra una nueva factura/pago a proveedor.
   * @param {object} pagoData - Datos del egreso con proveedor.
   * @returns {object} El registro insertado.
   */
  async crearPagoProveedor(pagoData) {
    const { data, error } = await supabase
      .from('pagos_proveedores')
      .insert(pagoData)
      .select(`
        *,
        proveedores (
          id,
          nombre,
          ruc,
          categoria
        ),
        sucursales ( nombre )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Actualiza el estado de una factura de proveedor (ej. de 'pendiente' a 'pagado').
   * @param {string} id     - UUID del registro.
   * @param {string} estado - Nuevo estado ('pagado'|'pendiente').
   * @returns {object} Registro actualizado.
   */
  async actualizarEstadoPagoProveedor(id, estado) {
    const { data, error } = await supabase
      .from('pagos_proveedores')
      .update({ estado })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Elimina un registro de pago/factura a proveedor.
   * @param {string} id - UUID del registro.
   */
  async eliminarPagoProveedor(id) {
    const { error } = await supabase
      .from('pagos_proveedores')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}

// Exportar como Singleton
export default new PagoRepository();

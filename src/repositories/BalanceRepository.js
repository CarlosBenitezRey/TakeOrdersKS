import { supabase } from '../services/supabase';

/**
 * BalanceRepository
 * Capa de acceso a datos para consolidar información financiera:
 * ventas (pedidos), egresos de nómina (pagos_salarios) y egresos operativos (pagos_proveedores).
 */
class BalanceRepository {
  /**
   * Obtiene los pedidos realizados dentro de un rango de fechas y sucursal.
   *
   * @param {string|null} fechaDesde - ISO string o null para sin límite inferior.
   * @param {string|null} fechaHasta - ISO string o null para sin límite superior.
   * @param {string|null} sucursalId - UUID de la sucursal o 'all'.
   * @returns {Promise<Array>} Lista de pedidos con detalles de productos.
   */
  async getPedidosPorRango(fechaDesde = null, fechaHasta = null, sucursalId = null) {
    let query = supabase
      .from('pedidos')
      .select(`
        id,
        total,
        metodo_pago,
        sucursal_id,
        created_at,
        estado,
        mesa,
        cliente,
        detalle_pedido (
          cantidad,
          precio,
          producto_id,
          productos ( nombre )
        )
      `)
      .order('created_at', { ascending: false });

    if (fechaDesde) {
      query = query.gte('created_at', fechaDesde);
    }
    if (fechaHasta) {
      query = query.lte('created_at', fechaHasta);
    }
    if (sucursalId && sucursalId !== 'all') {
      query = query.eq('sucursal_id', sucursalId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Obtiene los pagos de salarios registrados en un rango de fechas.
   *
   * @param {string|null} fechaDesdeStr - Formato 'YYYY-MM-DD' o null.
   * @param {string|null} fechaHastaStr - Formato 'YYYY-MM-DD' o null.
   * @param {string|null} sucursalId    - UUID de la sucursal o 'all'.
   * @returns {Promise<Array>} Lista de pagos de salarios con datos de empleado.
   */
  async getPagosSalariosPorRango(fechaDesdeStr = null, fechaHastaStr = null, sucursalId = null) {
    let query = supabase
      .from('pagos_salarios')
      .select(`
        id,
        monto,
        periodo,
        fecha_pago,
        metodo_pago,
        notas,
        created_at,
        empleados (
          id,
          nombre,
          rol,
          sucursal_id,
          sucursales ( nombre )
        )
      `)
      .order('fecha_pago', { ascending: false });

    if (fechaDesdeStr) {
      query = query.gte('fecha_pago', fechaDesdeStr);
    }
    if (fechaHastaStr) {
      query = query.lte('fecha_pago', fechaHastaStr);
    }

    const { data, error } = await query;
    if (error) throw error;

    let resultado = data || [];
    if (sucursalId && sucursalId !== 'all') {
      resultado = resultado.filter(
        (p) => p.empleados?.sucursal_id === sucursalId
      );
    }

    return resultado;
  }

  /**
   * Obtiene los pagos/gastos a proveedores registrados en un rango de fechas.
   *
   * @param {string|null} fechaDesdeStr - Formato 'YYYY-MM-DD' o null.
   * @param {string|null} fechaHastaStr - Formato 'YYYY-MM-DD' o null.
   * @param {string|null} sucursalId    - UUID de la sucursal o 'all'.
   * @returns {Promise<Array>} Lista de pagos a proveedores con datos del proveedor.
   */
  async getPagosProveedoresPorRango(fechaDesdeStr = null, fechaHastaStr = null, sucursalId = null) {
    let query = supabase
      .from('pagos_proveedores')
      .select(`
        id,
        concepto,
        monto,
        fecha,
        estado,
        metodo_pago,
        sucursal_id,
        created_at,
        proveedores (
          id,
          nombre,
          ruc,
          categoria
        ),
        sucursales ( nombre )
      `)
      .order('fecha', { ascending: false });

    if (fechaDesdeStr) {
      query = query.gte('fecha', fechaDesdeStr);
    }
    if (fechaHastaStr) {
      query = query.lte('fecha', fechaHastaStr);
    }
    if (sucursalId && sucursalId !== 'all') {
      query = query.eq('sucursal_id', sucursalId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
}

export default new BalanceRepository();

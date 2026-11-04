import { supabase } from '../services/supabase';

/**
 * FacturaRepository
 * Encargado único de las operaciones con la tabla `facturas` en Supabase.
 */
class FacturaRepository {
  /**
   * Obtiene todas las facturas emitidas, con datos del pedido asociado y sucursal.
   * @param {string|null} sucursalId - ID de sucursal para filtrar o null para todas.
   * @returns {Array} Lista de facturas ordenadas descendentemente por fecha.
   */
  async getFacturas(sucursalId = null) {
    let query = supabase
      .from('facturas')
      .select(`
        *,
        sucursales ( nombre ),
        pedidos (
          id,
          mesa,
          notas,
          detalle_pedido (
            cantidad,
            precio,
            productos ( nombre )
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (sucursalId && sucursalId !== 'all') {
      query = query.eq('sucursal_id', sucursalId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Obtiene una factura asociada a un pedido puntual.
   * @param {string} pedidoId - UUID del pedido.
   * @returns {object|null} La factura o null si no se emitió.
   */
  async getPorPedidoId(pedidoId) {
    const { data, error } = await supabase
      .from('facturas')
      .select(`
        *,
        sucursales ( nombre ),
        pedidos (
          id,
          mesa,
          notas,
          detalle_pedido (
            cantidad,
            precio,
            productos ( nombre )
          )
        )
      `)
      .eq('pedido_id', pedidoId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Inserta un nuevo registro de factura.
   * @param {object} facturaData - Datos del comprobante.
   * @returns {object} El registro creado.
   */
  async crear(facturaData) {
    const { data, error } = await supabase
      .from('facturas')
      .insert(facturaData)
      .select(`
        *,
        sucursales ( nombre )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Obtiene el siguiente número correlativo de factura para la sucursal.
   * Formato legal paraguayo: 001-001-0000001
   * @param {string|null} sucursalId - ID de sucursal.
   * @returns {string} Siguiente correlativo formateado.
   */
  async getSiguienteNumero(sucursalId = null) {
    let query = supabase
      .from('facturas')
      .select('numero_factura')
      .order('created_at', { ascending: false })
      .limit(1);

    if (sucursalId && sucursalId !== 'all') {
      query = query.eq('sucursal_id', sucursalId);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0 || !data[0].numero_factura) {
      return '001-001-0000001';
    }

    // Extraer número de la última factura (ej: '001-001-0000042' -> 42)
    const partes = data[0].numero_factura.split('-');
    if (partes.length === 3) {
      const actual = parseInt(partes[2], 10) || 0;
      const siguiente = actual + 1;
      const padded = String(siguiente).padStart(7, '0');
      return `${partes[0]}-${partes[1]}-${padded}`;
    }

    // Fallback con timestamp si no coincide el formato
    const consecutivo = Math.floor(Math.random() * 9000000) + 1000000;
    return `001-001-${consecutivo}`;
  }
}

// Exportar como Singleton
export default new FacturaRepository();

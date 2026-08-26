import { supabase } from '../services/supabase';

/**
 * PedidoRepository
 * Único responsable de todas las operaciones de base de datos
 * sobre las tablas `pedidos` y `detalle_pedido`.
 */
class PedidoRepository {
  /**
   * Obtiene los pedidos activos (pendiente y listo) de una sucursal.
   * @param {string|null} sucursalId - ID de la sucursal o 'all' para todas.
   * @param {string|null} userSucursalId - sucursal_id fija del perfil del usuario (restringe filtrado).
   */
  async getPedidosActivos(sucursalId, userSucursalId = null) {
    let query = supabase
      .from('pedidos')
      .select(`
        *,
        detalle_pedido (
          cantidad,
          precio,
          productos ( nombre )
        )
      `)
      .in('estado', ['pendiente', 'listo'])
      .order('created_at', { ascending: true });

    if (userSucursalId) {
      // El usuario tiene sucursal asignada: filtrar siempre por ella
      query = query.eq('sucursal_id', userSucursalId);
    } else if (sucursalId && sucursalId !== 'all') {
      query = query.eq('sucursal_id', sucursalId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Obtiene pedidos del último mes para estadísticas.
   * @param {string|null} sucursalId - ID de la sucursal o 'all'.
   * @param {string|null} userSucursalId - sucursal_id fija del perfil del usuario.
   */
  async getPedidosUltimoMes(sucursalId, userSucursalId = null) {
    const unMesAtras = new Date();
    unMesAtras.setDate(unMesAtras.getDate() - 30);

    let query = supabase
      .from('pedidos')
      .select(`
        *,
        detalle_pedido (
          cantidad,
          precio,
          producto_id,
          productos ( nombre )
        )
      `)
      .gte('created_at', unMesAtras.toISOString())
      .order('created_at', { ascending: false });

    if (userSucursalId) {
      query = query.eq('sucursal_id', userSucursalId);
    } else if (sucursalId && sucursalId !== 'all') {
      query = query.eq('sucursal_id', sucursalId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Crea un pedido y su detalle en una sola operación atómica.
   * @param {object} pedidoData - Datos del encabezado del pedido.
   * @param {Array}  detalles   - Array de ítems del pedido.
   * @returns {object} El pedido recién creado.
   */
  async crear(pedidoData, detalles) {
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert(pedidoData)
      .select()
      .single();

    if (pedidoError) throw pedidoError;

    const detallesConId = detalles.map((d) => ({
      ...d,
      pedido_id: pedido.id,
    }));

    const { error: detalleError } = await supabase
      .from('detalle_pedido')
      .insert(detallesConId);

    if (detalleError) throw detalleError;

    return pedido;
  }

  /**
   * Actualiza el campo `estado` de un pedido.
   * @param {string|number} pedidoId   - ID del pedido.
   * @param {string}        nuevoEstado - Nuevo estado ('pendiente'|'listo'|'entregado').
   */
  async actualizarEstado(pedidoId, nuevoEstado) {
    const { error } = await supabase
      .from('pedidos')
      .update({ estado: nuevoEstado })
      .eq('id', pedidoId);

    if (error) throw error;
  }

  /**
   * Elimina un pedido y todos sus ítems de detalle.
   * @param {string|number} pedidoId - ID del pedido a eliminar.
   */
  async eliminar(pedidoId) {
    const { error: dError } = await supabase
      .from('detalle_pedido')
      .delete()
      .eq('pedido_id', pedidoId);

    if (dError) throw dError;

    const { error: pError } = await supabase
      .from('pedidos')
      .delete()
      .eq('id', pedidoId);

    if (pError) throw pError;
  }

  /**
   * Suscribe a cambios en tiempo real de la tabla pedidos.
   * @param {function} callback - Se llama con el payload de cada evento.
   * @returns {object} El canal de suscripción de Supabase (para poder desuscribirse).
   */
  suscribirCambios(callback) {
    return supabase
      .channel('pedidos_realtime_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        callback
      )
      .subscribe();
  }

  /**
   * Cancela una suscripción de tiempo real.
   * @param {object} channel - El canal devuelto por suscribirCambios().
   */
  cancelarSuscripcion(channel) {
    supabase.removeChannel(channel);
  }
}

// Exportar como Singleton
export default new PedidoRepository();

import pedidoRepository from '../repositories/PedidoRepository';

/**
 * StatsService
 * Encapsula toda la lógica de cálculo de estadísticas de ventas.
 * Obtiene los datos del repositorio y aplica las transformaciones necesarias.
 */
class StatsService {
  /**
   * Carga y calcula todas las estadísticas de los últimos 30 días.
   *
   * @param {string|null} sucursalId     - ID de la sucursal o 'all' para todas.
   * @param {string|null} userSucursalId - Sucursal fija del perfil del usuario.
   * @returns {{
   *   totalVentas: number,
   *   metodosPago: object,
   *   productosMasVendidos: Array,
   *   transacciones: Array
   * }}
   */
  async cargarEstadisticas(sucursalId, userSucursalId = null) {
    const pedidos = await pedidoRepository.getPedidosUltimoMes(sucursalId, userSucursalId);
    return this.calcularEstadisticas(pedidos);
  }

  /**
   * Calcula las métricas de estadísticas a partir de un array de pedidos.
   * Esta función es pura (no tiene efectos secundarios) y puede testearse fácilmente.
   *
   * @param {Array} pedidos - Array de pedidos con sus detalles.
   * @returns {{
   *   totalVentas: number,
   *   metodosPago: object,
   *   productosMasVendidos: Array,
   *   transacciones: Array
   * }}
   */
  calcularEstadisticas(pedidos) {
    // 1. Total de ventas
    const totalVentas = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);

    // 2. Desglose por método de pago
    const metodosPago = { efectivo: 0, tarjeta: 0, transferencia: 0, pendiente: 0 };
    pedidos.forEach((p) => {
      const metodo = p.metodo_pago?.toLowerCase() || 'efectivo';
      if (metodosPago[metodo] !== undefined) {
        metodosPago[metodo] += p.total || 0;
      }
    });

    // 3. Productos más vendidos (top 5 por cantidad)
    const conteoProductos = {};
    pedidos.forEach((p) => {
      p.detalle_pedido?.forEach((d) => {
        const nombre = d.productos?.nombre || 'Producto Desconocido';
        conteoProductos[nombre] = (conteoProductos[nombre] || 0) + (d.cantidad || 0);
      });
    });

    const productosMasVendidos = Object.entries(conteoProductos)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    return {
      totalVentas,
      metodosPago,
      productosMasVendidos,
      transacciones: pedidos,
    };
  }
}

// Exportar como Singleton
export default new StatsService();

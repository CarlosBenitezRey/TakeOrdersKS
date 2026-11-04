import balanceRepository from '../repositories/BalanceRepository';

/**
 * BalanceService
 * Capa de servicio encargada de consolidar y calcular:
 * 1. Estado de Resultados (Ingresos, Costos de RR.HH., Costos de Insumos, Utilidad Neta y Margen).
 * 2. Arqueo y Cierre de Caja en tiempo real (Caja física vs Cobros electrónicos).
 * 3. Métricas de rentabilidad y productos más vendidos.
 */
class BalanceService {
  /**
   * Genera los límites de fecha (ISO y string YYYY-MM-DD) para un período dado.
   *
   * @param {string} periodo - 'hoy' | 'semana' | 'mes' | 'historico'
   * @returns {{ fechaDesdeISO: string|null, fechaHastaISO: string|null, fechaDesdeStr: string|null, fechaHastaStr: string|null }}
   */
  calcularRangoFechas(periodo = 'mes') {
    const ahora = new Date();

    if (periodo === 'hoy') {
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0, 0);
      const fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);
      const str = inicio.toISOString().split('T')[0];
      return {
        fechaDesdeISO: inicio.toISOString(),
        fechaHastaISO: fin.toISOString(),
        fechaDesdeStr: str,
        fechaHastaStr: str,
      };
    }

    if (periodo === 'semana') {
      const inicio = new Date();
      inicio.setDate(ahora.getDate() - 7);
      inicio.setHours(0, 0, 0, 0);
      const fin = new Date();
      fin.setHours(23, 59, 59, 999);
      return {
        fechaDesdeISO: inicio.toISOString(),
        fechaHastaISO: fin.toISOString(),
        fechaDesdeStr: inicio.toISOString().split('T')[0],
        fechaHastaStr: fin.toISOString().split('T')[0],
      };
    }

    if (periodo === 'mes') {
      // Desde el 1 del mes actual a las 00:00:00
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
      const fin = new Date();
      fin.setHours(23, 59, 59, 999);
      return {
        fechaDesdeISO: inicio.toISOString(),
        fechaHastaISO: fin.toISOString(),
        fechaDesdeStr: inicio.toISOString().split('T')[0],
        fechaHastaStr: fin.toISOString().split('T')[0],
      };
    }

    // 'historico' u otro: sin filtro de fecha
    return {
      fechaDesdeISO: null,
      fechaHastaISO: null,
      fechaDesdeStr: null,
      fechaHastaStr: null,
    };
  }

  /**
   * Obtiene y calcula el Balance Financiero Integral.
   *
   * @param {object} opciones
   * @param {string} [opciones.periodo='mes']     - 'hoy' | 'semana' | 'mes' | 'historico'
   * @param {string} [opciones.sucursalId='all']  - UUID de la sucursal o 'all'
   * @param {string|null} [opciones.userSucursalId=null] - Sucursal fija del perfil
   * @returns {Promise<object>} Balance financiero con KPIs, Arqueo y Desglose
   */
  async obtenerBalanceFinanciero({ periodo = 'mes', sucursalId = 'all', userSucursalId = null } = {}) {
    const sucursalEfectiva = userSucursalId || sucursalId;
    const { fechaDesdeISO, fechaHastaISO, fechaDesdeStr, fechaHastaStr } =
      this.calcularRangoFechas(periodo);

    // Consulta en paralelo de ingresos y egresos
    const [pedidos, pagosSalarios, pagosProveedores] = await Promise.all([
      balanceRepository.getPedidosPorRango(fechaDesdeISO, fechaHastaISO, sucursalEfectiva),
      balanceRepository.getPagosSalariosPorRango(fechaDesdeStr, fechaHastaStr, sucursalEfectiva),
      balanceRepository.getPagosProveedoresPorRango(fechaDesdeStr, fechaHastaStr, sucursalEfectiva),
    ]);

    return this.calcularMetricas({
      pedidos,
      pagosSalarios,
      pagosProveedores,
      periodo,
    });
  }

  /**
   * Realiza todos los cálculos de agregación contable a partir de los datos crudos.
   * Función pura para facilitar pruebas unitarias.
   */
  calcularMetricas({ pedidos = [], pagosSalarios = [], pagosProveedores = [], periodo = 'mes' }) {
    // 1. INGRESOS (Ventas)
    const ingresosTotales = pedidos.reduce((acc, p) => acc + Number(p.total || 0), 0);
    const totalPedidos = pedidos.length;
    const ticketPromedio = totalPedidos > 0 ? Math.round(ingresosTotales / totalPedidos) : 0;

    // 2. EGRESOS DE NÓMINA (Salarios)
    const egresosSalarios = pagosSalarios.reduce((acc, p) => acc + Number(p.monto || 0), 0);

    // 3. EGRESOS DE PROVEEDORES (Compras operativas)
    const pagosProveedoresLiquidados = pagosProveedores.filter((p) => p.estado === 'pagado');
    const egresosProveedores = pagosProveedoresLiquidados.reduce(
      (acc, p) => acc + Number(p.monto || 0),
      0
    );

    // Facturas de proveedores pendientes de pago (Deuda/Compromiso)
    const deudaProveedoresPendiente = pagosProveedores
      .filter((p) => p.estado === 'pendiente')
      .reduce((acc, p) => acc + Number(p.monto || 0), 0);

    // 4. TOTALES Y UTILIDAD NETA
    const totalEgresos = egresosSalarios + egresosProveedores;
    const utilidadNeta = ingresosTotales - totalEgresos;
    const margenOperativo =
      ingresosTotales > 0 ? Number(((utilidadNeta / ingresosTotales) * 100).toFixed(1)) : 0;

    // Distribución porcentual de egresos
    const porcentajeSalarios =
      totalEgresos > 0 ? Math.round((egresosSalarios / totalEgresos) * 100) : 0;
    const porcentajeInsumos =
      totalEgresos > 0 ? Math.round((egresosProveedores / totalEgresos) * 100) : 0;

    // 5. ARQUEO DE CAJA (Efectivo vs Electrónico)
    let ventasEfectivo = 0;
    let ventasTarjeta = 0;
    let ventasTransferencia = 0;
    let ventasPendiente = 0;

    pedidos.forEach((p) => {
      const metodo = (p.metodo_pago || 'efectivo').toLowerCase();
      const monto = Number(p.total || 0);
      if (metodo === 'efectivo') ventasEfectivo += monto;
      else if (metodo === 'tarjeta') ventasTarjeta += monto;
      else if (metodo === 'transferencia') ventasTransferencia += monto;
      else ventasPendiente += monto;
    });

    // Salidas en efectivo registradas
    const salidasEfectivoSalarios = pagosSalarios
      .filter((p) => (p.metodo_pago || '').toLowerCase() === 'efectivo')
      .reduce((acc, p) => acc + Number(p.monto || 0), 0);

    const salidasEfectivoProveedores = pagosProveedoresLiquidados
      .filter((p) => (p.metodo_pago || '').toLowerCase() === 'efectivo')
      .reduce((acc, p) => acc + Number(p.monto || 0), 0);

    const totalSalidasEfectivo = salidasEfectivoSalarios + salidasEfectivoProveedores;
    const saldoEsperadoCajaFisica = ventasEfectivo - totalSalidasEfectivo;
    const totalCobrosElectronicos = ventasTarjeta + ventasTransferencia;

    // 6. TOP 5 PRODUCTOS MÁS VENDIDOS
    const conteoProductos = {};
    pedidos.forEach((p) => {
      p.detalle_pedido?.forEach((d) => {
        const nombre = d.productos?.nombre || 'Producto';
        const cantidad = Number(d.cantidad || 0);
        const subtotal = cantidad * Number(d.precio || 0);

        if (!conteoProductos[nombre]) {
          conteoProductos[nombre] = { nombre, cantidad: 0, total: 0 };
        }
        conteoProductos[nombre].cantidad += cantidad;
        conteoProductos[nombre].total += subtotal;
      });
    });

    const topProductos = Object.values(conteoProductos)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    return {
      periodo,
      kpis: {
        ingresosTotales,
        totalEgresos,
        utilidadNeta,
        margenOperativo,
        totalPedidos,
        ticketPromedio,
      },
      estadoResultados: {
        ingresosTotales,
        egresosSalarios,
        egresosProveedores,
        totalEgresos,
        utilidadNeta,
        porcentajeSalarios,
        porcentajeInsumos,
        deudaProveedoresPendiente,
      },
      arqueoCaja: {
        ventasEfectivo,
        totalSalidasEfectivo,
        saldoEsperadoCajaFisica,
        totalCobrosElectronicos,
        ventasTarjeta,
        ventasTransferencia,
        ventasPendiente,
      },
      topProductos,
      transaccionesRecientes: pedidos.slice(0, 20),
    };
  }
}

export default new BalanceService();

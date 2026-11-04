import pagoRepository from '../repositories/PagoRepository';

export const METODOS_PAGO_EGRESO = [
  { label: 'Transferencia Bancaria', value: 'transferencia' },
  { label: 'Efectivo',               value: 'efectivo' },
  { label: 'Cheque',                 value: 'cheque' },
];

export const ESTADOS_PAGO_PROVEEDOR = [
  { label: 'Pagado',    value: 'pagado' },
  { label: 'Pendiente', value: 'pendiente' },
];

/**
 * PagoService
 * Lógica de negocio para registro y control de egresos:
 * salarios de empleados y pagos a proveedores.
 */
class PagoService {
  // ─── Salarios ────────────────────────────────────────────────────────────────

  /**
   * Carga los pagos de salarios.
   * @param {string|null} sucursalId - Filtrar por sucursal.
   * @param {string|null} periodo    - Filtrar por período (ej. '2026-10').
   */
  async getPagosSalarios(sucursalId = null, periodo = null) {
    return await pagoRepository.getPagosSalarios(sucursalId, periodo);
  }

  /**
   * Registra un pago de salario con validaciones.
   * @param {object} formData
   * @param {string} usuarioId - Usuario que efectúa el registro (Admin).
   */
  async registrarPagoSalario(formData, usuarioId = null) {
    const { empleadoId, monto, periodo, fechaPago, metodoPago, notas } = formData;

    if (!empleadoId) {
      throw new Error('Debe seleccionar a qué empleado corresponde el pago');
    }

    const montoNum = parseInt(String(monto).replace(/\D/g, ''), 10);
    if (!montoNum || isNaN(montoNum) || montoNum <= 0) {
      throw new Error('El monto del salario debe ser un valor mayor a cero');
    }

    if (!periodo || !periodo.trim()) {
      throw new Error('Debe indicar el período del salario (ej. 2026-10)');
    }

    const payload = {
      empleado_id: empleadoId,
      monto:       montoNum,
      periodo:     periodo.trim(),
      fecha_pago:  fechaPago || new Date().toISOString().split('T')[0],
      metodo_pago: metodoPago || 'transferencia',
      notas:       notas?.trim() || null,
      usuario_id:  usuarioId || null,
    };

    return await pagoRepository.crearPagoSalario(payload);
  }

  /**
   * Elimina un registro de pago de salario.
   * @param {string} id - UUID del pago.
   */
  async eliminarPagoSalario(id) {
    if (!id) throw new Error('ID de pago inválido');
    await pagoRepository.eliminarPagoSalario(id);
  }

  // ─── Proveedores / Egresos de Compras ────────────────────────────────────────

  /**
   * Carga las facturas y pagos a proveedores.
   * @param {string|null} sucursalId - Filtrar por sucursal.
   * @param {string|null} estado     - 'pagado' | 'pendiente' | null.
   */
  async getPagosProveedores(sucursalId = null, estado = null) {
    return await pagoRepository.getPagosProveedores(sucursalId, estado);
  }

  /**
   * Registra una factura o pago a proveedor.
   * @param {object} formData
   * @param {string} usuarioId - Admin que registra la transacción.
   */
  async registrarPagoProveedor(formData, usuarioId = null) {
    const { proveedorId, concepto, monto, fecha, estado, metodoPago, sucursalId } = formData;

    if (!proveedorId) {
      throw new Error('Debe seleccionar un proveedor');
    }

    if (!concepto || !concepto.trim()) {
      throw new Error('Debe ingresar el concepto o número de factura');
    }

    const montoNum = parseInt(String(monto).replace(/\D/g, ''), 10);
    if (!montoNum || isNaN(montoNum) || montoNum <= 0) {
      throw new Error('El monto del pago debe ser mayor a cero');
    }

    const payload = {
      proveedor_id: proveedorId,
      concepto:     concepto.trim(),
      monto:        montoNum,
      fecha:        fecha || new Date().toISOString().split('T')[0],
      estado:       estado || 'pagado',
      metodo_pago:  metodoPago || 'transferencia',
      sucursal_id:  sucursalId || null,
      usuario_id:   usuarioId || null,
    };

    return await pagoRepository.crearPagoProveedor(payload);
  }

  /**
   * Marca una factura de proveedor pendiente como pagada.
   * @param {string} id - UUID del registro.
   */
  async marcarComoPagado(id) {
    if (!id) throw new Error('ID de factura inválido');
    return await pagoRepository.actualizarEstadoPagoProveedor(id, 'pagado');
  }

  /**
   * Elimina un egreso o factura a proveedor.
   * @param {string} id - UUID del registro.
   */
  async eliminarPagoProveedor(id) {
    if (!id) throw new Error('ID de pago inválido');
    await pagoRepository.eliminarPagoProveedor(id);
  }

  // ─── Cálculos y Métricas Financieras ─────────────────────────────────────────

  /**
   * Calcula el resumen de egresos a partir de las listas de salarios y proveedores.
   * Función pura ideal para componentes y futuros reportes de contabilidad.
   *
   * @param {Array} pagosSalarios    - Lista de pagos de salarios.
   * @param {Array} pagosProveedores - Lista de pagos a proveedores.
   * @returns {object} Resumen financiero de egresos.
   */
  calcularResumenEgresos(pagosSalarios = [], pagosProveedores = []) {
    const totalSalarios = pagosSalarios.reduce(
      (sum, p) => sum + (Number(p.monto) || 0),
      0
    );

    let totalProveedoresPagado = 0;
    let totalProveedoresPendiente = 0;

    pagosProveedores.forEach((p) => {
      const monto = Number(p.monto) || 0;
      if (p.estado === 'pendiente') {
        totalProveedoresPendiente += monto;
      } else {
        totalProveedoresPagado += monto;
      }
    });

    return {
      totalSalarios,
      totalProveedoresPagado,
      totalProveedoresPendiente,
      totalEgresosEfectivos: totalSalarios + totalProveedoresPagado,
      totalComprometido: totalSalarios + totalProveedoresPagado + totalProveedoresPendiente,
    };
  }

  /**
   * Genera los últimos 12 meses como opciones para seleccionar período.
   * Formato { label: 'Octubre 2026', value: '2026-10' }.
   */
  getPeriodosDisponibles() {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];

    const opciones = [];
    const fechaActual = new Date();

    for (let i = 0; i < 12; i++) {
      const d = new Date(fechaActual.getFullYear(), fechaActual.getMonth() - i, 1);
      const año = d.getFullYear();
      const mesNum = String(d.getMonth() + 1).padStart(2, '0');
      const mesNombre = meses[d.getMonth()];

      opciones.push({
        label: `${mesNombre} ${año}`,
        value: `${año}-${mesNum}`,
      });
    }

    return opciones;
  }
}

// Exportar como Singleton
export default new PagoService();

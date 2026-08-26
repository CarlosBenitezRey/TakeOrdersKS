import pedidoRepository from '../repositories/PedidoRepository';
import usuarioRepository from '../repositories/UsuarioRepository';

// Transiciones válidas del ciclo de vida de un pedido (State Machine)
const TRANSICIONES_VALIDAS = {
  pendiente: ['listo'],
  listo: ['entregado'],
  entregado: [],
};

/**
 * OrderService
 * Contiene toda la lógica de negocio relacionada con pedidos:
 * construcción, validación, persistencia y gestión de estados.
 */
class OrderService {
  /**
   * Crea un nuevo pedido a partir del carrito y los datos del formulario.
   * Valida el carrito, verifica la FK del usuario y persiste en la BD.
   *
   * @param {Array}  carrito            - Array de { producto, cantidad }.
   * @param {object} opciones
   * @param {string} opciones.mesa
   * @param {string} opciones.cliente
   * @param {string} opciones.notas
   * @param {string} opciones.metodoPago - 'efectivo'|'tarjeta'|'transferencia'|'pendiente'
   * @param {string} opciones.sucursalId
   * @param {string} opciones.usuarioId
   * @returns {object} El pedido creado.
   * @throws {Error} Si el carrito está vacío.
   */
  async crearPedido(carrito, { mesa, cliente, notas, metodoPago, sucursalId, usuarioId }) {
    if (!carrito || carrito.length === 0) {
      throw new Error('El carrito no puede estar vacío');
    }

    // Calcular total
    const total = carrito.reduce(
      (sum, item) => sum + item.producto.precio * item.cantidad,
      0
    );

    // Verificar si el usuario existe en la tabla 'usuarios' para no violar la FK
    let usuarioIdValido = null;
    if (usuarioId) {
      const existe = await usuarioRepository.existeEnTabla(usuarioId);
      usuarioIdValido = existe ? usuarioId : null;
    }

    const pedidoData = {
      estado: 'pendiente',
      mesa: mesa?.trim() || null,
      cliente: cliente?.trim() || null,
      notas: notas?.trim() || null,
      total,
      metodo_pago: metodoPago || 'efectivo',
      usuario_id: usuarioIdValido,
      sucursal_id: sucursalId || null,
    };

    const detalles = carrito.map((item) => ({
      producto_id: item.producto.id,
      cantidad: item.cantidad,
      precio: item.producto.precio,
    }));

    return await pedidoRepository.crear(pedidoData, detalles);
  }

  /**
   * Cambia el estado de un pedido validando que la transición sea válida.
   * Implementa una State Machine para el ciclo de vida del pedido.
   *
   * @param {string|number} pedidoId     - ID del pedido.
   * @param {string}        estadoActual - Estado actual del pedido.
   * @param {string}        nuevoEstado  - Estado destino.
   * @throws {Error} Si la transición no es válida.
   */
  async cambiarEstado(pedidoId, estadoActual, nuevoEstado) {
    const transicionesPermitidas = TRANSICIONES_VALIDAS[estadoActual] || [];

    if (!transicionesPermitidas.includes(nuevoEstado)) {
      throw new Error(
        `Transición inválida: no se puede pasar de "${estadoActual}" a "${nuevoEstado}"`
      );
    }

    await pedidoRepository.actualizarEstado(pedidoId, nuevoEstado);
  }

  /**
   * Elimina un pedido y su detalle permanentemente.
   * @param {string|number} pedidoId - ID del pedido a eliminar.
   */
  async eliminarPedido(pedidoId) {
    await pedidoRepository.eliminar(pedidoId);
  }

  /**
   * Obtiene los pedidos activos (pendiente/listo) de una sucursal.
   * @param {string|null} sucursalId     - ID de la sucursal o 'all'.
   * @param {string|null} userSucursalId - Sucursal fija del usuario (desde su perfil).
   * @returns {Array} Lista de pedidos activos.
   */
  async getPedidosActivos(sucursalId, userSucursalId = null) {
    return await pedidoRepository.getPedidosActivos(sucursalId, userSucursalId);
  }

  /**
   * Suscribe a cambios en tiempo real de la tabla pedidos.
   * @param {function} callback - Función llamada con cada evento de cambio.
   * @returns {object} Canal de suscripción (guardar para cancelarlo en cleanup).
   */
  suscribirCambiosPedidos(callback) {
    return pedidoRepository.suscribirCambios(callback);
  }

  /**
   * Cancela una suscripción de tiempo real.
   * @param {object} channel - Canal devuelto por suscribirCambiosPedidos().
   */
  cancelarSuscripcion(channel) {
    pedidoRepository.cancelarSuscripcion(channel);
  }
}

// Exportar como Singleton
export default new OrderService();

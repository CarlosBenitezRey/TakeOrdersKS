/**
 * CarritoService
 *
 * Encapsula toda la lógica de manipulación del carrito de compras.
 * Cada método es una función pura: recibe el estado actual del carrito
 * y devuelve el nuevo estado, sin efectos secundarios.
 * Esto facilita el testeo unitario y desacopla la lógica de la UI.
 */
class CarritoService {
  /**
   * Agrega un producto al carrito.
   * Si el producto ya existe, incrementa su cantidad en 1.
   * Si es nuevo, lo agrega con cantidad = 1.
   *
   * @param {Array}  carrito  - Estado actual del carrito [{ producto, cantidad }].
   * @param {object} producto - Producto a agregar.
   * @returns {Array} Nuevo estado del carrito.
   */
  agregar(carrito, producto) {
    const existente = carrito.find((item) => item.producto.id === producto.id);
    if (existente) {
      return carrito.map((item) =>
        item.producto.id === producto.id
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      );
    }
    return [...carrito, { producto, cantidad: 1 }];
  }

  /**
   * Disminuye en 1 la cantidad de un producto en el carrito.
   * Si la cantidad llega a 0, elimina el ítem del carrito.
   *
   * @param {Array}  carrito  - Estado actual del carrito.
   * @param {object} producto - Producto a disminuir.
   * @returns {Array} Nuevo estado del carrito.
   */
  disminuir(carrito, producto) {
    const existente = carrito.find((item) => item.producto.id === producto.id);
    if (!existente) return carrito;
    if (existente.cantidad > 1) {
      return carrito.map((item) =>
        item.producto.id === producto.id
          ? { ...item, cantidad: item.cantidad - 1 }
          : item
      );
    }
    return carrito.filter((item) => item.producto.id !== producto.id);
  }

  /**
   * Elimina completamente un producto del carrito, sin importar su cantidad.
   *
   * @param {Array}  carrito    - Estado actual del carrito.
   * @param {string} productoId - ID del producto a eliminar.
   * @returns {Array} Nuevo estado del carrito.
   */
  eliminar(carrito, productoId) {
    return carrito.filter((item) => item.producto.id !== productoId);
  }

  /**
   * Vacía el carrito por completo.
   *
   * @returns {Array} Carrito vacío.
   */
  vaciar() {
    return [];
  }

  /**
   * Calcula el precio total del carrito.
   * Función pura — útil para mostrar el total en la UI sin lógica adicional.
   *
   * @param {Array} carrito - Estado actual del carrito.
   * @returns {number} Suma total del carrito.
   */
  calcularTotal(carrito) {
    return carrito.reduce(
      (sum, item) => sum + item.producto.precio * item.cantidad,
      0
    );
  }

  /**
   * Devuelve la cantidad de un producto específico en el carrito.
   * Útil para mostrar badges o controles de cantidad en la UI.
   *
   * @param {Array}  carrito    - Estado actual del carrito.
   * @param {string} productoId - ID del producto a consultar.
   * @returns {number} Cantidad actual (0 si no está en el carrito).
   */
  getCantidad(carrito, productoId) {
    const item = carrito.find((i) => i.producto.id === productoId);
    return item ? item.cantidad : 0;
  }
}

// Exportar como Singleton
export default new CarritoService();

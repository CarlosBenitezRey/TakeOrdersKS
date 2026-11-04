import proveedorRepository from '../repositories/ProveedorRepository';

// Categorías comunes para proveedores de gastronomía
export const CATEGORIAS_PROVEEDOR = [
  'Carnes',
  'Panadería',
  'Bebidas',
  'Verduras / Frescos',
  'Lácteos / Quesos',
  'Insumos / Descartables',
  'Limpieza',
  'Mantenimiento',
  'Otros',
];

/**
 * ProveedorService
 * Lógica de negocio para gestión de proveedores:
 * validaciones, formateo y orquestación con el repositorio.
 */
class ProveedorService {
  /**
   * Obtiene la lista de proveedores activos.
   * @param {string|null} sucursalId - Filtrar por sucursal (o null para todos).
   * @returns {Array} Lista de proveedores activos.
   */
  async getProveedores(sucursalId = null) {
    return await proveedorRepository.getActivos(sucursalId);
  }

  /**
   * Crea un nuevo proveedor validando los datos obligatorios.
   * @param {object} formData - Datos ingresados en el formulario.
   * @returns {object} Proveedor creado.
   */
  async crearProveedor(formData) {
    this._validar(formData);
    const proveedorData = this._formatear(formData);
    return await proveedorRepository.crear(proveedorData);
  }

  /**
   * Actualiza los datos de un proveedor existente.
   * @param {string} id - UUID del proveedor.
   * @param {object} formData - Datos actualizados.
   * @returns {object} Proveedor actualizado.
   */
  async actualizarProveedor(id, formData) {
    if (!id) throw new Error('ID de proveedor requerido');
    this._validar(formData);
    const proveedorData = this._formatear(formData);
    return await proveedorRepository.actualizar(id, proveedorData);
  }

  /**
   * Da de baja a un proveedor (soft delete).
   * @param {string} id - UUID del proveedor.
   */
  async darDeBaja(id) {
    if (!id) throw new Error('ID de proveedor requerido');
    await proveedorRepository.darDeBaja(id);
  }

  // ─── Métodos privados ───────────────────────────────────────────────────────

  /**
   * Valida los datos requeridos de un proveedor.
   */
  _validar({ nombre }) {
    if (!nombre || !nombre.trim()) {
      throw new Error('El nombre de la empresa o proveedor es obligatorio');
    }
  }

  /**
   * Limpia y normaliza el payload antes de enviarlo a la BD.
   */
  _formatear({ nombre, ruc, telefono, categoria, sucursalId }) {
    return {
      nombre: nombre.trim(),
      ruc: ruc?.trim() || null,
      telefono: telefono?.trim() || null,
      categoria: categoria || 'Insumos',
      sucursal_id: sucursalId || null,
    };
  }
}

// Exportar como Singleton
export default new ProveedorService();

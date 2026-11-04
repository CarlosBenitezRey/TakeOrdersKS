import empleadoRepository from '../repositories/EmpleadoRepository';

// Roles disponibles en el sistema
export const ROLES_DISPONIBLES = [
  { label: 'Cajero',    value: 'cajero' },
  { label: 'Cocinero',  value: 'cocinero' },
  { label: 'Mozo',      value: 'mozo' },
  { label: 'Supervisor',value: 'supervisor' },
  { label: 'Admin',     value: 'admin' },
];

/**
 * EmpleadoService
 * Lógica de negocio para gestión de personal:
 * validaciones, formateo de datos y orquestación del repositorio.
 */
class EmpleadoService {
  /**
   * Carga la lista de empleados activos.
   * @param {string|null} sucursalId - Filtrar por sucursal (null = todos).
   * @returns {Array} Lista de empleados activos ordenados por nombre.
   */
  async getEmpleados(sucursalId = null) {
    return await empleadoRepository.getActivos(sucursalId);
  }

  /**
   * Crea un nuevo empleado con validación de datos de entrada.
   * @param {object} formData - Datos del formulario.
   * @throws {Error} Si los campos obligatorios están vacíos.
   * @returns {object} El empleado creado.
   */
  async crearEmpleado(formData) {
    this._validar(formData);

    const empleadoData = this._formatear(formData);
    return await empleadoRepository.crear(empleadoData);
  }

  /**
   * Actualiza los datos de un empleado existente.
   * @param {string} id       - UUID del empleado.
   * @param {object} formData - Datos del formulario.
   * @returns {object} El empleado actualizado.
   */
  async actualizarEmpleado(id, formData) {
    this._validar(formData);

    const empleadoData = this._formatear(formData);
    return await empleadoRepository.actualizar(id, empleadoData);
  }

  /**
   * Da de baja a un empleado (soft delete).
   * @param {string} id - UUID del empleado.
   */
  async darDeBaja(id) {
    if (!id) throw new Error('ID de empleado inválido');
    await empleadoRepository.darDeBaja(id);
  }

  // ─── Métodos privados ───────────────────────────────────────────────────────

  /**
   * Valida que los campos obligatorios estén presentes.
   * @param {object} formData
   * @throws {Error} Si falta el nombre o el rol.
   */
  _validar({ nombre, rol }) {
    if (!nombre?.trim()) {
      throw new Error('El nombre del empleado es obligatorio');
    }
    if (!rol?.trim()) {
      throw new Error('Debe seleccionar un rol para el empleado');
    }
  }

  /**
   * Construye el objeto limpio para insertar/actualizar en la BD.
   * @param {object} formData
   * @returns {object}
   */
  _formatear({ nombre, rol, sucursalId, sueldoBase, telefono, fechaIngreso }) {
    return {
      nombre:        nombre.trim(),
      rol:           rol.trim(),
      sucursal_id:   sucursalId || null,
      sueldo_base:   sueldoBase ? parseInt(String(sueldoBase).replace(/\D/g, ''), 10) : 0,
      telefono:      telefono?.trim() || null,
      fecha_ingreso: fechaIngreso || new Date().toISOString().split('T')[0],
      activo:        true,
    };
  }
}

// Exportar como Singleton
export default new EmpleadoService();

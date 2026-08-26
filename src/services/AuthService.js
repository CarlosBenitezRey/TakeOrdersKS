import { supabase } from './supabase';
import usuarioRepository from '../repositories/UsuarioRepository';

/**
 * AuthService
 * Encapsula toda la lógica de autenticación y manejo de perfil de usuario.
 * Los componentes no deben importar supabase.auth directamente.
 */
class AuthService {
  /**
   * Inicia sesión con email y contraseña.
   * Valida los datos de entrada antes de llamar a Supabase Auth.
   * @param {string} email
   * @param {string} password
   * @returns {{ user: object, perfil: object }} Datos del usuario autenticado y su perfil.
   * @throws {Error} Si las credenciales son inválidas o hay error de red.
   */
  async login(email, password) {
    // Validaciones de entrada (lógica de negocio, no de UI)
    if (!email?.trim() || !password?.trim()) {
      throw new Error('Por favor, ingresa tu correo y contraseña');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Por favor, ingresa un correo electrónico válido');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) throw this._traducirError(error);

    // Buscar el perfil en la tabla usuarios
    const perfil = await usuarioRepository.getPerfilById(data.user.id);

    if (!perfil) {
      throw new Error('Usuario no encontrado en el sistema. Contacta al administrador.');
    }

    return { user: data.user, perfil };
  }

  /**
   * Cierra la sesión del usuario actual.
   * @throws {Error} Si ocurre un error al cerrar sesión.
   */
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  /**
   * Obtiene la sesión activa actual (para restaurar sesión al abrir la app).
   * @returns {object|null} La sesión activa, o null si no hay sesión.
   */
  async getSesionActual() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  /**
   * Carga el perfil de usuario, con fallback si no existe en la tabla `usuarios`.
   * @param {string} userId    - UUID del usuario autenticado.
   * @param {string} userEmail - Email del usuario (usado para generar nombre de fallback).
   * @returns {object} El perfil del usuario (real o fallback).
   */
  async cargarPerfil(userId, userEmail) {
    try {
      const perfil = await usuarioRepository.getPerfilById(userId);

      if (perfil) return perfil;

      // Fallback: construir un perfil mínimo si no existe en la tabla
      console.warn('Perfil no encontrado en tabla "usuarios", usando fallback.');
      return this._crearPerfilFallback(userId, userEmail);
    } catch (error) {
      console.warn('Error al cargar perfil, usando fallback:', error.message);
      return this._crearPerfilFallback(userId, userEmail);
    }
  }

  /**
   * Suscribe a cambios en el estado de autenticación (login, logout, token refresh).
   * @param {function} callback - Función que recibe (event, session).
   * @returns {object} El objeto de suscripción de Supabase (para poder cancelarla).
   */
  suscribirCambiosAuth(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return subscription;
  }

  // ─── Métodos privados ───────────────────────────────────────────────────────

  /**
   * Construye un perfil mínimo de fallback cuando el registro no existe en la BD.
   */
  _crearPerfilFallback(userId, userEmail) {
    return {
      id: userId,
      nombre: userEmail ? userEmail.split('@')[0] : 'Usuario',
      rol: 'cajero',
      email: userEmail || '',
      sucursal_id: null,
    };
  }

  /**
   * Traduce los errores de Supabase Auth a mensajes en español para el usuario.
   * @param {Error} error - El error original de Supabase.
   * @returns {Error} Un nuevo error con mensaje amigable.
   */
  _traducirError(error) {
    if (error.message.includes('Invalid login credentials')) {
      return new Error('Correo o contraseña incorrectos');
    }
    if (error.message.includes('Network request failed')) {
      return new Error('Error de conexión. Verifica tu internet');
    }
    return new Error('Ocurrió un error al intentar iniciar sesión');
  }
}

// Exportar como Singleton
export default new AuthService();

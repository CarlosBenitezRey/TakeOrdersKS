import { supabase } from '../services/supabase';

/**
 * UsuarioRepository
 * Único responsable de todas las operaciones de base de datos
 * sobre la tabla `usuarios`.
 */
class UsuarioRepository {
  /**
   * Busca el perfil de un usuario por su ID de Auth.
   * @param {string} userId - UUID del usuario autenticado.
   * @returns {object|null} El perfil del usuario, o null si no existe.
   */
  async getPerfilById(userId) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Verifica si un usuario existe en la tabla `usuarios`.
   * Usado para validar la FK antes de crear un pedido.
   * @param {string} userId - UUID del usuario a verificar.
   * @returns {boolean} True si el usuario existe en la tabla.
   */
  async existeEnTabla(userId) {
    const { data } = await supabase
      .from('usuarios')
      .select('id')
      .eq('id', userId)
      .single();

    return !!data;
  }
}

// Exportar como Singleton
export default new UsuarioRepository();

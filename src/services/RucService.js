const TURUC_API_URL = 'https://turuc.com.py/api';

class RucService {
  constructor() {
    this.cache = new Map();
  }

  formatearEntrada(value = '') {
    const limpio = String(value)
      .replace(/[^0-9-]/g, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 10);

    if (!limpio.includes('-') && limpio.length === 9) {
      return `${limpio.slice(0, 8)}-${limpio.slice(8)}`;
    }

    const [documento, digito] = limpio.split('-');
    return digito === undefined
      ? documento.slice(0, 8)
      : `${documento.slice(0, 8)}-${digito.slice(0, 1)}`;
  }

  esConsultaValida(value = '') {
    return /^\d{3,8}(?:-\d)?$/.test(this.formatearEntrada(value));
  }

  esRucCompleto(value = '') {
    return /^\d{1,8}-\d$/.test(this.formatearEntrada(value));
  }

  async buscarPorNumero(value, { signal } = {}) {
    const ruc = this.formatearEntrada(value);

    if (!this.esConsultaValida(ruc)) {
      const error = new Error('Ingresá un RUC válido, por ejemplo 80024191-6.');
      error.code = 'INVALID_RUC';
      throw error;
    }

    if (this.cache.has(ruc)) {
      return this.cache.get(ruc);
    }

    const response = await fetch(
      `${TURUC_API_URL}/contribuyente/${encodeURIComponent(ruc)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal,
      }
    );

    let payload = null;
    try {
      payload = await response.json();
    } catch (_error) {
      // El mensaje genérico de abajo cubre respuestas no JSON del proveedor.
    }

    if (!response.ok || !payload?.data) {
      const error = new Error(
        response.status === 404
          ? 'No encontramos un contribuyente con ese RUC.'
          : payload?.message || 'TuRuc no pudo completar la consulta.'
      );
      error.code = response.status === 404 ? 'RUC_NOT_FOUND' : 'TURUC_ERROR';
      error.status = response.status;
      throw error;
    }

    const contribuyente = payload.data;

    const resultado = {
      documento: contribuyente.doc,
      razonSocial: contribuyente.razonSocial || '',
      ruc: contribuyente.ruc || ruc,
      estado: contribuyente.estado || 'DESCONOCIDO',
      esPersonaJuridica: Boolean(contribuyente.esPersonaJuridica),
      esEntidadPublica: Boolean(contribuyente.esEntidadPublica),
    };

    this.cache.set(ruc, resultado);
    return resultado;
  }
}

export default new RucService();

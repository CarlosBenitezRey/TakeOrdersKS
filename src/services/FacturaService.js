import { Platform } from 'react-native';
import facturaRepository from '../repositories/FacturaRepository';

export const DATOS_EMPRESA = {
  nombreFantasia: 'SMASH BURGERS',
  razonSocial:    'Kings Solutions S.A.',
  ruc:            '80084920-3',
  actividad:      'Venta de Comidas Rápidas y Bebidas',
  direccion:      'Av. Mariscal López c/ San Martín, Asunción',
  telefono:       '(021) 600-789',
  timbrado:       '16892401',
  vigencia:       'Desde: 01/01/2026 · Hasta: 31/12/2026',
};

/**
 * FacturaService
 * Encapsula la lógica de facturación legal paraguaya, cálculo de IVA,
 * correlatividad de comprobantes y utilidades de impresión.
 */
class FacturaService {
  /**
   * Calcula la liquidación de IVA según normativa de Paraguay (10% en alimentos y bebidas).
   * En Paraguay, el precio de venta ya incluye IVA:
   * IVA 10% = Total / 11
   * Gravada 10% = Total - IVA 10%
   *
   * @param {number} total - Monto total en Guaraníes.
   * @returns {object} Desglose fiscal.
   */
  calcularIVA(total) {
    const totalNum = Number(total || 0);
    const iva10 = Math.round(totalNum / 11);
    const gravada10 = totalNum - iva10;

    return {
      total: totalNum,
      iva10,
      gravada10,
      iva5: 0,
      gravada5: 0,
      exenta: 0,
      totalIva: iva10,
    };
  }

  /**
   * Genera y persiste una factura formal a partir de un pedido registrado.
   *
   * @param {object} pedido        - Objeto del pedido creado en la BD.
   * @param {Array}  items         - Array con los ítems del carrito [{ producto, cantidad }].
   * @param {object} datosFiscales - { clienteNombre, clienteRuc, condicionVenta, metodoPago }.
   * @param {string} usuarioId     - UUID del cajero/usuario.
   * @returns {object} Factura creada con sus ítems.
   */
  async generarFacturaDePedido(pedido, items = [], datosFiscales = {}, usuarioId = null) {
    if (!pedido || !pedido.id) {
      throw new Error('Se requiere un pedido válido para emitir la factura');
    }

    const { clienteNombre, clienteRuc, condicionVenta, metodoPago } = datosFiscales;
    const calculo = this.calcularIVA(pedido.total);
    const numeroFactura = await facturaRepository.getSiguienteNumero(pedido.sucursal_id);

    const nombreFinal =
      clienteNombre?.trim() ||
      pedido.cliente?.trim() ||
      'Consumidor Final';

    const rucFinal =
      clienteRuc?.trim() ||
      '44444401-7'; // RUC genérico estándar en Paraguay

    const payload = {
      pedido_id:        pedido.id,
      numero_factura:   numeroFactura,
      tipo_comprobante: 'factura',
      cliente_nombre:   nombreFinal,
      cliente_ruc:      rucFinal,
      condicion_venta:  condicionVenta || 'contado',
      metodo_pago:      metodoPago || pedido.metodo_pago || 'efectivo',
      total:            calculo.total,
      iva_10:           calculo.iva10,
      iva_5:            calculo.iva5,
      exenta:           calculo.exenta,
      sucursal_id:      pedido.sucursal_id || null,
      usuario_id:       usuarioId || pedido.usuario_id || null,
    };

    const facturaGuardada = await facturaRepository.crear(payload);

    // Formatear ítems para que el modal y visor puedan renderizarlos de inmediato
    const itemsFormateados = items.map((it) => ({
      cantidad: it.cantidad,
      precio:   it.producto?.precio || it.precio || 0,
      nombre:   it.producto?.nombre || it.nombre || 'Producto',
    }));

    return {
      ...facturaGuardada,
      items: itemsFormateados,
      pedido,
    };
  }

  /**
   * Obtiene la lista de facturas emitidas.
   */
  async getFacturas(sucursalId = null) {
    return await facturaRepository.getFacturas(sucursalId);
  }

  /**
   * Busca la factura de un pedido.
   */
  async getPorPedidoId(pedidoId) {
    return await facturaRepository.getPorPedidoId(pedidoId);
  }

  /**
   * Calcula métricas globales de facturación.
   */
  calcularResumenFacturacion(facturas = []) {
    const totalFacturado = facturas.reduce((sum, f) => sum + (Number(f.total) || 0), 0);
    const totalIva10 = facturas.reduce((sum, f) => sum + (Number(f.iva_10) || 0), 0);

    return {
      totalFacturado,
      totalIva10,
      cantidadComprobantes: facturas.length,
    };
  }

  /**
   * Genera el HTML formateado para ticket térmico de 58/80mm listo para imprimir.
   */
  generarHTMLTicket(factura, items = [], sucursalNombre = 'Sucursal Principal') {
    const formatNumber = (num) => Number(num || 0).toLocaleString('es-AR');
    const calculo = this.calcularIVA(factura.total);

    const itemsHTML = items
      .map(
        (it) => `
        <tr>
          <td style="text-align: left; padding: 3px 0;">${it.cantidad}x ${it.nombre}</td>
          <td style="text-align: right; padding: 3px 0;">Gs. ${formatNumber(it.precio * it.cantidad)}</td>
        </tr>`
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Ticket ${factura.numero_factura}</title>
        <style>
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 280px;
            margin: 0 auto;
            padding: 10px;
            font-size: 12px;
            color: #000;
          }
          .header, .footer { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
          table { width: 100%; border-collapse: collapse; }
          .right { text-align: right; }
          .total-box { font-size: 15px; font-weight: bold; margin: 8px 0; text-align: right; }
          @media print {
            body { width: 100%; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="bold" style="font-size: 16px;">${DATOS_EMPRESA.nombreFantasia}</div>
          <div>${DATOS_EMPRESA.razonSocial}</div>
          <div>RUC: ${DATOS_EMPRESA.ruc}</div>
          <div>Timbrado N°: ${DATOS_EMPRESA.timbrado}</div>
          <div>${DATOS_EMPRESA.vigencia}</div>
          <div>📍 ${sucursalNombre}</div>
        </div>

        <div class="divider"></div>

        <div><b>FACTURA:</b> ${factura.numero_factura}</div>
        <div><b>FECHA:</b> ${new Date(factura.created_at || Date.now()).toLocaleString('es-PY')}</div>
        <div><b>CLIENTE:</b> ${factura.cliente_nombre}</div>
        <div><b>RUC/CI:</b> ${factura.cliente_ruc}</div>
        <div><b>CONDICIÓN:</b> ${factura.condicion_venta?.toUpperCase()}</div>
        <div><b>PAGO:</b> ${factura.metodo_pago?.toUpperCase()}</div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr>
              <th style="text-align: left;">DESCRIPCIÓN</th>
              <th style="text-align: right;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="total-box">
          TOTAL: Gs. ${formatNumber(factura.total)}
        </div>

        <div class="divider"></div>

        <div style="font-size: 11px;">
          <div><b>LIQUIDACIÓN DEL IVA:</b></div>
          <div style="display: flex; justify-content: space-between;">
            <span>Gravadas 10%: Gs. ${formatNumber(calculo.gravada10)}</span>
            <span>IVA 10%: Gs. ${formatNumber(calculo.iva10)}</span>
          </div>
          <div><b>TOTAL IVA: Gs. ${formatNumber(calculo.totalIva)}</b></div>
        </div>

        <div class="divider"></div>

        <div class="footer">
          <div class="bold">¡GRACIAS POR SU PREFERENCIA!</div>
          <div style="font-size: 10px; margin-top: 4px;">Original: Cliente · Duplicado: Archivo Tributario</div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Dispara la impresión nativa si se ejecuta en navegador Web.
   */
  imprimirTicket(factura, items = [], sucursalNombre = 'Sucursal Principal') {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const html = this.generarHTMLTicket(factura, items, sucursalNombre);
      const printWindow = window.open('', '_blank', 'width=350,height=600');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
      }
    }
  }
}

// Exportar como Singleton
export default new FacturaService();

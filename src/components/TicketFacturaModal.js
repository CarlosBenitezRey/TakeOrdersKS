import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import facturaService, { DATOS_EMPRESA } from '../services/FacturaService';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../theme/theme';

const formatPrice = (value) => Number(value || 0).toLocaleString('es-AR');

export default function TicketFacturaModal({
  visible,
  onClose,
  factura,
  items = [],
  sucursalNombre = 'Sucursal Principal',
}) {
  const [modo, setModo] = useState('ticket'); // 'ticket' | 'legal'

  if (!factura) return null;

  const calculo = facturaService.calcularIVA(factura.total);
  const fechaStr = new Date(factura.created_at || Date.now()).toLocaleString('es-PY');

  const handleImprimir = () => {
    facturaService.imprimirTicket(factura, items, sucursalNombre);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* ── BARRA SUPERIOR CON ACCIONES ─────────────────────────────────── */}
          <View style={styles.topBar}>
            <View style={styles.modeSwitcher}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  modo === 'ticket' && styles.modeButtonActive,
                ]}
                onPress={() => setModo('ticket')}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    modo === 'ticket' && styles.modeButtonTextActive,
                  ]}
                >
                  🧾 Ticket Térmico
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeButton,
                  modo === 'legal' && styles.modeButtonActive,
                ]}
                onPress={() => setModo('legal')}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    modo === 'legal' && styles.modeButtonTextActive,
                  ]}
                >
                  📄 Factura Legal
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ── CUERPO DEL COMPROBANTE ──────────────────────────────────────── */}
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {modo === 'ticket' ? (
              // ─── TICKET TÉRMICO (ESTILO COMANDA) ─────────────────────────
              <View style={styles.thermalTicket}>
                <View style={styles.thermalHeader}>
                  <Text style={styles.thermalBrand}>{DATOS_EMPRESA.nombreFantasia}</Text>
                  <Text style={styles.thermalCompany}>{DATOS_EMPRESA.razonSocial}</Text>
                  <Text style={styles.thermalInfo}>RUC: {DATOS_EMPRESA.ruc}</Text>
                  <Text style={styles.thermalInfo}>Timbrado N°: {DATOS_EMPRESA.timbrado}</Text>
                  <Text style={styles.thermalInfo}>{DATOS_EMPRESA.vigencia}</Text>
                  <Text style={styles.thermalInfo}>📍 {sucursalNombre}</Text>
                </View>

                <View style={styles.dashedLine} />

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>FACTURA:</Text>
                  <Text style={styles.receiptValueBold}>{factura.numero_factura}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>FECHA:</Text>
                  <Text style={styles.receiptValue}>{fechaStr}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>CLIENTE:</Text>
                  <Text style={styles.receiptValueBold}>{factura.cliente_nombre}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>RUC / CI:</Text>
                  <Text style={styles.receiptValue}>{factura.cliente_ruc}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>CONDICIÓN:</Text>
                  <Text style={styles.receiptValue}>
                    {factura.condicion_venta?.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>PAGO:</Text>
                  <Text style={styles.receiptValue}>
                    {factura.metodo_pago?.toUpperCase()}
                  </Text>
                </View>
                {factura.pedido?.mesa && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>MESA:</Text>
                    <Text style={styles.receiptValue}>{factura.pedido.mesa}</Text>
                  </View>
                )}

                <View style={styles.dashedLine} />

                {/* Tabla de ítems */}
                <View style={styles.itemsHeader}>
                  <Text style={[styles.itemsCol, { flex: 2 }]}>DESCRIPCIÓN</Text>
                  <Text style={[styles.itemsCol, { flex: 1, textAlign: 'right' }]}>
                    TOTAL
                  </Text>
                </View>
                <View style={styles.solidLine} />

                {items.map((it, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={[styles.itemText, { flex: 2 }]}>
                      {it.cantidad}x {it.nombre}
                    </Text>
                    <Text style={[styles.itemText, { flex: 1, textAlign: 'right' }]}>
                      Gs. {formatPrice(it.precio * it.cantidad)}
                    </Text>
                  </View>
                ))}

                <View style={styles.dashedLine} />

                {/* Total */}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>TOTAL A PAGAR:</Text>
                  <Text style={styles.totalValue}>Gs. {formatPrice(factura.total)}</Text>
                </View>

                <View style={styles.dashedLine} />

                {/* Liquidación de IVA */}
                <View style={styles.ivaBox}>
                  <Text style={styles.ivaTitle}>LIQUIDACIÓN DEL IVA</Text>
                  <View style={styles.ivaRow}>
                    <Text style={styles.ivaText}>Gravadas 10%:</Text>
                    <Text style={styles.ivaText}>Gs. {formatPrice(calculo.gravada10)}</Text>
                  </View>
                  <View style={styles.ivaRow}>
                    <Text style={styles.ivaText}>Liquidación IVA 10%:</Text>
                    <Text style={styles.ivaText}>Gs. {formatPrice(calculo.iva10)}</Text>
                  </View>
                  <View style={[styles.ivaRow, { marginTop: 2 }]}>
                    <Text style={styles.ivaTextBold}>TOTAL IVA:</Text>
                    <Text style={styles.ivaTextBold}>Gs. {formatPrice(calculo.totalIva)}</Text>
                  </View>
                </View>

                <View style={styles.dashedLine} />

                <View style={styles.thermalFooter}>
                  <Text style={styles.footerThanks}>¡GRACIAS POR SU PREFERENCIA!</Text>
                  <Text style={styles.footerLegal}>
                    Original: Cliente · Duplicado: Archivo Tributario
                  </Text>
                  <Text style={styles.barcodeSim}>||| || ||||| |||| ||| |||| || |||</Text>
                </View>
              </View>
            ) : (
              // ─── FACTURA LEGAL FORMATO A4 ─────────────────────────────────
              <View style={styles.legalInvoice}>
                <View style={styles.legalTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.legalBrand}>{DATOS_EMPRESA.nombreFantasia}</Text>
                    <Text style={styles.legalText}>{DATOS_EMPRESA.razonSocial}</Text>
                    <Text style={styles.legalText}>{DATOS_EMPRESA.actividad}</Text>
                    <Text style={styles.legalText}>{DATOS_EMPRESA.direccion}</Text>
                    <Text style={styles.legalText}>Tel: {DATOS_EMPRESA.telefono}</Text>
                  </View>
                  <View style={styles.legalTimbradoBox}>
                    <Text style={styles.legalTimbradoTitle}>TIMBRADO N°</Text>
                    <Text style={styles.legalTimbradoVal}>{DATOS_EMPRESA.timbrado}</Text>
                    <Text style={styles.legalTimbradoDate}>{DATOS_EMPRESA.vigencia}</Text>
                    <Text style={styles.legalRucBox}>RUC: {DATOS_EMPRESA.ruc}</Text>
                    <Text style={styles.legalFacturaNum}>N° {factura.numero_factura}</Text>
                  </View>
                </View>

                <View style={styles.legalClientBox}>
                  <View style={styles.legalRow}>
                    <Text style={styles.legalLabel}>Fecha de Emisión: </Text>
                    <Text style={styles.legalVal}>{fechaStr}</Text>
                  </View>
                  <View style={styles.legalRow}>
                    <Text style={styles.legalLabel}>Nombre o Razón Social: </Text>
                    <Text style={styles.legalVal}>{factura.cliente_nombre}</Text>
                  </View>
                  <View style={styles.legalRow}>
                    <Text style={styles.legalLabel}>RUC / C.I.: </Text>
                    <Text style={styles.legalVal}>{factura.cliente_ruc}</Text>
                    <Text style={[styles.legalLabel, { marginLeft: 16 }]}>Condición: </Text>
                    <Text style={styles.legalVal}>{factura.condicion_venta?.toUpperCase()}</Text>
                  </View>
                </View>

                {/* Tabla de ítems formal */}
                <View style={styles.legalTable}>
                  <View style={styles.legalTableHeader}>
                    <Text style={[styles.legalTh, { width: 40 }]}>CANT.</Text>
                    <Text style={[styles.legalTh, { flex: 2 }]}>DESCRIPCIÓN</Text>
                    <Text style={[styles.legalTh, { flex: 1, textAlign: 'right' }]}>P. UNIT.</Text>
                    <Text style={[styles.legalTh, { flex: 1, textAlign: 'right' }]}>VALOR 10%</Text>
                  </View>

                  {items.map((it, idx) => (
                    <View key={idx} style={styles.legalTableRow}>
                      <Text style={[styles.legalTd, { width: 40 }]}>{it.cantidad}</Text>
                      <Text style={[styles.legalTd, { flex: 2 }]}>{it.nombre}</Text>
                      <Text style={[styles.legalTd, { flex: 1, textAlign: 'right' }]}>
                        {formatPrice(it.precio)}
                      </Text>
                      <Text style={[styles.legalTd, { flex: 1, textAlign: 'right' }]}>
                        {formatPrice(it.precio * it.cantidad)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Subtotales y Total */}
                <View style={styles.legalTotalBox}>
                  <Text style={styles.legalTotalLabel}>SUBTOTAL:</Text>
                  <Text style={styles.legalTotalVal}>Gs. {formatPrice(factura.total)}</Text>
                </View>
                <View style={styles.legalTotalBoxFinal}>
                  <Text style={styles.legalTotalLabelFinal}>TOTAL A PAGAR:</Text>
                  <Text style={styles.legalTotalValFinal}>
                    Gs. {formatPrice(factura.total)}
                  </Text>
                </View>

                <View style={styles.legalIvaGrid}>
                  <Text style={styles.legalIvaItem}>
                    Liquidación IVA: (5%): 0 · (10%): Gs. {formatPrice(calculo.iva10)} · TOTAL IVA: Gs. {formatPrice(calculo.totalIva)}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* ── BOTONES DE ACCIÓN INFERIORES ─────────────────────────────────── */}
          <View style={styles.bottomBar}>
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={styles.printButton}
                onPress={handleImprimir}
              >
                <Text style={styles.printButtonText}>🖨️ Imprimir / Guardar PDF</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.doneButton} onPress={onClose}>
              <Text style={styles.doneButtonText}>Cerrar Comprobante</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  container: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: 3,
  },
  modeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  modeButtonActive: {
    backgroundColor: COLORS.cardElevated,
  },
  modeButtonText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  closeBtnText: {
    color: COLORS.textMuted,
    fontSize: 20,
    fontWeight: '700',
  },
  scrollContent: {
    padding: SPACING.md,
  },
  scrollInner: {
    alignItems: 'center',
    paddingBottom: SPACING.md,
  },

  // ─── TICKET TÉRMICO ────────────────────────────────────────────────────────
  thermalTicket: {
    backgroundColor: '#FFFDF9',
    width: '100%',
    maxWidth: 340,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  thermalHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  thermalBrand: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111',
    letterSpacing: 1,
  },
  thermalCompany: {
    fontSize: 11,
    color: '#333',
    fontWeight: '600',
  },
  thermalInfo: {
    fontSize: 10,
    color: '#555',
  },
  dashedLine: {
    borderBottomWidth: 1,
    borderColor: '#999',
    borderStyle: 'dashed',
    marginVertical: 8,
  },
  solidLine: {
    borderBottomWidth: 1,
    borderColor: '#222',
    marginVertical: 4,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 1,
  },
  receiptLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#444',
  },
  receiptValue: {
    fontSize: 11,
    color: '#222',
  },
  receiptValueBold: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
  },
  itemsHeader: {
    flexDirection: 'row',
    marginTop: 4,
  },
  itemsCol: {
    fontSize: 10,
    fontWeight: '800',
    color: '#111',
  },
  itemRow: {
    flexDirection: 'row',
    marginVertical: 3,
  },
  itemText: {
    fontSize: 11,
    color: '#222',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
  },
  ivaBox: {
    paddingVertical: 2,
  },
  ivaTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#333',
    marginBottom: 2,
  },
  ivaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ivaText: {
    fontSize: 10,
    color: '#555',
  },
  ivaTextBold: {
    fontSize: 10,
    fontWeight: '800',
    color: '#111',
  },
  thermalFooter: {
    alignItems: 'center',
    marginTop: 4,
  },
  footerThanks: {
    fontSize: 11,
    fontWeight: '800',
    color: '#222',
    marginTop: 2,
  },
  footerLegal: {
    fontSize: 9,
    color: '#666',
    marginTop: 2,
  },
  barcodeSim: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 2,
    fontSize: 12,
    color: '#333',
    marginTop: 6,
  },

  // ─── FACTURA LEGAL A4 ──────────────────────────────────────────────────────
  legalInvoice: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    padding: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CCC',
  },
  legalTop: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    paddingBottom: 8,
  },
  legalBrand: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1B365D',
  },
  legalText: {
    fontSize: 10,
    color: '#333',
  },
  legalTimbradoBox: {
    borderWidth: 1,
    borderColor: '#1B365D',
    borderRadius: 4,
    padding: 6,
    alignItems: 'center',
    width: 150,
  },
  legalTimbradoTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1B365D',
  },
  legalTimbradoVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
  },
  legalTimbradoDate: {
    fontSize: 8,
    color: '#555',
  },
  legalRucBox: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  legalFacturaNum: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C0392B',
    marginTop: 2,
  },
  legalClientBox: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 4,
    padding: 6,
    marginVertical: 8,
  },
  legalRow: {
    flexDirection: 'row',
    marginVertical: 1,
  },
  legalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#444',
  },
  legalVal: {
    fontSize: 10,
    color: '#111',
  },
  legalTable: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  legalTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F0F4F8',
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#CCC',
  },
  legalTh: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1B365D',
  },
  legalTableRow: {
    flexDirection: 'row',
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  legalTd: {
    fontSize: 10,
    color: '#333',
  },
  legalTotalBox: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 6,
    gap: 8,
  },
  legalTotalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
  },
  legalTotalVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111',
  },
  legalTotalBoxFinal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 4,
    gap: 8,
  },
  legalTotalLabelFinal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
  },
  legalTotalValFinal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1B365D',
  },
  legalIvaGrid: {
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 4,
    marginTop: 6,
  },
  legalIvaItem: {
    fontSize: 9,
    color: '#333',
    fontStyle: 'italic',
  },

  // ─── BOTONES INFERIORES ────────────────────────────────────────────────────
  bottomBar: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
    gap: 8,
  },
  printButton: {
    backgroundColor: COLORS.primary,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  printButtonText: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: 14,
  },
  doneButton: {
    backgroundColor: COLORS.cardElevated,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 13,
  },
});

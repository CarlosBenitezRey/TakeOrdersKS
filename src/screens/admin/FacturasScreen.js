import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import facturaService from '../../services/FacturaService';
import productService from '../../services/ProductService';
import TicketFacturaModal from '../../components/TicketFacturaModal';
import PremiumLoader from '../../components/PremiumLoader';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../theme/theme';

const formatPrice = (value) => Number(value || 0).toLocaleString('es-AR');

export default function FacturasScreen({ userProfile, onClose }) {
  const [facturas, setFacturas] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSucursalId, setSelectedSucursalId] = useState(
    userProfile?.sucursal_id || 'all'
  );

  // Modal para ver comprobante individual
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);
  const [itemsSeleccionados, setItemsSeleccionados] = useState([]);

  const cargarFacturas = useCallback(async () => {
    try {
      setLoading(true);
      const sucursalParam = selectedSucursalId === 'all' ? null : selectedSucursalId;

      const [resFacturas, resSucursales] = await Promise.all([
        facturaService.getFacturas(sucursalParam),
        productService.getSucursales(),
      ]);

      setFacturas(resFacturas);
      setSucursales(resSucursales);
    } catch (error) {
      console.error('Error cargando facturas:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedSucursalId]);

  useEffect(() => {
    cargarFacturas();
  }, [cargarFacturas]);

  const handleVerComprobante = (factura) => {
    // Extraer ítems desde la relación con detalle_pedido
    const items = (factura.pedidos?.detalle_pedido || []).map((d) => ({
      cantidad: d.cantidad,
      precio: d.precio,
      nombre: d.productos?.nombre || 'Producto',
    }));

    setFacturaSeleccionada(factura);
    setItemsSeleccionados(items);
  };

  // Filtrado por buscador
  const facturasFiltradas = facturas.filter((f) => {
    const q = searchQuery.toLowerCase();
    const coincideNumero = f.numero_factura?.toLowerCase().includes(q);
    const coincideCliente = f.cliente_nombre?.toLowerCase().includes(q);
    const coincideRuc = f.cliente_ruc?.toLowerCase().includes(q);
    return coincideNumero || coincideCliente || coincideRuc;
  });

  const resumen = facturaService.calcularResumenFacturacion(facturasFiltradas);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={POS_COLORS.canvas} />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Facturas y Comprobantes</Text>
          <Text style={styles.headerSubtitle}>
            Historial de ventas y comprobantes fiscales
          </Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* ── FILTRO POR SUCURSAL ────────────────────────────────────────────── */}
      {!userProfile?.sucursal_id && sucursales.length > 0 && (
        <View style={styles.sucursalBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sucursalList}>
            <TouchableOpacity
              style={[
                styles.sucursalPill,
                selectedSucursalId === 'all' && styles.sucursalPillActive,
              ]}
              onPress={() => setSelectedSucursalId('all')}
            >
              <Text
                style={[
                  styles.sucursalPillText,
                  selectedSucursalId === 'all' && styles.sucursalPillTextActive,
                ]}
              >
                Todas las Sucursales
              </Text>
            </TouchableOpacity>
            {sucursales.map((suc) => (
              <TouchableOpacity
                key={suc.id}
                style={[
                  styles.sucursalPill,
                  selectedSucursalId === suc.id && styles.sucursalPillActive,
                ]}
                onPress={() => setSelectedSucursalId(suc.id)}
              >
                <Text
                  style={[
                    styles.sucursalPillText,
                    selectedSucursalId === suc.id && styles.sucursalPillTextActive,
                  ]}
                >
                  📍 {suc.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── BANNER DE KPIS ─────────────────────────────────────────────────── */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>TOTAL FACTURADO</Text>
          <Text style={styles.kpiValue}>Gs. {formatPrice(resumen.totalFacturado)}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>TOTAL IVA 10%</Text>
          <Text style={[styles.kpiValue, { color: POS_COLORS.primaryDark }]}>
            Gs. {formatPrice(resumen.totalIva10)}
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>COMPROBANTES</Text>
          <Text style={[styles.kpiValue, { color: POS_COLORS.primary }]}>
            {resumen.cantidadComprobantes}
          </Text>
        </View>
      </View>

      {/* ── BUSCADOR ───────────────────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por cliente, RUC o N° de factura..."
          placeholderTextColor={POS_COLORS.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── LISTADO DE FACTURAS ────────────────────────────────────────────── */}
      {loading ? (
        <PremiumLoader
          message="Cargando comprobantes"
          detail="Organizando facturas y tickets"
        />
      ) : facturasFiltradas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🧾</Text>
          <Text style={styles.emptyTitle}>Sin facturas encontradas</Text>
          <Text style={styles.emptySub}>
            No hay comprobantes que coincidan con la búsqueda o sucursal seleccionada.
          </Text>
        </View>
      ) : (
        <FlatList
          data={facturasFiltradas}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.facturaCard}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.facturaNum}>{item.numero_factura}</Text>
                  <Text style={styles.clienteName}>{item.cliente_nombre}</Text>
                  <Text style={styles.clienteRuc}>RUC / CI: {item.cliente_ruc}</Text>
                </View>

                <View style={styles.amountBox}>
                  <Text style={styles.amountTotal}>Gs. {formatPrice(item.total)}</Text>
                  <Text style={styles.amountIva}>IVA 10%: Gs. {formatPrice(item.iva_10)}</Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.cardBottom}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dateText}>
                    📅 {new Date(item.created_at).toLocaleString('es-PY')}
                  </Text>
                  <Text style={styles.metaText}>
                    💳 {item.metodo_pago?.toUpperCase()} · {item.condicion_venta?.toUpperCase()}
                    {item.sucursales?.nombre ? ` · 📍 ${item.sucursales.nombre}` : ''}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.viewTicketBtn}
                  onPress={() => handleVerComprobante(item)}
                >
                  <Text style={styles.viewTicketBtnText}>🧾 Ver Ticket</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* ── MODAL VISOR DE TICKET / FACTURA ─────────────────────────────────── */}
      {facturaSeleccionada && (
        <TicketFacturaModal
          visible={!!facturaSeleccionada}
          onClose={() => setFacturaSeleccionada(null)}
          factura={facturaSeleccionada}
          items={itemsSeleccionados}
          sucursalNombre={facturaSeleccionada.sucursales?.nombre || 'Sucursal Principal'}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: POS_COLORS.canvas,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: POS_COLORS.surfaceStrong,
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.line,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 18,
    fontWeight: '900',
    color: POS_COLORS.ink,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: POS_COLORS.muted,
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: POS_COLORS.muted,
    fontSize: 16,
    fontWeight: '700',
  },
  sucursalBar: {
    backgroundColor: POS_COLORS.surfaceStrong,
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.line,
    paddingVertical: 6,
  },
  sucursalList: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  sucursalPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  sucursalPillActive: {
    backgroundColor: POS_COLORS.primaryDark,
    borderColor: POS_COLORS.primaryDark,
  },
  sucursalPillText: {
    fontSize: 12,
    color: POS_COLORS.muted,
    fontWeight: '600',
  },
  sucursalPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: POS_COLORS.surfaceStrong,
    padding: SPACING.sm + 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    borderLeftWidth: 3,
    borderLeftColor: POS_COLORS.primary,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 10,
    color: POS_COLORS.muted,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: '900',
    color: POS_COLORS.ink,
    marginTop: 4,
  },
  searchContainer: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    position: 'relative',
  },
  searchInput: {
    height: 44,
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    color: POS_COLORS.ink,
    fontSize: 13,
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  clearSearchText: {
    color: POS_COLORS.muted,
    fontSize: 16,
    fontWeight: '700',
  },
  listContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  facturaCard: {
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  facturaNum: {
    fontSize: 14,
    fontWeight: '800',
    color: POS_COLORS.primaryDark,
  },
  clienteName: {
    fontSize: 15,
    fontWeight: '800',
    color: POS_COLORS.ink,
    marginTop: 2,
  },
  clienteRuc: {
    fontSize: 12,
    color: POS_COLORS.muted,
    marginTop: 1,
  },
  amountBox: {
    alignItems: 'flex-end',
  },
  amountTotal: {
    fontSize: 16,
    fontWeight: '900',
    color: POS_COLORS.ink,
  },
  amountIva: {
    fontSize: 11,
    color: POS_COLORS.primary,
    marginTop: 2,
    fontWeight: '700',
  },
  cardDivider: {
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.line,
    marginVertical: SPACING.sm,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11,
    color: POS_COLORS.muted,
  },
  metaText: {
    fontSize: 11,
    color: POS_COLORS.muted,
    marginTop: 2,
  },
  viewTicketBtn: {
    backgroundColor: POS_COLORS.primarySoft,
    borderWidth: 1,
    borderColor: POS_COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  viewTicketBtnText: {
    color: POS_COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    color: POS_COLORS.ink,
    fontWeight: '800',
  },
  emptySub: {
    ...TYPOGRAPHY.caption,
    color: POS_COLORS.muted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
});

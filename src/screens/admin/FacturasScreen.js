import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import facturaService from '../../services/FacturaService';
import productService from '../../services/ProductService';
import TicketFacturaModal from '../../components/TicketFacturaModal';
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
      precio:   d.precio,
      nombre:   d.productos?.nombre || 'Producto',
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

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
          <Text style={[styles.kpiValue, { color: COLORS.success }]}>
            Gs. {formatPrice(resumen.totalIva10)}
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>COMPROBANTES</Text>
          <Text style={[styles.kpiValue, { color: COLORS.secondary }]}>
            {resumen.cantidadComprobantes}
          </Text>
        </View>
      </View>

      {/* ── BUSCADOR ───────────────────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por cliente, RUC o N° de factura..."
          placeholderTextColor={COLORS.textMuted}
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
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Cargando comprobantes...</Text>
        </View>
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
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.primary,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  closeBtnText: {
    color: COLORS.textMuted,
    fontSize: 22,
    fontWeight: '700',
  },
  sucursalBar: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 6,
  },
  sucursalList: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  sucursalPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sucursalPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sucursalPillText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  sucursalPillTextActive: {
    color: COLORS.textLight,
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
    backgroundColor: COLORS.card,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
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
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    fontSize: 13,
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  clearSearchText: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  listContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  facturaCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  facturaNum: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  clienteName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  clienteRuc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  amountBox: {
    alignItems: 'flex-end',
  },
  amountTotal: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
  },
  amountIva: {
    fontSize: 11,
    color: COLORS.success,
    marginTop: 2,
    fontWeight: '600',
  },
  cardDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: SPACING.sm,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  metaText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  viewTicketBtn: {
    backgroundColor: 'rgba(92, 139, 248, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  viewTicketBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    fontSize: 13,
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
    color: COLORS.text,
  },
  emptySub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
});

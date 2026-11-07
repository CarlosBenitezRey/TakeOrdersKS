import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
  Modal,
} from 'react-native';
import orderService from '../services/OrderService';
import authService from '../services/AuthService';
import productService from '../services/ProductService';
import PremiumLoader from '../components/PremiumLoader';
import { COLORS, POS_COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../theme/theme';

export default function CocinaScreen({
  userProfile,
  onSwitchView,
  onNavigateDelivery,
}) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pedidoAEliminar, setPedidoAEliminar] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [selectedSucursalId, setSelectedSucursalId] = useState(
    userProfile?.sucursal_id || 'all'
  );

  // ─── Carga inicial y suscripción Realtime ────────────────────────────────────

  useEffect(() => {
    if (!userProfile?.sucursal_id) {
      productService
        .getSucursales()
        .then((data) => setSucursales(data))
        .catch((err) => console.log('Error cargando sucursales en Cocina:', err));
    }
  }, []);

  useEffect(() => {
    cargarPedidos(selectedSucursalId);

    const channel = orderService.suscribirCambiosPedidos(() => {
      cargarPedidos(selectedSucursalId);
    });

    return () => orderService.cancelarSuscripcion(channel);
  }, [selectedSucursalId]);

  // ─── Handlers de datos ───────────────────────────────────────────────────────

  const cargarPedidos = async (sucursalId) => {
    try {
      setLoading(true);
      const data = await orderService.getPedidosActivos(
        sucursalId,
        userProfile?.sucursal_id
      );
      setPedidos(data);
    } catch (error) {
      console.error('Error cargando pedidos:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const actualizarEstadoPedido = async (pedidoId, estadoActual, nuevoEstado) => {
    try {
      await orderService.cambiarEstado(pedidoId, estadoActual, nuevoEstado);

      // Actualización optimista del estado local (se agrega al final de la lista destino)
      if (nuevoEstado === 'entregado') {
        setPedidos((current) => current.filter((p) => p.id !== pedidoId));
      } else {
        setPedidos((current) => {
          const pedidoObjetivo = current.find((p) => p.id === pedidoId);
          if (!pedidoObjetivo) return current;
          const restantes = current.filter((p) => p.id !== pedidoId);
          return [...restantes, { ...pedidoObjetivo, estado: nuevoEstado }];
        });
      }
    } catch (error) {
      console.error('Error actualizando estado:', error.message);
    }
  };

  const handleEliminarPedido = async (pedidoId) => {
    try {
      setLoading(true);
      await orderService.eliminarPedido(pedidoId);
      setPedidos((current) => current.filter((p) => p.id !== pedidoId));
      setPedidoAEliminar(null);
    } catch (error) {
      console.error('Error eliminando pedido:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error.message);
    }
  };

  // ─── Utilidades de UI ─────────────────────────────────────────────────────────

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const ordenarPorLlegada = (lista) =>
    [...lista].sort((a, b) => {
      const timeA = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b?.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return (Number(a?.numero) || 0) - (Number(b?.numero) || 0);
    });

  // Todos los pendientes entran a cocina (incluyendo local, retiro y delivery)
  const pendientes = ordenarPorLlegada(
    pedidos.filter((p) => p.estado === 'pendiente')
  );

  // Cuando un pedido de delivery se marca como "listo", pasa a DeliveryScreen
  const listosMostrador = ordenarPorLlegada(
    pedidos.filter(
      (p) => p.estado === 'listo' && !orderService.extraerDatosEntrega(p).esDelivery
    )
  );

  const listosDeliveryCount = pedidos.filter(
    (p) => p.estado === 'listo' && orderService.extraerDatosEntrega(p).esDelivery
  ).length;

  // ─── Render ──────────────────────────────────────────────────────────────────

  const renderPedido = ({ item }) => {
    const isPendiente = item.estado === 'pendiente';
    const textColor = isPendiente ? POS_COLORS.ink : '#FFFFFF';
    const textMutedColor = isPendiente ? POS_COLORS.muted : 'rgba(255, 255, 255, 0.85)';
    const infoEntrega = orderService.extraerDatosEntrega(item);

    const modalidadLabel = infoEntrega.esDelivery
      ? 'Delivery'
      : infoEntrega.esRetiro
      ? 'Para retirar'
      : item.mesa
      ? `Mesa: ${item.mesa}`
      : 'En el local';

    return (
      <View style={[styles.pedidoCard, !isPendiente && styles.pedidoCardListo]}>
        <View style={styles.pedidoHeader}>
          <Text style={[styles.pedidoId, { color: textColor }]}>
            Pedido #{item.numero || item.id.toString().slice(0, 5).toUpperCase()}
          </Text>
          <Text style={[styles.pedidoTime, { color: textMutedColor }]}>
            {formatTime(item.created_at)}
          </Text>
        </View>

        <View style={styles.pedidoInfo}>
          <Text
            style={[
              styles.pedidoMetaText,
              {
                color: isPendiente
                  ? infoEntrega.esDelivery
                    ? POS_COLORS.primaryDark
                    : POS_COLORS.ink
                  : '#FFFFFF',
                backgroundColor: isPendiente
                  ? infoEntrega.esDelivery
                    ? POS_COLORS.primarySoft
                    : POS_COLORS.surface
                  : 'rgba(255, 255, 255, 0.18)',
                borderWidth: isPendiente ? 1 : 0,
                borderColor: isPendiente
                  ? infoEntrega.esDelivery
                    ? '#C7DDCE'
                    : POS_COLORS.line
                  : 'transparent',
              },
            ]}
          >
            {modalidadLabel}
          </Text>

          {item.cliente ? (
            <Text
              style={[
                styles.pedidoMetaText,
                {
                  color: isPendiente ? POS_COLORS.ink : '#FFFFFF',
                  backgroundColor: isPendiente
                    ? POS_COLORS.surface
                    : 'rgba(255, 255, 255, 0.18)',
                  borderWidth: isPendiente ? 1 : 0,
                  borderColor: isPendiente ? POS_COLORS.line : 'transparent',
                },
              ]}
            >
              Cliente: {item.cliente}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.divider,
            {
              backgroundColor: isPendiente ? POS_COLORS.line : 'rgba(255, 255, 255, 0.25)',
            },
          ]}
        />

        <View style={styles.detallesContainer}>
          {item.detalle_pedido?.map((detalle, index) => (
            <View key={index} style={styles.detalleItem}>
              <Text
                style={[
                  styles.detalleCantidad,
                  { color: isPendiente ? POS_COLORS.primaryDark : '#FFFFFF' },
                ]}
              >
                {detalle.cantidad}x
              </Text>
              <Text style={[styles.detalleNombre, { color: textColor }]}>
                {detalle.productos?.nombre}
              </Text>
            </View>
          ))}
        </View>

        {item.notas ? (
          <View
            style={[
              styles.notasContainer,
              {
                backgroundColor: isPendiente
                  ? 'rgba(245, 158, 11, 0.1)'
                  : 'rgba(255, 255, 255, 0.15)',
                borderColor: isPendiente
                  ? 'rgba(245, 158, 11, 0.3)'
                  : 'rgba(255, 255, 255, 0.4)',
              },
            ]}
          >
            <Text style={[styles.notasTitle, { color: isPendiente ? '#D97706' : '#FFFFFF' }]}>
              Notas:
            </Text>
            <Text style={[styles.notasText, { color: textColor }]}>{item.notas}</Text>
          </View>
        ) : null}

        <View style={styles.actionContainer}>
          {isPendiente ? (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.buttonEliminar]}
                onPress={() => setPedidoAEliminar(item.id)}
              >
                <Text style={[styles.actionButtonText, { color: COLORS.danger }]}>Borrar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.buttonListo]}
                onPress={() => actualizarEstadoPedido(item.id, 'pendiente', 'listo')}
              >
                <Text style={styles.actionButtonText}>
                  {infoEntrega.esDelivery
                    ? 'Listo → Enviar a Delivery'
                    : 'Marcar como Listo'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.buttonEntregado]}
              onPress={() => actualizarEstadoPedido(item.id, 'listo', 'entregado')}
            >
              <Text style={[styles.actionButtonText, { color: POS_COLORS.primaryDark }]}>
                Entregado (Quitar)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={POS_COLORS.canvas} />

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Cocina</Text>
          <Text style={styles.headerSubtitle}>Preparación de pedidos</Text>
        </View>
        <View style={styles.headerActions}>
          {onNavigateDelivery && (
            <TouchableOpacity
              style={[
                styles.headerActionButton,
                listosDeliveryCount > 0 && styles.deliveryHeaderButtonActive,
              ]}
              onPress={onNavigateDelivery}
            >
              <Text
                style={[
                  styles.headerActionText,
                  listosDeliveryCount > 0 && styles.deliveryHeaderTextActive,
                ]}
              >
                Delivery{listosDeliveryCount > 0 ? ` (${listosDeliveryCount})` : ''}
              </Text>
            </TouchableOpacity>
          )}
          {onSwitchView && (
            <TouchableOpacity style={styles.headerActionButton} onPress={onSwitchView}>
              <Text style={styles.headerActionText}>Volver</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.headerActionButton, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && pedidos.length === 0 ? (
        <PremiumLoader
          message="Preparando cocina"
          detail="Sincronizando pedidos y comandas"
        />
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {/* SELECTOR DE SUCURSAL (Solo para Administrador General) */}
          {!userProfile?.sucursal_id && sucursales.length > 0 && (
            <View style={styles.sucursalFilterCard}>
              <Text style={styles.sucursalFilterLabel}>Monitorear Local:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sucursalFilterList}
              >
                <TouchableOpacity
                  style={[
                    styles.sucursalFilterButton,
                    selectedSucursalId === 'all' && styles.sucursalFilterButtonSelected,
                  ]}
                  onPress={() => setSelectedSucursalId('all')}
                >
                  <Text
                    style={[
                      styles.sucursalFilterButtonText,
                      selectedSucursalId === 'all' && styles.sucursalFilterButtonTextSelected,
                    ]}
                  >
                    Todos
                  </Text>
                </TouchableOpacity>
                {sucursales.map((suc) => (
                  <TouchableOpacity
                    key={suc.id}
                    style={[
                      styles.sucursalFilterButton,
                      selectedSucursalId === suc.id && styles.sucursalFilterButtonSelected,
                    ]}
                    onPress={() => setSelectedSucursalId(suc.id)}
                  >
                    <Text
                      style={[
                        styles.sucursalFilterButtonText,
                        selectedSucursalId === suc.id &&
                        styles.sucursalFilterButtonTextSelected,
                      ]}
                    >
                      {suc.nombre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={styles.sectionTitle}>Pendientes ({pendientes.length})</Text>
          {pendientes.length === 0 ? (
            <Text style={styles.emptyText}>No hay pedidos pendientes</Text>
          ) : (
            <FlatList
              data={pendientes}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderPedido}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          )}

          <Text style={[styles.sectionTitle, styles.sectionTitleListo]}>
            Listos en Mostrador / Salón ({listosMostrador.length})
          </Text>
          {listosMostrador.length === 0 ? (
            <Text style={styles.emptyText}>No hay pedidos listos esperando entrega en salón</Text>
          ) : (
            <FlatList
              data={listosMostrador}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderPedido}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          )}
        </ScrollView>
      )}

      {/* CONFIRM DELETE DIALOG */}
      <Modal
        visible={pedidoAEliminar !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPedidoAEliminar(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>¿Eliminar este pedido?</Text>
            <Text style={styles.confirmText}>
              Esta acción es permanente. Desaparecerá de la cocina y se anulará.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnCancel]}
                onPress={() => setPedidoAEliminar(null)}
              >
                <Text style={styles.confirmBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnDelete]}
                onPress={() => handleEliminarPedido(pedidoAEliminar)}
              >
                <Text style={styles.confirmBtnDeleteText}>Sí, Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.line,
    backgroundColor: POS_COLORS.surfaceStrong,
    shadowColor: '#0A1910',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: POS_COLORS.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: POS_COLORS.muted,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionText: {
    color: POS_COLORS.ink,
    fontWeight: '700',
    fontSize: 13,
  },
  deliveryHeaderButtonActive: {
    backgroundColor: POS_COLORS.primarySoft,
    borderColor: '#C7DDCE',
  },
  deliveryHeaderTextActive: {
    color: POS_COLORS.primaryDark,
    fontWeight: '800',
  },
  logoutButton: {
    borderColor: 'rgba(239, 68, 68, 0.25)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  logoutButtonText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl * 2,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h2,
    color: POS_COLORS.ink,
    fontWeight: '800',
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  sectionTitleListo: {
    color: POS_COLORS.primaryDark,
    marginTop: SPACING.xl,
  },
  emptyText: {
    ...TYPOGRAPHY.bodyMuted,
    color: POS_COLORS.muted,
    fontStyle: 'italic',
    marginBottom: SPACING.md,
  },
  listContainer: {
    gap: SPACING.md,
  },
  pedidoCard: {
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderLeftWidth: 6,
    borderLeftColor: '#F59E0B',
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    marginBottom: SPACING.md,
    shadowColor: '#0A1910',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  pedidoCardListo: {
    backgroundColor: POS_COLORS.primary,
    borderLeftWidth: 6,
    borderLeftColor: POS_COLORS.primaryDark,
    borderColor: POS_COLORS.primary,
  },
  pedidoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  pedidoId: {
    fontSize: 20,
    fontWeight: '800',
  },
  pedidoTime: {
    fontSize: 13,
    fontWeight: '600',
  },
  pedidoInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  pedidoMetaText: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    marginVertical: SPACING.sm,
  },
  detallesContainer: {
    marginVertical: SPACING.sm,
  },
  detalleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  detalleCantidad: {
    fontSize: 18,
    fontWeight: '800',
    width: 42,
  },
  detalleNombre: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  notasContainer: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  notasTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  notasText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionContainer: {
    marginTop: SPACING.md,
    alignItems: 'flex-end',
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  buttonListo: {
    backgroundColor: POS_COLORS.primaryDark,
  },
  buttonEntregado: {
    backgroundColor: POS_COLORS.surfaceStrong,
    borderWidth: 1,
    borderColor: POS_COLORS.surfaceStrong,
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    gap: 12,
  },
  buttonEliminar: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 19, 13, 0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  confirmBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    shadowColor: '#0A1910',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmEmoji: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  confirmTitle: {
    ...TYPOGRAPHY.h2,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    color: POS_COLORS.ink,
  },
  confirmText: {
    ...TYPOGRAPHY.bodyMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 20,
    color: POS_COLORS.muted,
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  confirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  confirmBtnCancel: {
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  confirmBtnCancelText: {
    color: POS_COLORS.muted,
    fontWeight: '700',
  },
  confirmBtnDelete: {
    backgroundColor: COLORS.danger,
  },
  confirmBtnDeleteText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sucursalFilterCard: {
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    shadowColor: '#0A1910',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sucursalFilterLabel: {
    fontSize: 12,
    color: POS_COLORS.muted,
    fontWeight: '800',
    marginBottom: SPACING.xs,
    letterSpacing: 0.5,
  },
  sucursalFilterList: {
    paddingVertical: 4,
    gap: 8,
  },
  sucursalFilterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  sucursalFilterButtonSelected: {
    backgroundColor: POS_COLORS.primaryDark,
    borderColor: POS_COLORS.primaryDark,
  },
  sucursalFilterButtonText: {
    fontSize: 13,
    color: POS_COLORS.muted,
    fontWeight: '600',
  },
  sucursalFilterButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

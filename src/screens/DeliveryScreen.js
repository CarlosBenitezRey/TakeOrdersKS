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
  Linking,
  useWindowDimensions,
} from 'react-native';
import orderService from '../services/OrderService';
import authService from '../services/AuthService';
import productService from '../services/ProductService';
import PremiumLoader from '../components/PremiumLoader';
import { COLORS, POS_COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../theme/theme';

const METODO_PAGO_LABELS = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  pendiente: 'Pago Pendiente',
};

export default function DeliveryScreen({
  userProfile,
  onNavigateCajero,
  onNavigateCocina,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < 600;

  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sucursales, setSucursales] = useState([]);
  const [selectedSucursalId, setSelectedSucursalId] = useState(
    userProfile?.sucursal_id || 'all'
  );

  useEffect(() => {
    if (!userProfile?.sucursal_id) {
      productService
        .getSucursales()
        .then((data) => setSucursales(data))
        .catch((err) => console.log('Error cargando sucursales en Delivery:', err));
    }
  }, []);

  useEffect(() => {
    cargarPedidos(selectedSucursalId);

    const channel = orderService.suscribirCambiosPedidos(() => {
      cargarPedidos(selectedSucursalId);
    });

    return () => orderService.cancelarSuscripcion(channel);
  }, [selectedSucursalId]);

  const cargarPedidos = async (sucursalId) => {
    try {
      setLoading(true);
      const data = await orderService.getPedidosActivos(
        sucursalId,
        userProfile?.sucursal_id
      );
      setPedidos(data);
    } catch (error) {
      console.error('Error cargando pedidos de delivery:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const marcarComoEntregado = async (pedidoId) => {
    try {
      await orderService.cambiarEstado(pedidoId, 'listo', 'entregado');
      setPedidos((current) => current.filter((p) => p.id !== pedidoId));
    } catch (error) {
      console.error('Error marcando delivery como entregado:', error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error.message);
    }
  };

  const abrirEnMaps = async (mapsUrl) => {
    if (!mapsUrl) return;
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(mapsUrl, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(mapsUrl);
      }
    } catch (error) {
      console.error('No se pudo abrir la ubicación:', error.message);
    }
  };

  const llamarCliente = async (telefono) => {
    if (!telefono) return;
    const limpio = telefono.replace(/[^\d+]/g, '');
    if (!limpio) return;
    try {
      await Linking.openURL(`tel:${limpio}`);
    } catch (error) {
      console.error('No se pudo iniciar la llamada:', error.message);
    }
  };

  const abrirWhatsApp = async (telefono, pedidoNumero) => {
    if (!telefono) return;
    let limpio = telefono.replace(/\D/g, '');
    if (limpio.startsWith('0')) {
      limpio = `595${limpio.slice(1)}`;
    } else if (!limpio.startsWith('595') && limpio.length <= 9) {
      limpio = `595${limpio}`;
    }
    const texto = encodeURIComponent(
      `Hola! Soy el repartidor de tu pedido #${pedidoNumero}. Estoy en camino.`
    );
    const url = `https://wa.me/${limpio}?text=${texto}`;
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('No se pudo abrir WhatsApp:', error.message);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatPrice = (price) =>
    Number(price || 0)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const ordenarPorLlegada = (lista) =>
    [...lista].sort((a, b) => {
      const timeA = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b?.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return (Number(a?.numero) || 0) - (Number(b?.numero) || 0);
    });

  // Filtrar solo pedidos cuya modalidad sea delivery
  const pedidosDelivery = pedidos.filter(
    (p) => orderService.extraerDatosEntrega(p).esDelivery
  );

  // Listos (ya salieron de cocina, listos para llevar en orden de llegada)
  const listosParaEnvio = ordenarPorLlegada(
    pedidosDelivery.filter((p) => p.estado === 'listo')
  );

  // En cocina (todavía preparándose)
  const enPreparacion = ordenarPorLlegada(
    pedidosDelivery.filter((p) => p.estado === 'pendiente')
  );

  const renderDeliveryCard = ({ item }) => {
    const isListo = item.estado === 'listo';
    const infoEntrega = orderService.extraerDatosEntrega(item);
    const codigoCorto = item.numero
      ? item.numero.toString()
      : item.id.toString().slice(0, 5).toUpperCase();

    return (
      <View
        style={[
          styles.deliveryCard,
          isMobile && styles.deliveryCardMobile,
          !isListo && styles.deliveryCardPendiente,
        ]}
      >
        {/* Cabecera del Pedido */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View
              style={[
                styles.statusBadge,
                isListo ? styles.statusBadgeListo : styles.statusBadgeCocina,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  isMobile && styles.statusBadgeTextMobile,
                  isListo
                    ? styles.statusBadgeTextListo
                    : styles.statusBadgeTextCocina,
                ]}
              >
                {isListo ? 'LISTO PARA ENVIAR' : 'EN COCINA'}
              </Text>
            </View>
            <Text style={[styles.pedidoTitle, isMobile && styles.pedidoTitleMobile]}>
              Pedido #{codigoCorto}
            </Text>
          </View>
          <View style={[styles.timeBadge, isMobile && styles.timeBadgeMobile]}>
            <Text style={[styles.timeBadgeText, isMobile && styles.timeBadgeTextMobile]}>
              {formatTime(item.created_at)}
            </Text>
          </View>
        </View>

        {/* Bloque de Cliente y Contacto */}
        <View style={[styles.clienteSection, isMobile && styles.clienteSectionMobile]}>
          <View style={[styles.clienteRow, isMobile && styles.clienteRowMobile]}>
            <View style={[styles.clienteInfoBlock, isMobile && styles.clienteInfoBlockMobile]}>
              <Text style={styles.fieldLabel}>CLIENTE</Text>
              <Text
                style={[styles.clienteNombre, isMobile && styles.clienteNombreMobile]}
                numberOfLines={2}
              >
                {item.cliente || 'Cliente sin nombre'}
              </Text>
            </View>
            {infoEntrega.telefono ? (
              <View style={[styles.contactActions, isMobile && styles.contactActionsMobile]}>
                <TouchableOpacity
                  style={[styles.contactBtn, isMobile && styles.contactBtnMobile]}
                  onPress={() => llamarCliente(infoEntrega.telefono)}
                >
                  <Text
                    style={[styles.contactBtnText, isMobile && styles.contactBtnTextMobile]}
                    numberOfLines={1}
                  >
                    Tel: {infoEntrega.telefono}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.contactBtn,
                    styles.whatsappBtn,
                    isMobile && styles.contactBtnMobile,
                  ]}
                  onPress={() => abrirWhatsApp(infoEntrega.telefono, codigoCorto)}
                >
                  <Text
                    style={[styles.whatsappBtnText, isMobile && styles.contactBtnTextMobile]}
                  >
                    WhatsApp
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* Dirección escrita */}
          {infoEntrega.direccion ? (
            <View style={styles.direccionBox}>
              <Text style={styles.fieldLabel}>DIRECCIÓN / REFERENCIA</Text>
              <Text style={[styles.direccionText, isMobile && styles.direccionTextMobile]}>
                {infoEntrega.direccion}
              </Text>
            </View>
          ) : null}

          {/* Acceso de 1 toque a Google Maps / Ubicación */}
          {infoEntrega.mapsUrl ? (
            <TouchableOpacity
              style={[styles.mapsActionCard, isMobile && styles.mapsActionCardMobile]}
              activeOpacity={0.85}
              onPress={() => abrirEnMaps(infoEntrega.mapsUrl)}
            >
              <View style={styles.mapsCopy}>
                <Text style={[styles.mapsActionTitle, isMobile && styles.mapsActionTitleMobile]}>
                  Abrir ubicación en Google Maps
                </Text>
                <Text style={styles.mapsActionUrl} numberOfLines={1}>
                  {infoEntrega.ubicacionUrl || infoEntrega.direccion}
                </Text>
              </View>
              <View style={[styles.mapsOpenPill, isMobile && styles.mapsOpenPillMobile]}>
                <Text style={[styles.mapsOpenPillText, isMobile && styles.mapsOpenPillTextMobile]}>
                  Abrir mapa
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.noMapsBox}>
              <Text style={styles.noMapsText}>
                Sin link de ubicación cargado
              </Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Productos del pedido */}
        <View style={styles.itemsSection}>
          <Text style={styles.fieldLabel}>PRODUCTOS DEL PEDIDO</Text>
          {item.detalle_pedido?.map((detalle, index) => (
            <View key={index} style={styles.itemRow}>
              <Text style={[styles.itemQty, isMobile && styles.itemQtyMobile]}>
                {detalle.cantidad}x
              </Text>
              <Text style={[styles.itemName, isMobile && styles.itemNameMobile]}>
                {detalle.productos?.nombre}
              </Text>
            </View>
          ))}
        </View>

        {item.notas ? (
          <View style={styles.notasBox}>
            <Text style={styles.notasTitle}>Observaciones:</Text>
            <Text style={styles.notasText}>{item.notas}</Text>
          </View>
        ) : null}

        {/* Pie de tarjeta: Cobro y Botón de Entrega */}
        <View style={[styles.cardFooter, isMobile && styles.cardFooterMobile]}>
          <View style={[styles.paymentSummary, isMobile && styles.paymentSummaryMobile]}>
            <Text style={styles.paymentMethodBadge}>
              {METODO_PAGO_LABELS[item.metodo_pago] || item.metodo_pago || 'Efectivo'}
            </Text>
            <Text style={[styles.totalAmount, isMobile && styles.totalAmountMobile]}>
              Gs. {formatPrice(item.total)}
            </Text>
          </View>

          {isListo ? (
            <TouchableOpacity
              style={[styles.deliverButton, isMobile && styles.deliverButtonMobile]}
              activeOpacity={0.9}
              onPress={() => marcarComoEntregado(item.id)}
            >
              <Text style={[styles.deliverButtonText, isMobile && styles.deliverButtonTextMobile]}>
                Marcar como Entregado
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.waitingKitchenBadge, isMobile && styles.waitingKitchenBadgeMobile]}>
              <Text style={styles.waitingKitchenText}>
                Esperando confirmación de cocina...
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={POS_COLORS.canvas} />

      {/* HEADER */}
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View style={styles.headerTitleBlock}>
          <Text style={[styles.headerTitle, isMobile && styles.headerTitleMobile]}>
            Delivery
          </Text>
          <Text
            style={[styles.headerSubtitle, isMobile && styles.headerSubtitleMobile]}
            numberOfLines={1}
          >
            {isMobile
              ? 'Pedidos por orden de llegada'
              : 'Despacho y ruta de entregas por orden de llegada'}
          </Text>
        </View>
        <View style={[styles.headerActions, isMobile && styles.headerActionsMobile]}>
          {onNavigateCajero ? (
            <TouchableOpacity
              style={[styles.headerActionButton, isMobile && styles.headerActionButtonMobile]}
              onPress={onNavigateCajero}
            >
              <Text style={[styles.headerActionText, isMobile && styles.headerActionTextMobile]}>
                Cajero
              </Text>
            </TouchableOpacity>
          ) : null}
          {onNavigateCocina ? (
            <TouchableOpacity
              style={[styles.headerActionButton, isMobile && styles.headerActionButtonMobile]}
              onPress={onNavigateCocina}
            >
              <Text style={[styles.headerActionText, isMobile && styles.headerActionTextMobile]}>
                Cocina
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[
              styles.headerActionButton,
              styles.logoutButton,
              isMobile && styles.headerActionButtonMobile,
            ]}
            onPress={handleLogout}
          >
            <Text style={[styles.logoutButtonText, isMobile && styles.headerActionTextMobile]}>
              Salir
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && pedidos.length === 0 ? (
        <PremiumLoader
          message="Cargando despachos de delivery"
          detail="Sincronizando pedidos listos para entrega"
        />
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.scrollContent,
            isMobile && styles.scrollContentMobile,
          ]}
        >
          <View style={styles.innerContainer}>
            {/* Selector de sucursal para administradores */}
            {!userProfile?.sucursal_id && sucursales.length > 0 && (
              <View style={[styles.sucursalFilterCard, isMobile && styles.sucursalFilterCardMobile]}>
                <Text style={styles.sucursalFilterLabel}>Monitorear Local:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sucursalFilterList}
                >
                  <TouchableOpacity
                    style={[
                      styles.sucursalFilterButton,
                      selectedSucursalId === 'all' &&
                        styles.sucursalFilterButtonSelected,
                    ]}
                    onPress={() => setSelectedSucursalId('all')}
                  >
                    <Text
                      style={[
                        styles.sucursalFilterButtonText,
                        selectedSucursalId === 'all' &&
                          styles.sucursalFilterButtonTextSelected,
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
                        selectedSucursalId === suc.id &&
                          styles.sucursalFilterButtonSelected,
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

            {/* SECCIÓN PRINCIPAL: LISTOS PARA SALIR A REPARTO */}
            <View style={[styles.sectionHeaderRow, isMobile && styles.sectionHeaderRowMobile]}>
              <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>
                Listos para Entregar ({listosParaEnvio.length})
              </Text>
              <Text style={[styles.sectionHint, isMobile && styles.sectionHintMobile]}>
                Ordenados por llegada (el más antiguo arriba)
              </Text>
            </View>

            {listosParaEnvio.length === 0 ? (
              <View style={[styles.emptyStateBox, isMobile && styles.emptyStateBoxMobile]}>
                <Text style={[styles.emptyStateTitle, isMobile && styles.emptyStateTitleMobile]}>
                  No hay pedidos listos para delivery en este momento
                </Text>
                <Text style={[styles.emptyStateSubtitle, isMobile && styles.emptyStateSubtitleMobile]}>
                  Cuando cocina marque un pedido de delivery como &quot;Listo&quot;, aparecerá aquí automáticamente con su ubicación.
                </Text>
              </View>
            ) : (
              <FlatList
                data={listosParaEnvio}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderDeliveryCard}
                scrollEnabled={false}
                contentContainerStyle={styles.listContainer}
              />
            )}

            {/* SECCIÓN SECUNDARIA: EN PREPARACIÓN EN COCINA */}
            {enPreparacion.length > 0 && (
              <>
                <View
                  style={[
                    styles.sectionHeaderRow,
                    isMobile && styles.sectionHeaderRowMobile,
                    { marginTop: isMobile ? SPACING.lg : SPACING.xl },
                  ]}
                >
                  <Text
                    style={[
                      styles.sectionTitle,
                      styles.sectionTitleMuted,
                      isMobile && styles.sectionTitleMobile,
                    ]}
                  >
                    Preparándose en Cocina ({enPreparacion.length})
                  </Text>
                  <Text style={[styles.sectionHint, isMobile && styles.sectionHintMobile]}>
                    Próximos a salir
                  </Text>
                </View>
                <FlatList
                  data={enPreparacion}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderDeliveryCard}
                  scrollEnabled={false}
                  contentContainerStyle={styles.listContainer}
                />
              </>
            )}
          </View>
        </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.line,
    backgroundColor: POS_COLORS.surfaceStrong,
    shadowColor: '#0A1910',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
    gap: 10,
  },
  headerMobile: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: POS_COLORS.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  headerTitleMobile: {
    fontSize: 18,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: POS_COLORS.muted,
  },
  headerSubtitleMobile: {
    fontSize: 11,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionsMobile: {
    gap: 6,
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
  headerActionButtonMobile: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  headerActionText: {
    color: POS_COLORS.ink,
    fontWeight: '700',
    fontSize: 13,
  },
  headerActionTextMobile: {
    fontSize: 12,
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
  scrollContentMobile: {
    padding: 12,
    paddingBottom: SPACING.xl * 2,
  },
  innerContainer: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
    gap: 6,
  },
  sectionHeaderRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    marginBottom: 8,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h2,
    color: POS_COLORS.primaryDark,
    fontWeight: '800',
  },
  sectionTitleMobile: {
    fontSize: 17,
  },
  sectionTitleMuted: {
    color: POS_COLORS.muted,
  },
  sectionHint: {
    fontSize: 12,
    color: POS_COLORS.muted,
    fontWeight: '600',
  },
  sectionHintMobile: {
    fontSize: 11,
  },
  emptyStateBox: {
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyStateBoxMobile: {
    padding: SPACING.md,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: POS_COLORS.ink,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyStateTitleMobile: {
    fontSize: 14,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: POS_COLORS.muted,
    textAlign: 'center',
    maxWidth: 440,
    lineHeight: 19,
  },
  emptyStateSubtitleMobile: {
    fontSize: 12,
    lineHeight: 17,
  },
  listContainer: {
    gap: SPACING.md,
  },
  deliveryCard: {
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderLeftWidth: 6,
    borderLeftColor: POS_COLORS.primary,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    marginBottom: SPACING.md,
    shadowColor: '#0A1910',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  deliveryCardMobile: {
    padding: 12,
    borderLeftWidth: 5,
    marginBottom: 10,
  },
  deliveryCardPendiente: {
    borderLeftColor: '#F59E0B',
    opacity: 0.9,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
    gap: 8,
  },
  cardHeaderLeft: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeListo: {
    backgroundColor: POS_COLORS.primarySoft,
    borderWidth: 1,
    borderColor: '#C7DDCE',
  },
  statusBadgeCocina: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  statusBadgeTextMobile: {
    fontSize: 10,
  },
  statusBadgeTextListo: {
    color: POS_COLORS.primaryDark,
  },
  statusBadgeTextCocina: {
    color: '#B45309',
  },
  pedidoTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: POS_COLORS.ink,
  },
  pedidoTitleMobile: {
    fontSize: 17,
  },
  timeBadge: {
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.sm,
  },
  timeBadgeMobile: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: POS_COLORS.muted,
  },
  timeBadgeTextMobile: {
    fontSize: 11,
  },
  clienteSection: {
    backgroundColor: POS_COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    gap: SPACING.sm,
  },
  clienteSectionMobile: {
    padding: 10,
    gap: 8,
  },
  clienteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  clienteRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  clienteInfoBlock: {
    flex: 1,
    minWidth: 0,
  },
  clienteInfoBlockMobile: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '100%',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: POS_COLORS.muted,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  clienteNombre: {
    fontSize: 16,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  clienteNombreMobile: {
    fontSize: 15,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  contactActionsMobile: {
    width: '100%',
    gap: 6,
  },
  contactBtn: {
    backgroundColor: POS_COLORS.surfaceStrong,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactBtnMobile: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  contactBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: POS_COLORS.ink,
  },
  contactBtnTextMobile: {
    fontSize: 12,
  },
  whatsappBtn: {
    backgroundColor: POS_COLORS.primarySoft,
    borderColor: '#C7DDCE',
  },
  whatsappBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: POS_COLORS.primaryDark,
  },
  direccionBox: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: POS_COLORS.line,
  },
  direccionText: {
    fontSize: 14,
    fontWeight: '600',
    color: POS_COLORS.ink,
    lineHeight: 20,
  },
  direccionTextMobile: {
    fontSize: 13,
    lineHeight: 18,
  },
  mapsActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: POS_COLORS.primaryDark,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    gap: 10,
  },
  mapsActionCardMobile: {
    padding: 10,
    gap: 8,
  },
  mapsCopy: {
    flex: 1,
    minWidth: 0,
  },
  mapsActionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  mapsActionTitleMobile: {
    fontSize: 13,
  },
  mapsActionUrl: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  mapsOpenPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    flexShrink: 0,
  },
  mapsOpenPillMobile: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mapsOpenPillText: {
    color: POS_COLORS.primaryDark,
    fontWeight: '900',
    fontSize: 13,
  },
  mapsOpenPillTextMobile: {
    fontSize: 12,
  },
  noMapsBox: {
    paddingVertical: 4,
  },
  noMapsText: {
    fontSize: 12,
    color: POS_COLORS.muted,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: POS_COLORS.line,
    marginVertical: SPACING.sm,
  },
  itemsSection: {
    gap: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  itemQty: {
    fontSize: 16,
    fontWeight: '800',
    color: POS_COLORS.primaryDark,
    width: 38,
  },
  itemQtyMobile: {
    fontSize: 14,
    width: 32,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: POS_COLORS.ink,
    flex: 1,
  },
  itemNameMobile: {
    fontSize: 14,
  },
  notasBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  notasTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
    marginBottom: 2,
  },
  notasText: {
    fontSize: 13,
    fontWeight: '600',
    color: POS_COLORS.ink,
  },
  cardFooter: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: POS_COLORS.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardFooterMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
    marginTop: 10,
  },
  paymentSummary: {
    gap: 2,
  },
  paymentSummaryMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentMethodBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: POS_COLORS.muted,
    textTransform: 'uppercase',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: POS_COLORS.ink,
  },
  totalAmountMobile: {
    fontSize: 16,
  },
  deliverButton: {
    backgroundColor: POS_COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliverButtonMobile: {
    width: '100%',
    paddingVertical: 11,
  },
  deliverButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  deliverButtonTextMobile: {
    fontSize: 13,
  },
  waitingKitchenBadge: {
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
  },
  waitingKitchenBadgeMobile: {
    width: '100%',
  },
  waitingKitchenText: {
    fontSize: 12,
    fontWeight: '700',
    color: POS_COLORS.muted,
  },
  sucursalFilterCard: {
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  sucursalFilterCardMobile: {
    padding: 10,
    marginBottom: 12,
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

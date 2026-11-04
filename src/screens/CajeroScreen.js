import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Platform,
  StatusBar,
  Image,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import orderService from '../services/OrderService';
import productService from '../services/ProductService';
import statsService from '../services/StatsService';
import authService from '../services/AuthService';
import carritoService from '../services/CarritoService';
import PersonalScreen from './admin/PersonalScreen';
import PagosScreen from './admin/PagosScreen';
import facturaService from '../services/FacturaService';
import FacturasScreen from './admin/FacturasScreen';
import TicketFacturaModal from '../components/TicketFacturaModal';
import BalanceScreen from './admin/BalanceScreen';
import MenuCmsScreen from './admin/MenuCmsScreen';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../theme/theme';
import { getProductImage, APP_ICONS, getCategoryIcon } from '../theme/assets';

// ─── Utilidades de formato y estética estilo Spotify ──────────────────────────

const formatPrice = (value) => Number(value || 0).toLocaleString('es-AR');

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function CajeroScreen({ userProfile, onSwitchView }) {
  // ─── Lógica Responsive (Móvil, Tablet, Desktop) ──────────────────────────────
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < 600;
  const isTablet = windowWidth >= 600 && windowWidth < 1024;
  const isDesktop = windowWidth >= 1024;

  // Cantidad de columnas dinámicas para la grilla
  const numColumns = isMobile ? 2 : isTablet ? 3 : 4;

  // Ancho simétrico para alinear Header, Search, Grilla y Carrito
  const containerWidth = Math.min(1150, windowWidth - (isMobile ? 20 : 32));

  // Dimensiones proporcionales calculadas para cada tarjeta
  const cardGap = isMobile ? 10 : 14;
  const cardWidth = Math.floor((containerWidth - (numColumns - 1) * cardGap) / numColumns);
  const cardHeight = isMobile ? 116 : isTablet ? 134 : 146;
  const cardTitleSize = isMobile ? 15 : isTablet ? 17 : 19;
  const cardTitleLineHeight = isMobile ? 18 : isTablet ? 21 : 23;
  const cardPriceSize = isMobile ? 13 : isTablet ? 15 : 16;
  const cardImageSize = isMobile ? 70 : isTablet ? 84 : 96;
  const cardImageRight = isMobile ? -10 : isTablet ? -12 : -14;
  const cardImageBottom = isMobile ? -6 : isTablet ? -8 : -10;

  // Estado del catálogo
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estado de búsqueda y filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedSucursalId, setSelectedSucursalId] = useState(
    userProfile?.sucursal_id || 'all'
  );

  // Estado del carrito y formulario de pedido
  const [carrito, setCarrito] = useState([]);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [mesa, setMesa] = useState('');
  const [cliente, setCliente] = useState('');
  const [notas, setNotas] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');

  // Estado de UI
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [drawerActiveTab, setDrawerActiveTab] = useState('servicios');
  const [pedidoAEliminar, setPedidoAEliminar] = useState(null);

  // Animaciones del menú lateral (despliegue de derecha a izquierda)
  const drawerSlideAnim = useRef(new Animated.Value(500)).current;
  const drawerBackdropAnim = useRef(new Animated.Value(0)).current;

  const openDrawer = () => {
    drawerSlideAnim.setValue(500);
    drawerBackdropAnim.setValue(0);
    setIsDrawerVisible(true);
    Animated.parallel([
      Animated.timing(drawerSlideAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(drawerBackdropAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDrawer = (callback) => {
    Animated.parallel([
      Animated.timing(drawerSlideAnim, {
        toValue: 500,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(drawerBackdropAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsDrawerVisible(false);
      if (typeof callback === 'function') {
        callback();
      }
    });
  };

  // Estado de estadísticas (solo admins)
  const [isStatsVisible, setIsStatsVisible] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState({
    totalVentas: 0,
    productosMasVendidos: [],
    metodosPago: { efectivo: 0, tarjeta: 0, transferencia: 0, pendiente: 0 },
    transacciones: [],
  });

  // Estado de módulos admin y facturación
  const [isPersonalVisible, setIsPersonalVisible] = useState(false);
  const [isPagosVisible, setIsPagosVisible] = useState(false);
  const [isFacturasVisible, setIsFacturasVisible] = useState(false);
  const [isCmsVisible, setIsCmsVisible] = useState(false);
  const [ultimoComprobante, setUltimoComprobante] = useState(null);
  const [clienteRuc, setClienteRuc] = useState('');
  const [condicionVenta, setCondicionVenta] = useState('contado');

  const esAdmin =
    userProfile?.rol?.toLowerCase()?.trim() === 'admin';

  // ─── Carga inicial ────────────────────────────────────────────────────────────

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      // ProductService carga productos, categorías y sucursales en paralelo
      const { productos, categorias, sucursales } = await productService.cargarCatalogo();
      setProductos(productos);
      setCategorias(categorias);
      setSucursales(sucursales);
    } catch (error) {
      console.error('Error cargando datos:', error.message);
      showStatus('Error al conectar con Supabase', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Estadísticas ─────────────────────────────────────────────────────────────

  const cargarEstadisticas = async (sucursalIdParam) => {
    try {
      setLoadingStats(true);
      const targetSucursal =
        sucursalIdParam !== undefined ? sucursalIdParam : selectedSucursalId;

      // StatsService maneja toda la lógica de cálculo
      const resultado = await statsService.cargarEstadisticas(
        targetSucursal,
        userProfile?.sucursal_id
      );
      setStats(resultado);
    } catch (error) {
      console.error('Error cargando estadísticas:', error.message);
      showStatus('Error al cargar estadísticas', 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  // ─── Handlers del Carrito (delegados a CarritoService) ───────────────────────

  const agregarProducto = (producto) => {
    setCarrito((prev) => carritoService.agregar(prev, producto));
  };

  const disminuirProducto = (producto) => {
    setCarrito((prev) => carritoService.disminuir(prev, producto));
  };

  const eliminarProducto = (productoId) => {
    setCarrito((prev) => carritoService.eliminar(prev, productoId));
  };

  // ─── Handler de Pedido ────────────────────────────────────────────────────────

  const guardarPedido = async () => {
    if (carrito.length === 0) return;

    try {
      setSavingOrder(true);

      // OrderService maneja toda la lógica: validación, cálculo de total, FK check y persistencia
      const nuevoPedido = await orderService.crearPedido(carrito, {
        mesa,
        cliente,
        notas,
        metodoPago,
        sucursalId: userProfile?.sucursal_id || null,
        usuarioId: userProfile?.id || null,
      });

      // Clonar ítems del carrito para el comprobante
      const itemsComprobante = [...carrito];
      const rucEmitido = clienteRuc;
      const condEmitida = condicionVenta;
      const pagoEmitido = metodoPago;
      const clienteEmitido = cliente;

      // Reset del formulario tras éxito
      setCarrito(carritoService.vaciar());
      setMesa('');
      setCliente('');
      setNotas('');
      setClienteRuc('');
      setCondicionVenta('contado');
      setMetodoPago('efectivo');
      setIsCartVisible(false);
      showStatus('¡Pedido enviado con éxito!', 'success');

      // Generar automáticamente la factura legal / comprobante
      try {
        if (nuevoPedido && nuevoPedido.id) {
          const facturaGenerada = await facturaService.generarFacturaDePedido(
            nuevoPedido,
            itemsComprobante,
            {
              clienteNombre: clienteEmitido,
              clienteRuc: rucEmitido,
              condicionVenta: condEmitida,
              metodoPago: pagoEmitido,
            },
            userProfile?.id
          );
          setUltimoComprobante({
            factura: facturaGenerada,
            items: facturaGenerada.items,
          });
        }
      } catch (errFactura) {
        console.error('Error generando factura/ticket automático:', errFactura.message);
      }
    } catch (error) {
      console.error('Error guardando pedido:', error.message);
      showStatus('Error al registrar el pedido', 'error');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleEliminarPedido = async (pedidoId) => {
    try {
      setLoadingStats(true);
      await orderService.eliminarPedido(pedidoId);
      showStatus('Pedido eliminado con éxito', 'success');
      setPedidoAEliminar(null);
      cargarEstadisticas();
    } catch (error) {
      console.error('Error eliminando pedido:', error.message);
      showStatus('Error al eliminar el pedido', 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error.message);
      showStatus('Error al cerrar sesión', 'error');
    }
  };

  // ─── Utilidades de UI ─────────────────────────────────────────────────────────

  const showStatus = (text, type = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage({ text: '', type: '' }), 3000);
  };

  const getSucursalName = (sucId) => {
    if (!sucId) return 'Global';
    const found = sucursales.find((s) => s.id === sucId);
    return found ? found.nombre : 'Desconocido';
  };

  // Filtrado de productos: delegado a ProductService
  const productosFiltrados = productService.filtrar(
    productos,
    searchQuery,
    selectedCategoryId
  );

  // Métricas del carrito (solo cálculos, sin lógica de negocio)
  const totalCantidad = carrito.reduce((sum, item) => sum + item.cantidad, 0);
  const totalPrecio = carrito.reduce(
    (sum, item) => sum + item.producto.precio * item.cantidad,
    0
  );

  // ─── Pestañas y Opciones del Menú Lateral Doble Columna (Rediseñado) ────────
  const drawerTabs = [
    {
      id: 'servicios',
      label: 'Servicios',
      icon: APP_ICONS.todos,
      pill: 'Dashboard / POS',
      onPillPress: () => closeDrawer(),
      items: [
        {
          label: 'Terminal de Pedidos',
          onPress: () => closeDrawer(),
        },
        {
          label: 'Recargar Catálogo',
          onPress: () => {
            closeDrawer(cargarDatos);
          },
        },
        ...(ultimoComprobante
          ? [
            {
              label: 'Ver Último Ticket',
              onPress: () => {
                closeDrawer(() => setIsFacturasVisible(true));
              },
            },
          ]
          : []),
        {
          label: 'Limpiar Carrito Actual',
          onPress: () => {
            closeDrawer(() => setCarrito(carritoService.vaciar()));
          },
        },
      ],
    },
    ...(onSwitchView
      ? [
        {
          id: 'cocina',
          label: 'Cocina',
          icon: APP_ICONS.kitchen,
          pill: 'Pantalla de Cocina',
          onPillPress: () => {
            closeDrawer(onSwitchView);
          },
          items: [
            {
              label: 'Comandas Activas',
              onPress: () => {
                closeDrawer(onSwitchView);
              },
            },
            {
              label: 'Control de Preparación',
              onPress: () => {
                closeDrawer(onSwitchView);
              },
            },
          ],
        },
      ]
      : []),
    ...(esAdmin
      ? [
        {
          id: 'finanzas',
          label: 'Finanzas',
          icon: APP_ICONS.statistics,
          pill: 'Balance y Finanzas',
          onPillPress: () => {
            closeDrawer(() => setIsStatsVisible(true));
          },
          items: [
            {
              label: 'Métricas de Ventas',
              onPress: () => {
                closeDrawer(() => setIsStatsVisible(true));
              },
            },
            {
              label: 'Arqueo de Caja',
              onPress: () => {
                closeDrawer(() => setIsStatsVisible(true));
              },
            },
            {
              label: 'Desglose de Cobros',
              onPress: () => {
                closeDrawer(() => setIsStatsVisible(true));
              },
            },
          ],
        },
        {
          id: 'personal',
          label: 'Personal',
          icon: APP_ICONS.userDefault,
          pill: 'Gestión de Personal',
          onPillPress: () => {
            closeDrawer(() => setIsPersonalVisible(true));
          },
          items: [
            {
              label: 'Plantel de Empleados',
              onPress: () => {
                closeDrawer(() => setIsPersonalVisible(true));
              },
            },
            {
              label: 'Registrar Empleado',
              onPress: () => {
                closeDrawer(() => setIsPersonalVisible(true));
              },
            },
            {
              label: 'Control de Salarios',
              onPress: () => {
                closeDrawer(() => setIsPersonalVisible(true));
              },
            },
          ],
        },
        {
          id: 'compras',
          label: 'Compras',
          icon: APP_ICONS.statistics,
          pill: 'Pagos y Proveedores',
          onPillPress: () => {
            closeDrawer(() => setIsPagosVisible(true));
          },
          items: [
            {
              label: 'Facturas y Comprobantes',
              onPress: () => {
                closeDrawer(() => setIsFacturasVisible(true));
              },
            },
            {
              label: 'Directorio de Proveedores',
              onPress: () => {
                closeDrawer(() => setIsPagosVisible(true));
              },
            },
            {
              label: 'Registro de Gastos',
              onPress: () => {
                closeDrawer(() => setIsPagosVisible(true));
              },
            },
          ],
        },
        {
          id: 'catalogo',
          label: 'Catálogo',
          icon: APP_ICONS.hamburguesa || APP_ICONS.todos,
          pill: 'CMS Menú y Precios',
          onPillPress: () => {
            closeDrawer(() => setIsCmsVisible(true));
          },
          items: [
            {
              label: 'Modificar Platos y Precios',
              onPress: () => {
                closeDrawer(() => setIsCmsVisible(true));
              },
            },
            {
              label: 'Administrar Categorías',
              onPress: () => {
                closeDrawer(() => setIsCmsVisible(true));
              },
            },
            {
              label: 'Control de Disponibilidad',
              onPress: () => {
                closeDrawer(() => setIsCmsVisible(true));
              },
            },
          ],
        },
      ]
      : []),
    {
      id: 'cuenta',
      label: 'Cuenta',
      icon: APP_ICONS.admin,
      pill: userProfile?.nombre || 'Mi Perfil',
      pillSubtitle: userProfile?.rol?.toUpperCase() || 'CAJERO',
      onPillPress: () => { },
      items: [
        {
          label: `Sucursal: ${getSucursalName(userProfile?.sucursal_id)}`,
          onPress: () => { },
        },
        {
          label: userProfile?.email || 'Sin correo',
          onPress: () => { },
        },
        {
          label: 'Cerrar Sesión',
          isDanger: true,
          onPress: () => {
            closeDrawer(handleLogout);
          },
        },
      ],
    },
  ];

  const currentDrawerTab =
    drawerTabs.find((t) => t.id === drawerActiveTab) || drawerTabs[0];

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={[styles.headerInner, { width: containerWidth }]}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle}>Manageopy</Text>
            <View style={styles.headerUserBlock}>
              <Image
                source={esAdmin ? APP_ICONS.admin : APP_ICONS.userDefault}
                style={styles.headerUserIcon}
                resizeMode="contain"
              />
              <Text style={styles.headerSubtitle}>
                {userProfile?.nombre || 'Invitado'}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={openDrawer}
              activeOpacity={0.7}
            >
              <Text style={styles.menuButtonText}>☰ Menú</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* SEARCH BAR */}
      <View style={[styles.searchContainer, { width: containerWidth }]}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar platos o bebidas..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity
            style={styles.clearSearch}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* STATUS BANNER */}
      {statusMessage.text !== '' && (
        <View
          style={[
            styles.statusBanner,
            { width: containerWidth },
            statusMessage.type === 'error'
              ? styles.statusBannerError
              : styles.statusBannerSuccess,
          ]}
        >
          <Text style={styles.statusBannerText}>{statusMessage.text}</Text>
        </View>
      )}

      {/* PRODUCTS LIST */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loaderText}>Conectando con Supabase...</Text>
        </View>
      ) : (
        <FlatList
          key={`grid-cols-${numColumns}`}
          data={productosFiltrados}
          keyExtractor={(item) => item.id.toString()}
          numColumns={numColumns}
          contentContainerStyle={[styles.listContent, { width: containerWidth }]}
          columnWrapperStyle={[styles.rowWrapper, { gap: cardGap, marginBottom: cardGap }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery !== ''
                  ? 'No se encontraron productos'
                  : 'No hay productos en esta categoría'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isDisponible = item.disponible !== false;
            const cantidadEnCarrito = carritoService.getCantidad(carrito, item.id);

            return (
              <TouchableOpacity
                style={[
                  styles.productCard,
                  {
                    width: cardWidth,
                    height: cardHeight,
                    backgroundColor: COLORS.cardProductBackground,
                  },
                  !isDisponible && styles.productCardDisabled,
                ]}
                activeOpacity={0.85}
                onPress={() => {
                  if (!isDisponible) {
                    showStatus(`"${item.nombre}" está agotado en cocina`, 'error');
                    return;
                  }
                  agregarProducto(item);
                }}
              >
                {/* Texto del Producto: Nombre y Monto abajo */}
                <View style={styles.cardTextContainer}>
                  <Text
                    style={[
                      styles.productName,
                      {
                        fontSize: cardTitleSize,
                        lineHeight: cardTitleLineHeight,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {item.nombre}
                  </Text>
                  <Text
                    style={[
                      styles.productPrice,
                      {
                        fontSize: cardPriceSize,
                      },
                    ]}
                  >
                    Gs. {formatPrice(item.precio)}
                  </Text>
                </View>

                {/* Imagen del Producto Rotada al Fondo Derecho (Estilo Spotify) */}
                <View
                  style={[
                    styles.imageThumbnailWrapper,
                    {
                      width: cardImageSize,
                      height: cardImageSize,
                      right: cardImageRight,
                      bottom: cardImageBottom,
                    },
                  ]}
                >
                  <Image
                    source={getProductImage(item.nombre, item.imagen_url)}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                </View>

                {/* Overlay si está agotado */}
                {!isDisponible && (
                  <View style={styles.agotadoOverlay}>
                    <View style={styles.badgeAgotado}>
                      <Text style={styles.badgeAgotadoText}>AGOTADO</Text>
                    </View>
                  </View>
                )}

                {/* Badge discreto si ya se agregó al carrito */}
                {cantidadEnCarrito > 0 && isDisponible && (
                  <View style={styles.badgeCarrito}>
                    <Text style={styles.badgeCarritoText}>✓ {cantidadEnCarrito}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* FLOATING CART BUTTON */}
      {carrito.length > 0 && (
        <View style={[styles.floatingCartContainer, { width: containerWidth }]}>
          <TouchableOpacity
            style={styles.floatingCartButton}
            activeOpacity={0.9}
            onPress={() => setIsCartVisible(true)}
          >
            <View style={styles.cartItemsCountBadge}>
              <Text style={styles.cartItemsCountText}>{totalCantidad}</Text>
            </View>
            <Text style={styles.floatingCartText}>Ver Pedido</Text>
            <Text style={styles.floatingCartTotal}>
              Gs. {formatPrice(totalPrecio)}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CATEGORY BOTTOM BAR */}
      <View style={styles.bottomTabBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categorias}
          keyExtractor={(item) => String(item.id)}
          style={styles.bottomTabFlatList}
          contentContainerStyle={[
            styles.bottomTabList,
            (categorias.length * 96 < windowWidth) && styles.bottomTabListCentered,
          ]}
          renderItem={({ item }) => {
            const isSelected = selectedCategoryId === item.id;
            return (
              <TouchableOpacity
                style={[
                  styles.bottomTabButton,
                  isSelected && styles.bottomTabButtonSelected,
                ]}
                activeOpacity={0.7}
                onPress={() => setSelectedCategoryId(item.id)}
              >
                <Image
                  source={getCategoryIcon(item.nombre)}
                  style={[
                    styles.bottomTabIcon,
                    isSelected && styles.bottomTabIconSelected,
                  ]}
                  resizeMode="contain"
                />
                <Text
                  style={[
                    styles.bottomTabText,
                    isSelected && styles.bottomTabTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {item.nombre}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* ── CART MODAL ─────────────────────────────────────────────────────── */}
      <Modal
        visible={isCartVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsCartVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsCartVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContainer}
            activeOpacity={1}
            onPress={(e) => e?.stopPropagation?.()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pedido Actual</Text>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setIsCartVisible(false)}
              >
                <Text style={styles.closeModalButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={carrito}
              keyExtractor={(item) => item.producto.id.toString()}
              contentContainerStyle={styles.modalListContent}
              renderItem={({ item }) => (
                <View style={styles.cartItemCard}>
                  <View style={styles.cartItemInfo}>
                    <Image
                      source={getProductImage(item.producto.nombre)}
                      style={styles.cartItemImage}
                      resizeMode="cover"
                    />
                    <View style={styles.cartItemNameContainer}>
                      <Text style={styles.cartItemName}>
                        {item.producto.nombre}
                      </Text>
                      <Text style={styles.cartItemPrice}>
                        Gs. {formatPrice(item.producto.precio)} c/u
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cartItemActions}>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => disminuirProducto(item.producto)}
                    >
                      <Text style={styles.qtyButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.cantidad}</Text>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => agregarProducto(item.producto)}
                    >
                      <Text style={styles.qtyButtonText}>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeCartItemButton}
                      onPress={() => eliminarProducto(item.producto.id)}
                    >
                      <Text style={styles.removeCartItemButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListFooterComponent={
                <View style={styles.modalFormContainer}>
                  <Text style={styles.formSectionTitle}>
                    Información del Pedido
                  </Text>

                  <View style={styles.formRow}>
                    <View style={styles.formHalfInputWrapper}>
                      <Text style={styles.formInputLabel}>Mesa / Destino</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Ej. Mesa 4 o Llevar"
                        placeholderTextColor={COLORS.textMuted}
                        value={mesa}
                        onChangeText={setMesa}
                      />
                    </View>
                    <View style={styles.formHalfInputWrapper}>
                      <Text style={styles.formInputLabel}>
                        Cliente (Opcional)
                      </Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Ej. Juan Pérez"
                        placeholderTextColor={COLORS.textMuted}
                        value={cliente}
                        onChangeText={setCliente}
                      />
                    </View>
                  </View>

                  <View style={styles.formRow}>
                    <View style={styles.formHalfInputWrapper}>
                      <Text style={styles.formInputLabel}>RUC / C.I. (Factura)</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Ej. 44444401-7 o CI"
                        placeholderTextColor={COLORS.textMuted}
                        value={clienteRuc}
                        onChangeText={setClienteRuc}
                      />
                    </View>
                    <View style={styles.formHalfInputWrapper}>
                      <Text style={styles.formInputLabel}>Condición</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                        {['contado', 'credito'].map((cond) => (
                          <TouchableOpacity
                            key={cond}
                            style={[
                              styles.condicionBadge,
                              condicionVenta === cond && styles.condicionBadgeActive,
                            ]}
                            onPress={() => setCondicionVenta(cond)}
                          >
                            <Text
                              style={[
                                styles.condicionBadgeText,
                                condicionVenta === cond && styles.condicionBadgeTextActive,
                              ]}
                            >
                              {cond === 'contado' ? 'Contado' : 'Crédito'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  <Text style={styles.formInputLabel}>
                    Método de Pago (Estadísticas)
                  </Text>
                  <View style={styles.paymentSelector}>
                    {['efectivo', 'tarjeta', 'transferencia', 'pendiente'].map(
                      (metodo) => (
                        <TouchableOpacity
                          key={metodo}
                          style={[
                            styles.paymentOption,
                            metodoPago === metodo &&
                            styles.paymentOptionSelected,
                          ]}
                          onPress={() => setMetodoPago(metodo)}
                        >
                          <Text
                            style={[
                              styles.paymentOptionText,
                              metodoPago === metodo &&
                              styles.paymentOptionTextSelected,
                            ]}
                          >
                            {metodo === 'efectivo'
                              ? 'Efectivo'
                              : metodo === 'tarjeta'
                                ? 'Tarjeta'
                                : metodo === 'transferencia'
                                  ? 'Transfer'
                                  : 'Deber'}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>

                  <Text style={styles.formInputLabel}>Notas del Pedido</Text>
                  <TextInput
                    style={[styles.formInput, styles.notesInput]}
                    placeholder="Instrucciones especiales para cocina..."
                    placeholderTextColor={COLORS.textMuted}
                    value={notas}
                    onChangeText={setNotas}
                    multiline={true}
                    numberOfLines={2}
                  />
                </View>
              }
            />

            <View style={styles.modalFooter}>
              <View style={styles.modalTotalRow}>
                <Text style={styles.modalTotalLabel}>Total a pagar:</Text>
                <Text style={styles.modalTotalValue}>
                  Gs. {formatPrice(totalPrecio)}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.checkoutButton,
                  savingOrder && styles.checkoutButtonDisabled,
                ]}
                disabled={savingOrder}
                onPress={guardarPedido}
              >
                {savingOrder ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.checkoutButtonText}>
                    Confirmar y Enviar Pedido
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── REDESIGNED DUAL-COLUMN DRAWER (Despliegue lateral de derecha a izquierda) ─────────────── */}
      <Modal
        visible={isDrawerVisible}
        animationType="none"
        transparent={true}
        onRequestClose={() => closeDrawer()}
      >
        <View style={styles.drawerOverlay}>
          {/* Backdrop con fade animado */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(15, 23, 42, 0.45)', opacity: drawerBackdropAnim },
            ]}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => closeDrawer()}
            />
          </Animated.View>

          {/* Panel Drawer con animación suave de derecha a izquierda */}
          <Animated.View
            style={[
              styles.dualDrawerContainer,
              { transform: [{ translateX: drawerSlideAnim }] },
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={styles.dualDrawerInner}
            >
              {/* COLUMNA 1: RAIL LATERAL OSCURO (NAVY) */}
              <View style={styles.railColumn}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.railScrollContent}
                >
                  {drawerTabs.map((tab) => {
                    const isSelected = currentDrawerTab.id === tab.id;
                    return (
                      <TouchableOpacity
                        key={tab.id}
                        style={[
                          styles.railTabItem,
                          isSelected && styles.railTabItemSelected,
                        ]}
                        onPress={() => setDrawerActiveTab(tab.id)}
                        activeOpacity={0.8}
                      >
                        <Image
                          source={tab.icon}
                          style={[
                            styles.railTabIcon,
                            { tintColor: isSelected ? COLORS.primary : 'rgba(0, 0, 0, 0.45)' },
                          ]}
                          resizeMode="contain"
                        />
                        <Text
                          style={[
                            styles.railTabLabel,
                            isSelected && styles.railTabLabelSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* COLUMNA 2: PANEL DE SUBMENÚ (LILAC / LAVENDER) */}
              <View style={styles.submenuColumn}>
                {/* Botón cerrar sutil */}
                <TouchableOpacity
                  style={styles.submenuCloseBtn}
                  onPress={() => closeDrawer()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.submenuCloseText}>✕</Text>
                </TouchableOpacity>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.submenuScrollContent}
                >
                  {/* PILL PRINCIPAL DESTACADO (Tipo "Dashboard" en la referencia) */}
                  <TouchableOpacity
                    style={styles.submenuMainPill}
                    onPress={currentDrawerTab.onPillPress}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.submenuMainPillText}>
                      {currentDrawerTab.pill}
                    </Text>
                    {currentDrawerTab.pillSubtitle && (
                      <Text style={styles.submenuMainPillSub}>
                        {currentDrawerTab.pillSubtitle}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* LISTA DE ENLACES / ACCIONES */}
                  <View style={styles.submenuLinksList}>
                    {currentDrawerTab.items.map((sub, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.submenuLinkItem,
                          sub.isDanger && styles.submenuLinkItemDanger,
                        ]}
                        onPress={sub.onPress}
                        activeOpacity={0.65}
                      >
                        <Text
                          style={[
                            styles.submenuLinkText,
                            sub.isDanger && styles.submenuLinkDanger,
                          ]}
                        >
                          {sub.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* ── BALANCE Y FINANZAS MODAL (Admin) ───────────────────────── */}
      <Modal
        visible={isStatsVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsStatsVisible(false)}
      >
        <BalanceScreen
          userProfile={userProfile}
          onClose={() => setIsStatsVisible(false)}
        />
      </Modal>

      {/* ── CONFIRM DELETE DIALOG ───────────────────────────────────────────── */}
      <Modal
        visible={pedidoAEliminar !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPedidoAEliminar(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmEmoji}>⚠️</Text>
            <Text style={styles.confirmTitle}>¿Eliminar este pedido?</Text>
            <Text style={styles.confirmText}>
              Esta acción es permanente. Se descontará del historial de ventas de
              este mes y desaparecerá de la cocina.
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

      {/* ── PERSONAL SCREEN MODAL (Admin) ───────────────────────────────────── */}
      <Modal
        visible={isPersonalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsPersonalVisible(false)}
      >
        <PersonalScreen
          userProfile={userProfile}
          onClose={() => setIsPersonalVisible(false)}
        />
      </Modal>

      {/* ── PAGOS & PROVEEDORES SCREEN MODAL (Admin) ────────────────────────── */}
      <Modal
        visible={isPagosVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsPagosVisible(false)}
      >
        <PagosScreen
          userProfile={userProfile}
          onClose={() => setIsPagosVisible(false)}
        />
      </Modal>

      {/* ── FACTURAS SCREEN MODAL (Admin) ────────────────────────── */}
      <Modal
        visible={isFacturasVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsFacturasVisible(false)}
      >
        <FacturasScreen
          userProfile={userProfile}
          onClose={() => setIsFacturasVisible(false)}
        />
      </Modal>

      {/* ── MENU CMS SCREEN MODAL (Admin) ────────────────────────── */}
      <Modal
        visible={isCmsVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setIsCmsVisible(false);
          cargarDatos();
        }}
      >
        <MenuCmsScreen
          userProfile={userProfile}
          onClose={() => {
            setIsCmsVisible(false);
            cargarDatos();
          }}
        />
      </Modal>

      {/* ── TICKET / FACTURA VISOR MODAL (Al registrar un pedido) ────────────────── */}
      <TicketFacturaModal
        visible={!!ultimoComprobante}
        onClose={() => setUltimoComprobante(null)}
        factura={ultimoComprobante?.factura}
        items={ultimoComprobante?.items}
        sucursalNombre={getSucursalName(userProfile?.sucursal_id)}
      />
    </SafeAreaView>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    width: '100%',
    backgroundColor: COLORS.background,
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    alignSelf: 'center',
  },
  headerTitleBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondaryText,
    opacity: 0.85,
    textTransform: 'uppercase',
  },
  headerUserBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  headerUserIcon: {
    width: 18,
    height: 18,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    paddingVertical: SPACING.sm - 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
    height: 38,
  },
  headerActionText: {
    fontSize: 14,
  },
  logoutButton: {
    borderColor: COLORS.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  logoutButtonText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  menuButton: {
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
  },
  menuButtonText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.searchBarBackground,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    alignSelf: 'center',
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: COLORS.text,
    ...TYPOGRAPHY.body,
  },
  clearSearch: {
    padding: SPACING.xs,
  },
  clearSearchText: {
    color: COLORS.textMuted,
    fontSize: 16,
  },
  statusBanner: {
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    alignSelf: 'center',
  },
  statusBannerSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  statusBannerError: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  statusBannerText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: SPACING.md,
    ...TYPOGRAPHY.bodyMuted,
  },
  listContent: {
    paddingTop: SPACING.xs,
    paddingBottom: 170,
    alignSelf: 'center',
  },
  rowWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  // ─── Tarjeta de Producto Estilo Spotify (Responsive) ─────────────────────────
  productCard: {
    borderRadius: 14,
    padding: 12,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  productCardDisabled: {
    opacity: 0.55,
  },
  cardTextContainer: {
    flex: 1,
    height: '100%',
    justifyContent: 'space-between',
    maxWidth: '62%',
    zIndex: 2,
  },
  productName: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  productPrice: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  imageThumbnailWrapper: {
    position: 'absolute',
    borderRadius: 8,
    overflow: 'hidden',
    transform: [{ rotate: '25deg' }],
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  agotadoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  badgeAgotado: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeAgotadoText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeCarrito: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    zIndex: 4,
  },
  badgeCarritoText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  emptyText: {
    ...TYPOGRAPHY.bodyMuted,
    textAlign: 'center',
  },
  floatingCartContainer: {
    position: 'absolute',
    bottom: 96,
    alignSelf: 'center',
    zIndex: 35,
  },
  floatingCartButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  cartItemsCountBadge: {
    backgroundColor: COLORS.textLight,
    borderRadius: BORDER_RADIUS.round,
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartItemsCountText: {
    color: COLORS.primary,
    fontWeight: '900',
    fontSize: 14,
  },
  floatingCartText: {
    ...TYPOGRAPHY.button,
    fontSize: 17,
  },
  floatingCartTotal: {
    ...TYPOGRAPHY.button,
    fontSize: 18,
    fontWeight: '800',
  },
  // ─── Bottom Tab Bar de Categorías (Centrado en PC y Móvil) ─────────────────
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.searchBarBackground,
    borderTopWidth: 2,
    borderTopColor: COLORS.primary,
    borderTopEndRadius: 12,
    borderTopStartRadius: 12,
    height: 84,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 15 : 0,
    zIndex: 40,
  },
  bottomTabFlatList: {
    width: '100%',
    flex: 1,
  },
  bottomTabList: {
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  bottomTabListCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  bottomTabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 14,
    backgroundColor: COLORS.searchBarBackground,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    minWidth: 84,
    height: 60,
  },
  bottomTabButtonSelected: {
    backgroundColor: 'rgba(92, 149, 248, 0.16)',
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  bottomTabIcon: {
    width: 26,
    height: 26,
    marginBottom: 4,
    tintColor: COLORS.textMuted,
  },
  bottomTabIconSelected: {
    tintColor: COLORS.primary,
  },
  bottomTabText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomTabTextSelected: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  // Cart Modal (Centrado en pantalla y colores en coherencia con CajeroScreen)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: COLORS.searchBarBackground,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(92, 139, 248, 0.25)',
    maxHeight: '88%',
    width: '100%',
    maxWidth: 580,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(92, 139, 248, 0.15)',
    backgroundColor: COLORS.searchBarBackground,
  },
  modalTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 20,
  },
  closeModalButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: COLORS.secondaryText,
    fontSize: 16,
    fontWeight: '700',
  },
  modalListContent: {
    padding: SPACING.md,
  },
  cartItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(92, 139, 248, 0.18)',
  },
  cartItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cartItemImage: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  cartItemNameContainer: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  cartItemName: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: '#0F172A',
    fontSize: 15,
  },
  cartItemPrice: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 2,
    fontSize: 13,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyButton: {
    backgroundColor: COLORS.searchBarBackground,
    borderWidth: 1.5,
    borderColor: 'rgba(92, 139, 248, 0.35)',
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  qtyText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    marginHorizontal: SPACING.sm,
    minWidth: 16,
    textAlign: 'center',
  },
  removeCartItemButton: {
    marginLeft: SPACING.sm,
    padding: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
  },
  removeCartItemButtonText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  modalFooter: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(92, 139, 248, 0.15)',
    backgroundColor: COLORS.searchBarBackground,
  },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  modalTotalLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondaryText,
  },
  modalTotalValue: {
    ...TYPOGRAPHY.h2,
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  checkoutButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  checkoutButtonDisabled: {
    opacity: 0.6,
  },
  checkoutButtonText: {
    ...TYPOGRAPHY.button,
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalFormContainer: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(92, 139, 248, 0.15)',
  },
  formSectionTitle: {
    ...TYPOGRAPHY.h3,
    marginBottom: SPACING.sm,
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 16,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  formHalfInputWrapper: {
    width: '48%',
  },
  formInputLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.secondaryText,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 5,
  },
  formInput: {
    height: 42,
    backgroundColor: '#F8FAFC',
    borderColor: 'rgba(92, 139, 248, 0.3)',
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    color: '#0F172A',
    ...TYPOGRAPHY.body,
    fontSize: 14,
  },
  notesInput: {
    height: 56,
    paddingTop: SPACING.xs + 2,
    textAlignVertical: 'top',
  },
  paymentSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  paymentOption: {
    flex: 1,
    height: 38,
    backgroundColor: '#F8FAFC',
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  paymentOptionSelected: {
    backgroundColor: 'rgba(92, 139, 248, 0.15)',
    borderColor: COLORS.primary,
  },
  paymentOptionText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondaryText,
  },
  paymentOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  condicionBadge: {
    flex: 1,
    height: 38,
    backgroundColor: '#F8FAFC',
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  condicionBadgeActive: {
    backgroundColor: 'rgba(92, 139, 248, 0.15)',
    borderColor: COLORS.primary,
  },
  condicionBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.secondaryText,
  },
  condicionBadgeTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  // ─── Dual-Column Lateral Drawer (Anclado a la derecha, estilo de la imagen) ──
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  dualDrawerContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    width: 380,
    maxWidth: '92%',
    height: '100%',
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(92, 139, 248, 0.2)',
    // Sombra hacia la izquierda
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  dualDrawerInner: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
  },
  // Columna 1: Rail Izquierdo
  railColumn: {
    width: 96,
    backgroundColor: '#F8FAFC',
    borderRightWidth: 1,
    borderRightColor: 'rgba(92, 139, 248, 0.15)',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  railScrollContent: {
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  railTabItem: {
    width: 80,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    marginVertical: 4,
    backgroundColor: 'transparent',
  },
  railTabItemSelected: {
    backgroundColor: 'rgba(92, 139, 248, 0.15)',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  railTabIcon: {
    width: 24,
    height: 24,
    marginBottom: 5,
  },
  railTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.65)',
    textAlign: 'center',
  },
  railTabLabelSelected: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  // Columna 2: Submenú Derecho
  submenuColumn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    position: 'relative',
  },
  submenuCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 16,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(92, 139, 248, 0.15)',
  },
  submenuCloseText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  submenuScrollContent: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  submenuMainPill: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submenuMainPillText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  submenuMainPillSub: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  submenuLinksList: {
    gap: 8,
  },
  submenuLinkItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(92, 139, 248, 0.1)',
  },
  submenuLinkItemDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  submenuLinkText: {
    color: '#0F172A',
    fontSize: 13.5,
    fontWeight: '600',
  },
  submenuLinkDanger: {
    color: COLORS.danger,
    fontWeight: '700',
  },
  // Stats Modal
  statsScreenContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(92, 139, 248, 0.15)',
    backgroundColor: '#FFFFFF',
  },
  statsHeaderTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.primary,
  },
  statsCloseButton: {
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#F1F5F9',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(92, 139, 248, 0.15)',
  },
  statsCloseButtonText: {
    color: '#475569',
    fontWeight: '700',
  },
  statsLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsLoaderText: {
    ...TYPOGRAPHY.bodyMuted,
    marginTop: SPACING.md,
    color: '#64748B',
  },
  statsContentContainer: {
    flex: 1,
    padding: SPACING.md,
  },
  statsDateRangeCard: {
    backgroundColor: 'rgba(92, 139, 248, 0.12)',
    borderColor: COLORS.primary,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsDateRangeLabel: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: '#64748B',
  },
  statsDateRangeValue: {
    ...TYPOGRAPHY.body,
    fontWeight: '800',
    color: COLORS.primary,
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(92, 139, 248, 0.15)',
    alignItems: 'center',
  },
  kpiLabel: {
    ...TYPOGRAPHY.caption,
    color: '#64748B',
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  kpiValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
    marginVertical: SPACING.xs,
  },
  kpiSub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.success,
    fontWeight: '600',
  },
  statsSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(92, 139, 248, 0.15)',
  },
  statsSectionTitle: {
    ...TYPOGRAPHY.h3,
    marginBottom: SPACING.sm,
    color: '#0F172A',
  },
  statsSectionSubTitle: {
    ...TYPOGRAPHY.caption,
    marginBottom: SPACING.md,
    color: '#64748B',
  },
  noDataText: {
    ...TYPOGRAPHY.bodyMuted,
    textAlign: 'center',
    paddingVertical: SPACING.md,
    color: '#64748B',
  },
  paymentProgressContainer: {
    marginTop: SPACING.xs,
  },
  paymentProgressItem: {
    marginBottom: SPACING.md,
  },
  paymentProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  paymentProgressLabel: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: '#0F172A',
  },
  paymentProgressValue: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.primary,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: BORDER_RADIUS.round,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.success,
  },
  topProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(92, 139, 248, 0.08)',
  },
  topProductIndex: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    marginRight: SPACING.md,
    width: 24,
  },
  topProductName: {
    flex: 1,
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: '#0F172A',
  },
  topProductQty: {
    ...TYPOGRAPHY.body,
    fontWeight: '800',
    color: '#64748B',
  },
  transactionCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(92, 139, 248, 0.15)',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionMainInfo: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  transactionId: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: '#0F172A',
  },
  transactionDate: {
    ...TYPOGRAPHY.caption,
    color: '#64748B',
    marginVertical: 2,
  },
  transactionDetails: {
    ...TYPOGRAPHY.caption,
    color: '#475569',
  },
  transactionPayType: {
    ...TYPOGRAPHY.caption,
    color: COLORS.secondary,
    fontWeight: '700',
    marginTop: 2,
  },
  transactionRightInfo: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  transactionTotal: {
    ...TYPOGRAPHY.body,
    fontWeight: '800',
    color: COLORS.secondary,
    fontSize: 16,
    marginBottom: SPACING.xs,
  },
  deleteTransactionButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: COLORS.danger,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  deleteTransactionText: {
    color: COLORS.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  // Confirm Delete Dialog
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  confirmBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(92, 139, 248, 0.2)',
    shadowColor: '#000',
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
    color: '#0F172A',
  },
  confirmText: {
    ...TYPOGRAPHY.bodyMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 20,
    color: '#64748B',
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
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  confirmBtnCancelText: {
    color: '#475569',
    fontWeight: '700',
  },
  confirmBtnDelete: {
    backgroundColor: COLORS.danger,
  },
  confirmBtnDeleteText: {
    color: COLORS.textLight,
    fontWeight: '700',
  },
  sucursalFilterCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sucursalFilterLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontWeight: '800',
    marginBottom: SPACING.xs,
    letterSpacing: 1,
  },
  sucursalFilterList: {
    paddingVertical: 4,
    gap: 8,
  },
  sucursalFilterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sucursalFilterButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sucursalFilterButtonText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  sucursalFilterButtonTextSelected: {
    color: COLORS.textLight,
    fontWeight: '800',
  },
  cocinaButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
  },
  cocinaButtonText: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: 14,
  },
  reloadButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: COLORS.success,
  },
  reloadButtonText: {
    fontSize: 18,
  },
});

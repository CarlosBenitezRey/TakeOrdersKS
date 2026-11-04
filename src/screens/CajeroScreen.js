import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
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
import {
  COLORS,
  POS_COLORS,
  SPACING,
  BORDER_RADIUS,
  TYPOGRAPHY,
} from '../theme/theme';
import { getProductImage, APP_ICONS, getCategoryIcon } from '../theme/assets';

// ─── Utilidades de formato y estética estilo Spotify ──────────────────────────

const formatPrice = (value) => Number(value || 0).toLocaleString('es-AR');

const FONT_BODY = Platform.select({
  ios: 'Avenir Next',
  android: 'sans-serif',
  web: 'Avenir Next, Inter, system-ui, sans-serif',
});

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function CajeroScreen({ userProfile, onSwitchView }) {
  // ─── Lógica Responsive (Móvil, Tablet, Desktop) ──────────────────────────────
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < 600;
  const isTablet = windowWidth >= 600 && windowWidth < 1024;

  // Cantidad de columnas dinámicas para la grilla
  const numColumns = isMobile ? 2 : isTablet ? 3 : 4;

  // Ancho simétrico para alinear Header, Search, Grilla y Carrito
  const containerWidth = Math.min(1150, windowWidth - (isMobile ? 20 : 32));

  // Dimensiones proporcionales calculadas para cada tarjeta
  const cardGap = isMobile ? 10 : 14;
  const cardWidth = Math.floor((containerWidth - (numColumns - 1) * cardGap) / numColumns);
  const cardHeight = isMobile ? 118 : isTablet ? 132 : 142;
  const cardTitleSize = isMobile ? 15 : isTablet ? 16 : 17;
  const cardTitleLineHeight = isMobile ? 19 : isTablet ? 20 : 22;
  const cardPriceSize = isMobile ? 13 : isTablet ? 14 : 15;
  const cardImageSize = isMobile ? 80 : isTablet ? 94 : 104;

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

  const selectedCategoryName =
    categorias.find((categoria) => categoria.id === selectedCategoryId)?.nombre ||
    'Todo el menú';

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
      <StatusBar barStyle="dark-content" backgroundColor={POS_COLORS.surfaceStrong} />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={[styles.headerInner, { width: containerWidth }]}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle}>Manageopy</Text>
            <View style={styles.brandDivider} />
            <Text style={styles.headerLocation} numberOfLines={1}>
              {getSucursalName(userProfile?.sucursal_id)} · POS
            </Text>
          </View>
          <View style={styles.headerActions}>
            {!isMobile && (
              <View style={styles.headerUserBlock}>
                <View style={styles.onlineDot} />
                <Text style={styles.headerSubtitle}>
                  {userProfile?.nombre || 'Invitado'}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.menuButton}
              onPress={openDrawer}
              activeOpacity={0.7}
            >
              <Text style={styles.menuButtonText}>Menú</Text>
              <Text style={styles.menuButtonIcon}>≡</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.discoveryBar,
          { width: containerWidth },
          !isMobile && styles.discoveryBarWide,
        ]}
      >
        {/* SEARCH BAR */}
        <View style={[styles.searchContainer, !isMobile && styles.searchContainerWide]}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar platos o bebidas..."
            placeholderTextColor={POS_COLORS.muted}
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

        {/* CATEGORY SELECTOR */}
        <View style={[styles.categorySection, !isMobile && styles.categorySectionWide]}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categorias}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.categoryList}
            renderItem={({ item }) => {
              const isSelected = selectedCategoryId === item.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.categoryButton,
                    isSelected && styles.categoryButtonSelected,
                  ]}
                  activeOpacity={0.75}
                  onPress={() => setSelectedCategoryId(item.id)}
                >
                  <Image
                    source={getCategoryIcon(item.nombre)}
                    style={[
                      styles.categoryIcon,
                      isSelected && styles.categoryIconSelected,
                    ]}
                    resizeMode="contain"
                  />
                  <Text
                    style={[
                      styles.categoryText,
                      isSelected && styles.categoryTextSelected,
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
      </View>

      <View style={[styles.catalogHeader, { width: containerWidth }]}>
        <View>
          <Text style={styles.catalogTitle}>{selectedCategoryName}</Text>
        </View>
        <Text style={styles.catalogCount}>
          {productosFiltrados.length}{' '}
          {productosFiltrados.length === 1 ? 'producto' : 'productos'}
        </Text>
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
          <ActivityIndicator size="large" color={POS_COLORS.primary} />
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
              <View
                style={[
                  styles.productCardShadow,
                  { width: cardWidth, height: cardHeight },
                ]}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.productCard,
                    pressed && isDisponible && styles.productCardPressed,
                    !isDisponible && styles.productCardDisabled,
                  ]}
                  onPress={() => {
                    if (!isDisponible) {
                      showStatus(`"${item.nombre}" está agotado en cocina`, 'error');
                      return;
                    }
                    agregarProducto(item);
                  }}
                >
                {/* Fotografía del producto */}
                <View
                  style={[
                    styles.imageThumbnailWrapper,
                    {
                      width: cardImageSize,
                      height: cardImageSize,
                    },
                  ]}
                >
                  <Image
                    source={getProductImage(item.nombre, item.imagen_url)}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                </View>

                {/* Información del producto */}
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
                  <View style={styles.cardPriceRow}>
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
                    {isDisponible && (
                      <View
                        style={[
                          styles.cardAddButton,
                          cantidadEnCarrito > 0 && styles.cardAddButtonActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.cardAddButtonText,
                            cantidadEnCarrito > 0 && styles.cardAddButtonTextActive,
                          ]}
                        >
                          {cantidadEnCarrito > 0 ? cantidadEnCarrito : '+'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Overlay si está agotado */}
                {!isDisponible && (
                  <View style={styles.agotadoOverlay}>
                    <View style={styles.badgeAgotado}>
                      <Text style={styles.badgeAgotadoText}>AGOTADO</Text>
                    </View>
                  </View>
                )}

                </Pressable>
              </View>
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
            <View style={styles.floatingCartCopy}>
              <Text style={styles.floatingCartEyebrow}>PEDIDO ACTUAL</Text>
              <Text style={styles.floatingCartText}>
                Revisar {totalCantidad === 1 ? 'producto' : 'productos'}
              </Text>
            </View>
            <View style={styles.floatingCartAmount}>
              <Text style={styles.floatingCartTotal}>
                Gs. {formatPrice(totalPrecio)}
              </Text>
              <Text style={styles.floatingCartArrow}>→</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

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
                            {
                              tintColor: isSelected
                                ? POS_COLORS.primary
                                : POS_COLORS.muted,
                            },
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
    backgroundColor: POS_COLORS.canvas,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(23, 21, 18, 0.10)',
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 58,
    paddingVertical: 7,
    alignSelf: 'center',
  },
  headerTitleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    color: POS_COLORS.ink,
    fontFamily: FONT_BODY,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  brandDivider: {
    width: 1,
    height: 18,
    backgroundColor: POS_COLORS.line,
  },
  headerSubtitle: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: POS_COLORS.ink,
  },
  headerUserBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginRight: 10,
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: POS_COLORS.primary,
  },
  headerLocation: {
    color: POS_COLORS.muted,
    fontFamily: FONT_BODY,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
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
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: POS_COLORS.primaryDark,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
  },
  menuButtonText: {
    color: '#FFFFFF',
    fontFamily: FONT_BODY,
    fontWeight: '700',
    fontSize: 14,
  },
  menuButtonIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
  },
  discoveryBar: {
    alignSelf: 'center',
  },
  discoveryBarWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    paddingHorizontal: 13,
    marginTop: 10,
    marginBottom: 8,
    alignSelf: 'center',
  },
  searchContainerWide: {
    width: 300,
    marginTop: 0,
    marginBottom: 0,
  },
  searchIcon: {
    color: POS_COLORS.muted,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '500',
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 42,
    color: POS_COLORS.ink,
    fontFamily: FONT_BODY,
    fontSize: 15,
  },
  clearSearch: {
    padding: SPACING.xs,
  },
  clearSearchText: {
    color: POS_COLORS.muted,
    fontSize: 16,
  },
  categorySection: {
    alignSelf: 'center',
    width: '100%',
    minHeight: 40,
    marginBottom: 8,
  },
  categorySectionWide: {
    flex: 1,
    marginBottom: 0,
  },
  categoryList: {
    gap: 8,
    paddingRight: 2,
  },
  categoryButton: {
    minWidth: 0,
    height: 38,
    paddingHorizontal: 13,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryButtonSelected: {
    backgroundColor: POS_COLORS.primarySoft,
    borderColor: POS_COLORS.primarySoft,
  },
  categoryIcon: {
    width: 18,
    height: 18,
    tintColor: POS_COLORS.muted,
  },
  categoryIconSelected: {
    tintColor: POS_COLORS.primary,
  },
  categoryText: {
    color: POS_COLORS.muted,
    fontFamily: FONT_BODY,
    fontSize: 13,
    fontWeight: '700',
  },
  categoryTextSelected: {
    color: POS_COLORS.primaryDark,
    fontWeight: '800',
  },
  catalogHeader: {
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  catalogTitle: {
    color: POS_COLORS.ink,
    fontFamily: FONT_BODY,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  catalogCount: {
    color: POS_COLORS.muted,
    fontFamily: FONT_BODY,
    fontSize: 12,
    fontWeight: '700',
    paddingBottom: 3,
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
    paddingTop: 0,
    paddingBottom: 96,
    alignSelf: 'center',
  },
  rowWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  // ─── Tarjetas de producto optimizadas para POS ───────────────────────────────
  productCardShadow: {
    borderRadius: 14,
    backgroundColor: POS_COLORS.surfaceStrong,
    shadowColor: '#17221B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 4,
  },
  productCard: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    padding: 13,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: '#D5DDD7',
    backgroundColor: POS_COLORS.surfaceStrong,
  },
  productCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.985 }],
  },
  productCardDisabled: {
    opacity: 0.55,
  },
  cardTextContainer: {
    flex: 1,
    height: '100%',
    justifyContent: 'space-between',
    maxWidth: '61%',
    zIndex: 2,
  },
  productName: {
    color: POS_COLORS.ink,
    fontFamily: FONT_BODY,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  productPrice: {
    color: POS_COLORS.primaryDark,
    fontFamily: FONT_BODY,
    fontWeight: '700',
    letterSpacing: 0,
  },
  cardPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  cardAddButton: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: POS_COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: POS_COLORS.primarySoft,
  },
  cardAddButtonActive: {
    backgroundColor: POS_COLORS.primary,
    borderColor: POS_COLORS.primary,
  },
  cardAddButtonText: {
    color: POS_COLORS.primaryDark,
    fontFamily: FONT_BODY,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '400',
    marginTop: -1,
  },
  cardAddButtonTextActive: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    marginTop: 0,
  },
  imageThumbnailWrapper: {
    position: 'absolute',
    right: -9,
    bottom: -7,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: POS_COLORS.line,
    transform: [{ rotate: '4deg' }],
    borderWidth: 2,
    borderColor: POS_COLORS.surfaceStrong,
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
    bottom: 22,
    alignSelf: 'center',
    zIndex: 35,
    paddingHorizontal: 0,
  },
  floatingCartButton: {
    backgroundColor: POS_COLORS.primaryDark,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 68,
    paddingVertical: 11,
    paddingHorizontal: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
  },
  cartItemsCountBadge: {
    backgroundColor: POS_COLORS.primary,
    borderRadius: 6,
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartItemsCountText: {
    color: '#FFFFFF',
    fontFamily: FONT_BODY,
    fontWeight: '800',
    fontSize: 14,
  },
  floatingCartCopy: {
    flex: 1,
    marginLeft: 12,
  },
  floatingCartEyebrow: {
    color: '#A7A098',
    fontFamily: FONT_BODY,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  floatingCartText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  floatingCartAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  floatingCartTotal: {
    fontFamily: FONT_BODY,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  floatingCartArrow: {
    color: POS_COLORS.primary,
    fontSize: 22,
    fontWeight: '400',
  },
  // Cart Modal (Centrado en pantalla y colores en coherencia con CajeroScreen)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(32, 26, 23, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
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
    borderBottomColor: POS_COLORS.line,
    backgroundColor: POS_COLORS.surfaceStrong,
  },
  modalTitle: {
    ...TYPOGRAPHY.h2,
    color: POS_COLORS.ink,
    fontWeight: '900',
    fontSize: 22,
  },
  closeModalButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: POS_COLORS.canvas,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: POS_COLORS.muted,
    fontSize: 16,
    fontWeight: '700',
  },
  modalListContent: {
    padding: SPACING.md,
  },
  cartItemCard: {
    backgroundColor: POS_COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: POS_COLORS.line,
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
    color: POS_COLORS.ink,
    fontSize: 15,
  },
  cartItemPrice: {
    ...TYPOGRAPHY.caption,
    color: POS_COLORS.primary,
    fontWeight: '700',
    marginTop: 2,
    fontSize: 13,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyButton: {
    backgroundColor: POS_COLORS.surfaceStrong,
    borderWidth: 1.5,
    borderColor: POS_COLORS.line,
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonText: {
    color: POS_COLORS.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  qtyText: {
    color: POS_COLORS.ink,
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
    borderTopColor: POS_COLORS.line,
    backgroundColor: POS_COLORS.surfaceStrong,
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
    color: POS_COLORS.muted,
  },
  modalTotalValue: {
    ...TYPOGRAPHY.h2,
    color: POS_COLORS.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  checkoutButton: {
    backgroundColor: POS_COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    shadowColor: POS_COLORS.primaryDark,
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
    borderTopColor: POS_COLORS.line,
  },
  formSectionTitle: {
    ...TYPOGRAPHY.h3,
    marginBottom: SPACING.sm,
    color: POS_COLORS.ink,
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
    color: POS_COLORS.muted,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 5,
  },
  formInput: {
    height: 42,
    backgroundColor: POS_COLORS.surface,
    borderColor: POS_COLORS.line,
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    color: POS_COLORS.ink,
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
    backgroundColor: POS_COLORS.surface,
    borderColor: POS_COLORS.line,
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  paymentOptionSelected: {
    backgroundColor: POS_COLORS.primarySoft,
    borderColor: POS_COLORS.primary,
  },
  paymentOptionText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '600',
    color: POS_COLORS.muted,
  },
  paymentOptionTextSelected: {
    color: POS_COLORS.primaryDark,
    fontWeight: '800',
  },
  condicionBadge: {
    flex: 1,
    height: 38,
    backgroundColor: POS_COLORS.surface,
    borderColor: POS_COLORS.line,
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  condicionBadgeActive: {
    backgroundColor: POS_COLORS.primarySoft,
    borderColor: POS_COLORS.primary,
  },
  condicionBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '600',
    color: POS_COLORS.muted,
  },
  condicionBadgeTextActive: {
    color: POS_COLORS.primaryDark,
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
    borderLeftColor: POS_COLORS.line,
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
    backgroundColor: POS_COLORS.canvas,
    borderRightWidth: 1,
    borderRightColor: POS_COLORS.line,
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
    backgroundColor: POS_COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: POS_COLORS.primary,
  },
  railTabIcon: {
    width: 24,
    height: 24,
    marginBottom: 5,
  },
  railTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: POS_COLORS.muted,
    textAlign: 'center',
  },
  railTabLabelSelected: {
    color: POS_COLORS.primaryDark,
    fontWeight: '800',
  },
  // Columna 2: Submenú Derecho
  submenuColumn: {
    flex: 1,
    backgroundColor: POS_COLORS.surfaceStrong,
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
    backgroundColor: POS_COLORS.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  submenuCloseText: {
    color: POS_COLORS.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  submenuScrollContent: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  submenuMainPill: {
    backgroundColor: POS_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: POS_COLORS.primaryDark,
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
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  submenuLinkItemDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  submenuLinkText: {
    color: POS_COLORS.ink,
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

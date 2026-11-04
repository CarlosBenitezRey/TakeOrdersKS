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
import rucService from '../services/RucService';
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
import { PRODUCT_CONFIG } from '../config/productConfig';

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
  const [rucLookup, setRucLookup] = useState({
    status: 'idle',
    data: null,
    error: '',
  });
  const rucRequestId = useRef(0);
  const rucAbortController = useRef(null);

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

  const consultarRuc = async (value = clienteRuc, { automatic = false } = {}) => {
    const ruc = rucService.formatearEntrada(value);

    if (!rucService.esConsultaValida(ruc)) {
      if (!automatic) {
        setRucLookup({
          status: 'error',
          data: null,
          error: 'Ingresá el RUC completo con su dígito verificador.',
        });
      }
      return;
    }

    rucAbortController.current?.abort();
    const controller = new AbortController();
    const requestId = rucRequestId.current + 1;
    rucRequestId.current = requestId;
    rucAbortController.current = controller;

    setRucLookup({ status: 'loading', data: null, error: '' });

    try {
      const contribuyente = await rucService.buscarPorNumero(ruc, {
        signal: controller.signal,
      });

      if (requestId !== rucRequestId.current) return;

      setClienteRuc(contribuyente.ruc);
      setCliente(contribuyente.razonSocial);
      setRucLookup({ status: 'success', data: contribuyente, error: '' });
    } catch (error) {
      if (error.name === 'AbortError' || requestId !== rucRequestId.current) return;

      setRucLookup({
        status: 'error',
        data: null,
        error:
          error.code === 'RUC_NOT_FOUND' || error.code === 'INVALID_RUC'
            ? error.message
            : 'No pudimos consultar TuRuc. Podés completar los datos manualmente.',
      });
    }
  };

  const handleRucChange = (value) => {
    const razonSocialSeleccionada = rucLookup.data?.razonSocial;
    rucAbortController.current?.abort();
    rucRequestId.current += 1;
    setClienteRuc(rucService.formatearEntrada(value));
    if (
      razonSocialSeleccionada &&
      cliente.trim() === razonSocialSeleccionada.trim()
    ) {
      setCliente('');
    }
    setRucLookup({ status: 'idle', data: null, error: '' });
  };

  const limpiarRuc = () => {
    const razonSocialSeleccionada = rucLookup.data?.razonSocial;
    rucAbortController.current?.abort();
    rucRequestId.current += 1;
    setClienteRuc('');
    if (
      razonSocialSeleccionada &&
      cliente.trim() === razonSocialSeleccionada.trim()
    ) {
      setCliente('');
    }
    setRucLookup({ status: 'idle', data: null, error: '' });
  };

  useEffect(() => {
    if (
      !rucService.esRucCompleto(clienteRuc) ||
      rucLookup.status !== 'idle'
    ) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      consultarRuc(clienteRuc, { automatic: true });
    }, 650);

    return () => clearTimeout(timeoutId);
  }, [clienteRuc, rucLookup.status]);

  useEffect(
    () => () => {
      rucAbortController.current?.abort();
    },
    []
  );

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
      setRucLookup({ status: 'idle', data: null, error: '' });
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

  const renderCartItem = ({ item }) => (
    <View style={[styles.cartItemCard, isMobile && styles.cartItemCardMobile]}>
      <View style={styles.cartItemInfo}>
        <Image
          source={getProductImage(item.producto.nombre)}
          style={styles.cartItemImage}
          resizeMode="cover"
        />
        <View style={styles.cartItemNameContainer}>
          <Text style={styles.cartItemName} numberOfLines={2}>
            {item.producto.nombre}
          </Text>
          <Text style={styles.cartItemPrice}>
            Gs. {formatPrice(item.producto.precio * item.cantidad)}
          </Text>
          <Text style={styles.cartItemUnitPrice}>
            Gs. {formatPrice(item.producto.precio)} por unidad
          </Text>
        </View>
      </View>
      <View style={[styles.cartItemActions, isMobile && styles.cartItemActionsMobile]}>
        <TouchableOpacity
          accessibilityLabel={`Disminuir ${item.producto.nombre}`}
          style={styles.qtyButton}
          onPress={() => disminuirProducto(item.producto)}
        >
          <Text style={styles.qtyButtonText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.cantidad}</Text>
        <TouchableOpacity
          accessibilityLabel={`Agregar ${item.producto.nombre}`}
          style={[styles.qtyButton, styles.qtyButtonAdd]}
          onPress={() => agregarProducto(item.producto)}
        >
          <Text style={[styles.qtyButtonText, styles.qtyButtonTextAdd]}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel={`Eliminar ${item.producto.nombre}`}
          style={styles.removeCartItemButton}
          onPress={() => eliminarProducto(item.producto.id)}
        >
          <Text style={styles.removeCartItemButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOrderForm = () => (
    <View style={[styles.modalFormContainer, isMobile && styles.modalFormContainerMobile]}>
      <View style={styles.formSectionHeading}>
        <Text style={styles.formSectionEyebrow}>DATOS DEL PEDIDO</Text>
        <Text style={styles.formSectionTitle}>Entrega y facturación</Text>
      </View>

      <View style={[styles.formRow, isMobile && styles.formRowMobile]}>
        <View style={[styles.formHalfInputWrapper, isMobile && styles.formInputFull]}>
          <Text style={styles.formInputLabel}>Mesa / destino</Text>
          <TextInput
            style={styles.formInput}
            placeholder="Ej. Mesa 4 o Para llevar"
            placeholderTextColor={POS_COLORS.muted}
            value={mesa}
            onChangeText={setMesa}
          />
        </View>
        <View style={[styles.formHalfInputWrapper, isMobile && styles.formInputFull]}>
          <Text style={styles.formInputLabel}>Cliente / razón social</Text>
          <TextInput
            style={styles.formInput}
            placeholder="Se completa al consultar el RUC"
            placeholderTextColor={POS_COLORS.muted}
            value={cliente}
            onChangeText={setCliente}
          />
        </View>
      </View>

      <View style={styles.rucLookupSection}>
        <Text style={styles.formInputLabel}>RUC / C.I.</Text>
        <View style={styles.rucInputRow}>
          <View
            style={[
              styles.rucInputShell,
              rucLookup.status === 'success' && styles.rucInputShellSuccess,
              rucLookup.status === 'error' && styles.rucInputShellError,
            ]}
          >
            <TextInput
              style={styles.rucInput}
              placeholder="Ej. 80024191-6"
              placeholderTextColor={POS_COLORS.muted}
              value={clienteRuc}
              onChangeText={handleRucChange}
              onSubmitEditing={() => consultarRuc()}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
              returnKeyType="search"
              autoCorrect={false}
              maxLength={10}
            />
            {clienteRuc !== '' ? (
              <TouchableOpacity
                accessibilityLabel="Limpiar RUC"
                hitSlop={6}
                style={styles.rucInlineClear}
                onPress={limpiarRuc}
              >
                <Text style={styles.rucInlineClearText}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            accessibilityLabel="Buscar contribuyente por RUC"
            disabled={rucLookup.status === 'loading'}
            style={[
              styles.rucSearchButton,
              rucLookup.status === 'loading' && styles.rucSearchButtonDisabled,
            ]}
            onPress={() => consultarRuc()}
          >
            {rucLookup.status === 'loading' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.rucSearchButtonText}>Consultar</Text>
            )}
          </TouchableOpacity>
        </View>

        {rucLookup.status === 'success' && rucLookup.data ? (
          <View
            style={[
              styles.rucResultCard,
              rucLookup.data.estado !== 'ACTIVO' && styles.rucResultCardWarning,
            ]}
          >
            <View
              style={[
                styles.rucResultStatusIcon,
                rucLookup.data.estado !== 'ACTIVO' &&
                  styles.rucResultStatusIconWarning,
              ]}
            >
              <Text style={styles.rucResultStatusIconText}>
                {rucLookup.data.estado === 'ACTIVO' ? '✓' : '!'}
              </Text>
            </View>
            <View style={styles.rucResultCopy}>
              <Text style={styles.rucResultEyebrow}>CONTRIBUYENTE ENCONTRADO</Text>
              <Text style={styles.rucResultName} numberOfLines={2}>
                {rucLookup.data.razonSocial}
              </Text>
              <Text style={styles.rucResultMeta}>
                {rucLookup.data.ruc} · {rucLookup.data.estado}
              </Text>
            </View>
            <TouchableOpacity style={styles.rucChangeButton} onPress={limpiarRuc}>
              <Text style={styles.rucChangeButtonText}>Cambiar</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {rucLookup.status === 'error' ? (
          <View style={styles.rucErrorCard}>
            <Text style={styles.rucErrorText}>{rucLookup.error}</Text>
            <TouchableOpacity onPress={limpiarRuc}>
              <Text style={styles.rucErrorAction}>Limpiar</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {rucLookup.status === 'idle' ? (
          <Text style={styles.rucHelperText}>
            Escribí el RUC completo; lo consultaremos automáticamente.
          </Text>
        ) : null}
      </View>

      <View style={styles.conditionSection}>
        <Text style={styles.formInputLabel}>Condición de venta</Text>
        <View style={styles.segmentedControl}>
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

      <Text style={styles.formInputLabel}>Método de pago</Text>
      <View style={styles.paymentSelector}>
        {[
          ['efectivo', 'Efectivo'],
          ['tarjeta', 'Tarjeta'],
          ['transferencia', 'Transfer.'],
          ['pendiente', 'Pendiente'],
        ].map(([value, label]) => (
          <TouchableOpacity
            key={value}
            style={[
              styles.paymentOption,
              metodoPago === value && styles.paymentOptionSelected,
            ]}
            onPress={() => setMetodoPago(value)}
          >
            <Text
              style={[
                styles.paymentOptionText,
                metodoPago === value && styles.paymentOptionTextSelected,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.formInputLabel}>Notas para cocina</Text>
      <TextInput
        style={[styles.formInput, styles.notesInput]}
        placeholder="Ej. Sin cebolla, cortar en porciones..."
        placeholderTextColor={POS_COLORS.muted}
        value={notas}
        onChangeText={setNotas}
        multiline={true}
        numberOfLines={3}
      />
    </View>
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
      <StatusBar barStyle="light-content" backgroundColor={PRODUCT_CONFIG.branding.background} />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={[styles.headerInner, { width: containerWidth }]}>
          <View style={styles.headerTitleBlock}>
            <View style={styles.headerLogoFrame}>
              <Image
                source={PRODUCT_CONFIG.logo}
                style={styles.headerLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.headerTitle}>{PRODUCT_CONFIG.name}</Text>
            {!isMobile && (
              <>
                <View style={styles.brandDivider} />
                <Text style={styles.headerLocation} numberOfLines={1}>
                  {getSucursalName(userProfile?.sucursal_id)} · POS
                </Text>
              </>
            )}
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
              <View>
                <Text style={styles.modalEyebrow}>REVISIÓN DEL PEDIDO</Text>
                <Text style={styles.modalTitle}>Pedido actual</Text>
                <Text style={styles.modalSubtitle}>
                  {totalCantidad} {totalCantidad === 1 ? 'unidad' : 'unidades'} · Revisa antes de enviar
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setIsCartVisible(false)}
              >
                <Text style={styles.closeModalButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {isMobile ? (
              <FlatList
                data={carrito}
                keyExtractor={(item) => item.producto.id.toString()}
                contentContainerStyle={styles.modalListContent}
                renderItem={renderCartItem}
                ListFooterComponent={renderOrderForm}
              />
            ) : (
              <View style={styles.modalBodyWide}>
                <View style={styles.modalProductsPane}>
                  <View style={styles.paneHeadingRow}>
                    <Text style={styles.paneHeading}>Productos</Text>
                    <Text style={styles.paneCount}>{carrito.length} líneas</Text>
                  </View>
                  <FlatList
                    data={carrito}
                    keyExtractor={(item) => item.producto.id.toString()}
                    contentContainerStyle={styles.modalProductsList}
                    renderItem={renderCartItem}
                    showsVerticalScrollIndicator={false}
                  />
                </View>
                <ScrollView
                  style={styles.modalFormPane}
                  contentContainerStyle={styles.modalFormPaneContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {renderOrderForm()}
                </ScrollView>
              </View>
            )}

            <View style={[styles.modalFooter, isMobile && styles.modalFooterMobile]}>
              <View style={[styles.modalTotalRow, isMobile && styles.modalTotalRowMobile]}>
                <View>
                  <Text style={styles.modalTotalLabel}>TOTAL A PAGAR</Text>
                  <Text style={styles.modalTotalHelper}>Impuestos incluidos</Text>
                </View>
                <Text style={styles.modalTotalValue}>
                  Gs. {formatPrice(totalPrecio)}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.checkoutButton,
                  isMobile && styles.checkoutButtonMobile,
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
    backgroundColor: PRODUCT_CONFIG.branding.primaryDark,
    backgroundImage: 'linear-gradient(110deg, #07130D 0%, #183B2A 58%, #244B35 100%)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.10)',
    shadowColor: '#07130D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 7,
    zIndex: 10,
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 66,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  headerTitleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogoFrame: {
    width: 52,
    height: 34,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  headerLogo: {
    width: '100%',
    height: '100%',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontFamily: FONT_BODY,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  brandDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  headerSubtitle: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: '#F4F8F5',
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
    backgroundColor: '#7DC496',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  headerLocation: {
    color: 'rgba(232, 242, 235, 0.68)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.11)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
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
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    backgroundColor: POS_COLORS.surfaceStrong,
    shadowColor: '#17221B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: POS_COLORS.surface,
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
    borderColor: '#C7DDCE',
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
    marginTop: 2,
    marginBottom: 10,
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
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.09,
    shadowRadius: 16,
    elevation: 3,
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
    borderColor: '#D9E1DB',
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
    backgroundColor: PRODUCT_CONFIG.branding.primaryDark,
    backgroundImage: 'linear-gradient(100deg, #183B2A 0%, #244B35 100%)',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 68,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.13)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
  },
  cartItemsCountBadge: {
    backgroundColor: PRODUCT_CONFIG.branding.primaryBright,
    borderRadius: 10,
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
    backgroundColor: 'rgba(7, 19, 13, 0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 960,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34,
    shadowRadius: 34,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingVertical: 19,
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.line,
    backgroundColor: POS_COLORS.surfaceStrong,
  },
  modalTitle: {
    color: POS_COLORS.ink,
    fontWeight: '900',
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.7,
  },
  modalEyebrow: {
    color: POS_COLORS.primary,
    fontFamily: FONT_BODY,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.35,
    marginBottom: 3,
  },
  modalSubtitle: {
    color: POS_COLORS.muted,
    fontFamily: FONT_BODY,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 3,
  },
  closeModalButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: POS_COLORS.muted,
    fontSize: 16,
    fontWeight: '700',
  },
  modalListContent: {
    padding: 14,
  },
  modalBodyWide: {
    flex: 1,
    minHeight: 360,
    flexDirection: 'row',
    backgroundColor: POS_COLORS.canvas,
  },
  modalProductsPane: {
    flex: 1.05,
    padding: 18,
    borderRightWidth: 1,
    borderRightColor: POS_COLORS.line,
  },
  modalFormPane: {
    flex: 0.95,
    backgroundColor: POS_COLORS.surfaceStrong,
  },
  modalFormPaneContent: {
    padding: 20,
  },
  paneHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  paneHeading: {
    color: POS_COLORS.ink,
    fontFamily: FONT_BODY,
    fontSize: 14,
    fontWeight: '800',
  },
  paneCount: {
    color: POS_COLORS.muted,
    fontFamily: FONT_BODY,
    fontSize: 11,
    fontWeight: '700',
  },
  modalProductsList: {
    paddingBottom: 4,
  },
  cartItemCard: {
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: 14,
    padding: 12,
    marginBottom: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    shadowColor: '#17221B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.045,
    shadowRadius: 8,
    elevation: 1,
  },
  cartItemCardMobile: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 11,
  },
  cartItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cartItemImage: {
    width: 54,
    height: 54,
    borderRadius: 12,
    marginRight: 11,
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
    fontSize: 14,
    lineHeight: 18,
  },
  cartItemPrice: {
    ...TYPOGRAPHY.caption,
    color: POS_COLORS.primary,
    fontWeight: '700',
    marginTop: 2,
    fontSize: 13,
  },
  cartItemUnitPrice: {
    color: POS_COLORS.muted,
    fontFamily: FONT_BODY,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    marginTop: 1,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartItemActionsMobile: {
    justifyContent: 'flex-end',
  },
  qtyButton: {
    backgroundColor: POS_COLORS.surfaceStrong,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonText: {
    color: POS_COLORS.primaryDark,
    fontSize: 16,
    fontWeight: '800',
  },
  qtyButtonAdd: {
    backgroundColor: POS_COLORS.primaryDark,
    borderColor: POS_COLORS.primaryDark,
  },
  qtyButtonTextAdd: {
    color: '#FFFFFF',
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
    marginLeft: 7,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderRadius: 9,
  },
  removeCartItemButtonText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  modalFooter: {
    minHeight: 86,
    paddingHorizontal: 26,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: POS_COLORS.line,
    backgroundColor: POS_COLORS.surfaceStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
  },
  modalFooterMobile: {
    minHeight: 0,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  modalTotalRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  modalTotalRowMobile: {
    flex: 0,
    width: '100%',
  },
  modalTotalLabel: {
    fontFamily: FONT_BODY,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: POS_COLORS.muted,
  },
  modalTotalHelper: {
    color: POS_COLORS.muted,
    fontFamily: FONT_BODY,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  modalTotalValue: {
    ...TYPOGRAPHY.h2,
    color: POS_COLORS.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  checkoutButton: {
    minWidth: 280,
    backgroundColor: POS_COLORS.primaryDark,
    borderRadius: 13,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    shadowColor: POS_COLORS.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  checkoutButtonMobile: {
    minWidth: 0,
    width: '100%',
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
    width: '100%',
  },
  modalFormContainerMobile: {
    marginTop: 8,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: POS_COLORS.line,
  },
  formSectionHeading: {
    marginBottom: 17,
  },
  formSectionEyebrow: {
    color: POS_COLORS.primary,
    fontFamily: FONT_BODY,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.25,
    marginBottom: 3,
  },
  formSectionTitle: {
    color: POS_COLORS.ink,
    fontFamily: FONT_BODY,
    fontWeight: '900',
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.35,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  formRowMobile: {
    flexDirection: 'column',
  },
  formHalfInputWrapper: {
    flex: 1,
  },
  formInputFull: {
    width: '100%',
    flex: 0,
  },
  formInputLabel: {
    ...TYPOGRAPHY.caption,
    color: POS_COLORS.muted,
    fontWeight: '800',
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  formInput: {
    ...TYPOGRAPHY.body,
    height: 44,
    backgroundColor: POS_COLORS.surface,
    borderColor: POS_COLORS.line,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    color: POS_COLORS.ink,
    fontSize: 14,
  },
  rucLookupSection: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    backgroundColor: '#FBFCFB',
  },
  rucInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  rucInputShell: {
    flex: 1,
    minWidth: 0,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  rucInputShellSuccess: {
    borderColor: '#8DB79B',
  },
  rucInputShellError: {
    borderColor: '#D99BA1',
  },
  rucInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    paddingHorizontal: 12,
    color: POS_COLORS.ink,
    fontFamily: FONT_BODY,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.25,
  },
  rucInlineClear: {
    width: 34,
    height: 34,
    marginRight: 5,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: POS_COLORS.surface,
  },
  rucInlineClearText: {
    color: POS_COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  rucSearchButton: {
    height: 46,
    minWidth: 88,
    paddingHorizontal: 14,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: POS_COLORS.primaryDark,
  },
  rucSearchButtonDisabled: {
    opacity: 0.72,
  },
  rucSearchButtonText: {
    color: '#FFFFFF',
    fontFamily: FONT_BODY,
    fontSize: 11,
    fontWeight: '800',
  },
  rucHelperText: {
    color: POS_COLORS.muted,
    fontFamily: FONT_BODY,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '600',
    marginTop: 7,
  },
  rucErrorText: {
    flex: 1,
    color: '#A52B35',
    fontFamily: FONT_BODY,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  rucErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F2C4C8',
    backgroundColor: '#FFF1F2',
  },
  rucErrorAction: {
    color: '#A52B35',
    fontFamily: FONT_BODY,
    fontSize: 10,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
  rucResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 9,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#C7DDCE',
    backgroundColor: '#F0F7F2',
  },
  rucResultCardWarning: {
    borderColor: '#E7CE92',
    backgroundColor: '#FFF8E8',
  },
  rucResultStatusIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: POS_COLORS.primary,
  },
  rucResultStatusIconWarning: {
    backgroundColor: '#A66A16',
  },
  rucResultStatusIconText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  rucResultCopy: {
    flex: 1,
  },
  rucResultEyebrow: {
    color: POS_COLORS.primary,
    fontFamily: FONT_BODY,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  rucResultName: {
    color: POS_COLORS.ink,
    fontFamily: FONT_BODY,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  rucResultMeta: {
    color: POS_COLORS.muted,
    fontFamily: FONT_BODY,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  rucChangeButton: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7DDCE',
    backgroundColor: '#FFFFFF',
  },
  rucChangeButtonText: {
    color: POS_COLORS.primaryDark,
    fontFamily: FONT_BODY,
    fontSize: 9,
    fontWeight: '900',
  },
  conditionSection: {
    marginBottom: 13,
  },
  notesInput: {
    height: 74,
    paddingTop: 11,
    textAlignVertical: 'top',
  },
  paymentSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 13,
    gap: 5,
  },
  paymentOption: {
    flex: 1,
    height: 40,
    backgroundColor: POS_COLORS.surface,
    borderColor: POS_COLORS.line,
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentOptionSelected: {
    backgroundColor: POS_COLORS.primaryDark,
    borderColor: POS_COLORS.primaryDark,
  },
  paymentOptionText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '600',
    color: POS_COLORS.muted,
  },
  paymentOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  condicionBadge: {
    flex: 1,
    height: 38,
    backgroundColor: POS_COLORS.surface,
    borderColor: POS_COLORS.line,
    borderWidth: 1,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  condicionBadgeActive: {
    backgroundColor: POS_COLORS.primaryDark,
    borderColor: POS_COLORS.primaryDark,
  },
  condicionBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '600',
    color: POS_COLORS.muted,
  },
  condicionBadgeTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 6,
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

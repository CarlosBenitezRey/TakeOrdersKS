import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { supabase } from '../services/supabase';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../theme/theme';
import { getProductImage, APP_ICONS, getCategoryIcon } from '../theme/assets';

// Format a number with thousands separator
const formatPrice = (value) =>
  value.toLocaleString('es-AR');

// Helper function to get a category tab emoji (kept simple for the tab bar)
const getEmojiForCategory = (name) => {
  const normalized = name.toLowerCase();
  if (normalized.includes('todos')) return '🍽️';
  if (normalized.includes('lomito')) return '🥪';
  if (normalized.includes('hamburguesa') || normalized.includes('burger')) return '🍔';
  if (normalized.includes('pizza')) return '🍕';
  if (normalized.includes('papas') || normalized.includes('fritas')) return '🍟';
  if (normalized.includes('bebida') || normalized.includes('refresco') || normalized.includes('gaseosa')) return '🥤';
  if (normalized.includes('extra')) return '✨';
  return '📋';
};

export default function CajeroScreen({ userProfile, onSwitchView }) {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  // Estados para Menú Lateral y Estadísticas
  // Estados para Menú Lateral y Estadísticas
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isStatsVisible, setIsStatsVisible] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [pedidoAEliminar, setPedidoAEliminar] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [selectedSucursalId, setSelectedSucursalId] = useState(userProfile?.sucursal_id || 'all');
  const [stats, setStats] = useState({
    totalVentas: 0,
    productosMasVendidos: [],
    metodosPago: { efectivo: 0, tarjeta: 0, transferencia: 0, pendiente: 0 },
    transacciones: []
  });

  // Detalles de pedido y estadísticas de venta
  const [mesa, setMesa] = useState('');
  const [cliente, setCliente] = useState('');
  const [notas, setNotas] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error al cerrar sesión:', error.message);
      showStatus('Error al cerrar sesión', 'error');
    }
  };

  const cargarEstadisticas = async (sucursalIdParam) => {
    try {
      setLoadingStats(true);
      const unMesAtras = new Date();
      unMesAtras.setDate(unMesAtras.getDate() - 30);
      const isoString = unMesAtras.toISOString();

      const targetSucursal = sucursalIdParam !== undefined ? sucursalIdParam : selectedSucursalId;

      let query = supabase
        .from('pedidos')
        .select(`
          *,
          detalle_pedido (
            cantidad,
            precio,
            producto_id,
            productos (
              nombre
            )
          )
        `)
        .gte('created_at', isoString);

      // Lock filter to userProfile.sucursal_id if it's set
      if (userProfile?.sucursal_id) {
        query = query.eq('sucursal_id', userProfile.sucursal_id);
      } else if (targetSucursal && targetSucursal !== 'all') {
        query = query.eq('sucursal_id', targetSucursal);
      }

      const { data: pedidosMes, error: pedidosError } = await query
        .order('created_at', { ascending: false });

      if (pedidosError) throw pedidosError;

      const items = pedidosMes || [];

      // 1. Total Ventas
      const totalVentas = items.reduce((sum, p) => sum + (p.total || 0), 0);

      // 2. Métodos de Pago
      const metodosPago = { efectivo: 0, tarjeta: 0, transferencia: 0, pendiente: 0 };
      items.forEach((p) => {
        const met = p.metodo_pago ? p.metodo_pago.toLowerCase() : 'efectivo';
        if (metodosPago[met] !== undefined) {
          metodosPago[met] += p.total || 0;
        }
      });

      // 3. Productos más vendidos
      const prodCounts = {};
      items.forEach((p) => {
        if (p.detalle_pedido) {
          p.detalle_pedido.forEach((d) => {
            const nombreProd = d.productos?.nombre || 'Producto Desconocido';
            prodCounts[nombreProd] = (prodCounts[nombreProd] || 0) + (d.cantidad || 0);
          });
        }
      });

      const productosMasVendidos = Object.keys(prodCounts)
        .map((name) => ({ nombre: name, cantidad: prodCounts[name] }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5);

      setStats({
        totalVentas,
        productosMasVendidos,
        metodosPago,
        transacciones: items
      });

    } catch (error) {
      console.error('Error cargando estadísticas:', error.message);
      showStatus('Error al cargar estadísticas', 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  const handleEliminarPedido = async (pedidoId) => {
    try {
      setLoadingStats(true);
      // Borrar detalle
      const { error: dError } = await supabase
        .from('detalle_pedido')
        .delete()
        .eq('pedido_id', pedidoId);

      if (dError) throw dError;

      // Borrar pedido
      const { error: pError } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', pedidoId);

      if (pError) throw pError;

      showStatus('Pedido eliminado con éxito', 'success');
      setPedidoAEliminar(null);
      cargarEstadisticas();
      cargarDatos();
    } catch (error) {
      console.error('Error eliminando pedido:', error.message);
      showStatus('Error al eliminar el pedido', 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  const esAdmin = userProfile?.rol === 'admin' || userProfile?.nombre === 'carlosrubenrey';

  const getSucursalName = (sucId) => {
    if (!sucId) return 'Global';
    const found = sucursales.find(s => s.id === sucId);
    return found ? found.nombre : 'Desconocido';
  };


  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      // Fetch products, categories, and sucursales in parallel
      const [prodRes, catRes, sucRes] = await Promise.all([
        supabase.from('productos').select('*'),
        supabase.from('categorias').select('*'),
        Promise.resolve(supabase.from('sucursales').select('*')).catch(err => ({ data: [], error: err }))
      ]);

      if (prodRes.error) throw prodRes.error;
      if (catRes.error) throw catRes.error;

      setProductos(prodRes.data || []);
      setSucursales(sucRes?.data || []);

      // Inject a default "Todos" category at the beginning of the list
      setCategorias([
        { id: 'all', nombre: 'Todos' },
        ...(catRes.data || [])
      ]);
    } catch (error) {
      console.error('Error cargando datos:', error.message);
      showStatus('Error al conectar con Supabase', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showStatus = (text, type = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage({ text: '', type: '' });
    }, 3000);
  };

  // Add a product to the cart
  const agregarProducto = (producto) => {
    setCarrito((prevCarrito) => {
      const existente = prevCarrito.find((item) => item.producto.id === producto.id);
      if (existente) {
        return prevCarrito.map((item) =>
          item.producto.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      } else {
        return [...prevCarrito, { producto, cantidad: 1 }];
      }
    });
  };

  // Decrease quantity or remove product from the cart
  const disminuirProducto = (producto) => {
    setCarrito((prevCarrito) => {
      const existente = prevCarrito.find((item) => item.producto.id === producto.id);
      if (!existente) return prevCarrito;

      if (existente.cantidad > 1) {
        return prevCarrito.map((item) =>
          item.producto.id === producto.id
            ? { ...item, cantidad: item.cantidad - 1 }
            : item
        );
      } else {
        return prevCarrito.filter((item) => item.producto.id !== producto.id);
      }
    });
  };

  // Completely remove product from the cart
  const eliminarProducto = (productoId) => {
    setCarrito((prevCarrito) => prevCarrito.filter((item) => item.producto.id !== productoId));
  };

  // Save the entire order to Supabase
  const guardarPedido = async () => {
    if (carrito.length === 0) return;

    try {
      setSavingOrder(true);

      // Verificar si el perfil del usuario existe en la tabla 'usuarios'
      // para evitar violar la FK pedidos_usuario_id_fkey
      let usuarioIdValido = null;
      if (userProfile?.id) {
        const { data: perfilCheck } = await supabase
          .from('usuarios')
          .select('id')
          .eq('id', userProfile.id)
          .single();
        usuarioIdValido = perfilCheck ? userProfile.id : null;
      }

      // 1. Insert order with advanced details and state 'pendiente' (required by Postgres check constraint)
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          estado: 'pendiente',
          mesa: mesa.trim() || null,
          cliente: cliente.trim() || null,
          notas: notas.trim() || null,
          total: totalPrecio,
          metodo_pago: metodoPago,
          usuario_id: usuarioIdValido,
          sucursal_id: userProfile?.sucursal_id || null,
        })
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      // 2. Prepare order details
      const detalles = carrito.map((item) => ({
        pedido_id: pedido.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio: item.producto.precio,
      }));

      // 3. Insert order details
      const { error: detallesError } = await supabase
        .from('detalle_pedido')
        .insert(detalles);

      if (detallesError) throw detallesError;

      // 4. Success cleanup & reset form
      setCarrito([]);
      setMesa('');
      setCliente('');
      setNotas('');
      setMetodoPago('efectivo');
      setIsCartVisible(false);
      showStatus('¡Pedido enviado con éxito!', 'success');
    } catch (error) {
      console.error('Error guardando pedido:', error.message);
      showStatus('Error al registrar el pedido', 'error');
    } finally {
      setSavingOrder(false);
    }
  };

  // Calculate order metrics
  const totalCantidad = carrito.reduce((sum, item) => sum + item.cantidad, 0);
  const totalPrecio = carrito.reduce((sum, item) => sum + item.producto.precio * item.cantidad, 0);

  // Filter products by search query AND category
  const productosFiltrados = productos.filter((producto) => {
    const matchesSearch = producto.nombre.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategoryId === 'all' || producto.categoria_id === selectedCategoryId;
    return matchesSearch && matchesCategory;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>El Carro</Text>
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
            onPress={() => setIsDrawerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.menuButtonText}>☰ Menú</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar platos o bebidas..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity style={styles.clearSearch} onPress={() => setSearchQuery('')}>
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* BANNER STATUS MESSAGE */}
      {statusMessage.text !== '' && (
        <View
          style={[
            styles.statusBanner,
            statusMessage.type === 'error' ? styles.statusBannerError : styles.statusBannerSuccess,
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
          data={productosFiltrados}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.rowWrapper}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery !== ''
                  ? 'No se encontraron productos'
                  : 'No hay productos en esta categoría'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.productCard}
              activeOpacity={0.8}
              onPress={() => agregarProducto(item)}
            >
              <Image
                source={getProductImage(item.nombre)}
                style={styles.productImage}
                resizeMode="cover"
              />
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.nombre}
                </Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.productPrice}>Gs. {formatPrice(item.precio)}</Text>
                  <View style={styles.addButton}>
                    <Text style={styles.addButtonText}>+</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* FLOATING CART BUTTON */}
      {carrito.length > 0 && (
        <View style={styles.floatingCartContainer}>
          <TouchableOpacity
            style={styles.floatingCartButton}
            activeOpacity={0.9}
            onPress={() => setIsCartVisible(true)}
          >
            <View style={styles.cartItemsCountBadge}>
              <Text style={styles.cartItemsCountText}>{totalCantidad}</Text>
            </View>
            <Text style={styles.floatingCartText}>Ver Pedido</Text>
            <Text style={styles.floatingCartTotal}>Gs. {formatPrice(totalPrecio)}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CATEGORY BOTTOM BAR */}
      <View style={styles.bottomTabBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categorias}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.bottomTabList}
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
                  style={styles.bottomTabIcon}
                  resizeMode="contain"
                />
                <Text
                  style={[
                    styles.bottomTabText,
                    isSelected && styles.bottomTabTextSelected,
                  ]}
                >
                  {item.nombre}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* CART MODAL (DETALLE DE PEDIDO) */}
      <Modal
        visible={isCartVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCartVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pedido Actual</Text>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setIsCartVisible(false)}
              >
                <Text style={styles.closeModalButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Body: Cart Items List */}
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
                      <Text style={styles.cartItemName}>{item.producto.nombre}</Text>
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
                  <Text style={styles.formSectionTitle}>Información del Pedido</Text>

                  {/* Mesa and Cliente */}
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
                      <Text style={styles.formInputLabel}>Cliente (Opcional)</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Ej. Juan Pérez"
                        placeholderTextColor={COLORS.textMuted}
                        value={cliente}
                        onChangeText={setCliente}
                      />
                    </View>
                  </View>

                  {/* Método de Pago */}
                  <Text style={styles.formInputLabel}>Método de Pago (Estadísticas)</Text>
                  <View style={styles.paymentSelector}>
                    <TouchableOpacity
                      style={[
                        styles.paymentOption,
                        metodoPago === 'efectivo' && styles.paymentOptionSelected,
                      ]}
                      onPress={() => setMetodoPago('efectivo')}
                    >
                      <Text style={[styles.paymentOptionText, metodoPago === 'efectivo' && styles.paymentOptionTextSelected]}>
                        Efectivo
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.paymentOption,
                        metodoPago === 'tarjeta' && styles.paymentOptionSelected,
                      ]}
                      onPress={() => setMetodoPago('tarjeta')}
                    >
                      <Text style={[styles.paymentOptionText, metodoPago === 'tarjeta' && styles.paymentOptionTextSelected]}>
                        Tarjeta
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.paymentOption,
                        metodoPago === 'transferencia' && styles.paymentOptionSelected,
                      ]}
                      onPress={() => setMetodoPago('transferencia')}
                    >
                      <Text style={[styles.paymentOptionText, metodoPago === 'transferencia' && styles.paymentOptionTextSelected]}>
                        Transfer
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.paymentOption,
                        metodoPago === 'pendiente' && styles.paymentOptionSelected,
                      ]}
                      onPress={() => setMetodoPago('pendiente')}
                    >
                      <Text style={[styles.paymentOptionText, metodoPago === 'pendiente' && styles.paymentOptionTextSelected]}>
                        Deber
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Notas de Cocina */}
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

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <View style={styles.modalTotalRow}>
                <Text style={styles.modalTotalLabel}>Total a pagar:</Text>
                <Text style={styles.modalTotalValue}>Gs. {formatPrice(totalPrecio)}</Text>
              </View>

              <TouchableOpacity
                style={[styles.checkoutButton, savingOrder && styles.checkoutButtonDisabled]}
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
          </View>
        </View>
      </Modal>

      {/* DRAWER MODAL — MENU DESPLEGABLE LATERAL */}
      <Modal
        visible={isDrawerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsDrawerVisible(false)}
      >
        <TouchableOpacity
          style={styles.drawerOverlay}
          activeOpacity={1}
          onPress={() => setIsDrawerVisible(false)}
        >
          <TouchableOpacity
            style={styles.drawerContainer}
            activeOpacity={1}
          >
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Menú</Text>
              <TouchableOpacity onPress={() => setIsDrawerVisible(false)} style={styles.drawerCloseButton}>
                <Text style={styles.drawerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.drawerProfileSection}>
              <Image
                source={esAdmin ? APP_ICONS.admin : APP_ICONS.userDefault}
                style={styles.drawerProfileIconImage}
                resizeMode="contain"
              />
              <Text style={styles.drawerProfileName}>{userProfile?.nombre || 'Invitado'}</Text>
              <Text style={styles.drawerProfileRole}>{userProfile?.rol?.toUpperCase() || 'CAJERO'}</Text>
            </View>

            <View style={styles.drawerDivider} />

            <View style={styles.drawerMenuOptions}>
              {onSwitchView && (
                <TouchableOpacity
                  style={styles.drawerOption}
                  onPress={() => {
                    setIsDrawerVisible(false);
                    onSwitchView();
                  }}
                >
                  <Image
                    source={APP_ICONS.kitchen}
                    style={styles.drawerOptionIconImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.drawerOptionText}>Ir a Cocina</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.drawerOption}
                onPress={() => {
                  setIsDrawerVisible(false);
                  cargarDatos();
                }}
              >
                <Image
                  source={APP_ICONS.reload}
                  style={styles.drawerOptionIconImage}
                  resizeMode="contain"
                />
                <Text style={styles.drawerOptionText}>Recargar Datos</Text>
              </TouchableOpacity>

              {esAdmin && (
                <TouchableOpacity
                  style={styles.drawerOption}
                  onPress={() => {
                    setIsDrawerVisible(false);
                    setIsStatsVisible(true);
                    cargarEstadisticas();
                  }}
                >
                  <Image
                    source={APP_ICONS.statistics}
                    style={styles.drawerOptionIconImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.drawerOptionText}>Estadísticas (Admin)</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.drawerOption, styles.drawerOptionLogout]}
                onPress={() => {
                  setIsDrawerVisible(false);
                  handleLogout();
                }}
              >
                <Image
                  source={APP_ICONS.logout}
                  style={[styles.drawerOptionIconImage, { tintColor: COLORS.danger }]}
                  resizeMode="contain"
                />
                <Text style={[styles.drawerOptionText, { color: COLORS.danger }]}>Cerrar Sesión</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.drawerFooter}>
              <Text style={styles.drawerVersionText}>El Carro v1.2</Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* STATS MODAL — ESTADISTICAS ADMIN */}
      <Modal
        visible={isStatsVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsStatsVisible(false)}
      >
        <SafeAreaView style={styles.statsScreenContainer}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsHeaderTitle}>Estadísticas</Text>
            <TouchableOpacity
              style={styles.statsCloseButton}
              onPress={() => setIsStatsVisible(false)}
            >
              <Text style={styles.statsCloseButtonText}>✕ Cerrar</Text>
            </TouchableOpacity>
          </View>

          {loadingStats ? (
            <View style={styles.statsLoader}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.statsLoaderText}>Calculando ventas e inventario...</Text>
            </View>
          ) : (
            <ScrollView style={styles.statsContentContainer} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* RANGO DE FECHA */}
              <View style={styles.statsDateRangeCard}>
                <Text style={styles.statsDateRangeLabel}>Periodo Auditado:</Text>
                <Text style={styles.statsDateRangeValue}>Últimos 30 días</Text>
              </View>

              {/* SELECTOR DE SUCURSAL (Solo para Administrador General) */}
              {!userProfile?.sucursal_id && sucursales.length > 0 && (
                <View style={styles.sucursalFilterCard}>
                  <Text style={styles.sucursalFilterLabel}>Filtrar por Local:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sucursalFilterList}>
                    <TouchableOpacity
                      style={[
                        styles.sucursalFilterButton,
                        selectedSucursalId === 'all' && styles.sucursalFilterButtonSelected,
                      ]}
                      onPress={() => {
                        setSelectedSucursalId('all');
                        cargarEstadisticas('all');
                      }}
                    >
                      <Text
                        style={[
                          styles.sucursalFilterButtonText,
                          selectedSucursalId === 'all' && styles.sucursalFilterButtonTextSelected,
                        ]}
                      >
                        Todas
                      </Text>
                    </TouchableOpacity>
                    {sucursales.map((suc) => (
                      <TouchableOpacity
                        key={suc.id}
                        style={[
                          styles.sucursalFilterButton,
                          selectedSucursalId === suc.id && styles.sucursalFilterButtonSelected,
                        ]}
                        onPress={() => {
                          setSelectedSucursalId(suc.id);
                          cargarEstadisticas(suc.id);
                        }}
                      >
                        <Text
                          style={[
                            styles.sucursalFilterButtonText,
                            selectedSucursalId === suc.id && styles.sucursalFilterButtonTextSelected,
                          ]}
                        >
                          {suc.nombre}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* KPI CARD: Ingresos totales */}
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>INGRESOS TOTALES</Text>
                <Text style={styles.kpiValue}>Gs. {formatPrice(stats.totalVentas)}</Text>
                <Text style={styles.kpiSub}>Último mes acumulado</Text>
              </View>

              {/* METODOS DE PAGO */}
              <View style={styles.statsSectionCard}>
                <Text style={styles.statsSectionTitle}>Métodos de Pago</Text>
                <View style={styles.paymentProgressContainer}>
                  {Object.keys(stats.metodosPago).map((metodo) => {
                    const monto = stats.metodosPago[metodo] || 0;
                    const porcentaje = stats.totalVentas > 0 ? (monto / stats.totalVentas) * 100 : 0;
                    return (
                      <View key={metodo} style={styles.paymentProgressItem}>
                        <View style={styles.paymentProgressHeader}>
                          <Text style={styles.paymentProgressLabel}>{metodo.charAt(0).toUpperCase() + metodo.slice(1)}</Text>
                          <Text style={styles.paymentProgressValue}>Gs. {formatPrice(monto)} ({porcentaje.toFixed(0)}%)</Text>
                        </View>
                        <View style={styles.progressBarBg}>
                          <View style={[styles.progressBarFill, { width: `${porcentaje}%` }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* PRODUCTOS MAS VENDIDOS */}
              <View style={styles.statsSectionCard}>
                <Text style={styles.statsSectionTitle}>Top 5 Productos Más Vendidos</Text>
                {stats.productosMasVendidos.length === 0 ? (
                  <Text style={styles.noDataText}>No hay datos registrados aún.</Text>
                ) : (
                  stats.productosMasVendidos.map((prod, index) => (
                    <View key={index} style={styles.topProductRow}>
                      <Text style={styles.topProductIndex}>#{index + 1}</Text>
                      <Text style={styles.topProductName}>{prod.nombre}</Text>
                      <Text style={styles.topProductQty}>{prod.cantidad} u.</Text>
                    </View>
                  ))
                )}
              </View>

              {/* HISTORIAL DE MOVIMIENTOS */}
              <View style={styles.statsSectionCard}>
                <Text style={styles.statsSectionTitle}>Historial de Movimientos</Text>
                <Text style={styles.statsSectionSubTitle}>Toca el botón rojo para borrar un registro erróneo</Text>

                {stats.transacciones.length === 0 ? (
                  <Text style={styles.noDataText}>No hay transacciones este mes.</Text>
                ) : (
                  stats.transacciones.map((pedido) => (
                    <View key={pedido.id} style={styles.transactionCard}>
                      <View style={styles.transactionMainInfo}>
                        <Text style={styles.transactionId}>Pedido #{pedido.id.toString().slice(0, 8).toUpperCase()}</Text>
                        <Text style={styles.transactionDate}>
                          {new Date(pedido.created_at).toLocaleDateString()} - {new Date(pedido.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={styles.transactionDetails}>
                          {pedido.mesa ? `Mesa: ${pedido.mesa}` : ''} {pedido.cliente ? ` | Cliente: ${pedido.cliente}` : ''}
                        </Text>
                        <Text style={styles.transactionPayType}>
                          Pago: {pedido.metodo_pago?.toUpperCase()} {!userProfile?.sucursal_id && ` | Local: ${getSucursalName(pedido.sucursal_id)}`}
                        </Text>
                      </View>
                      <View style={styles.transactionRightInfo}>
                        <Text style={styles.transactionTotal}>Gs. {formatPrice(pedido.total || 0)}</Text>

                        <TouchableOpacity
                          style={styles.deleteTransactionButton}
                          onPress={() => setPedidoAEliminar(pedido.id)}
                        >
                          <Text style={styles.deleteTransactionText}>🗑️ Borrar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
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
              Esta acción es permanente. Se descontará del historial de ventas de este mes y desaparecerá de la cocina.
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
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
    color: COLORS.text,
    opacity: 0.85,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
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
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
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
    padding: SPACING.md,
    paddingBottom: 170,
  },
  rowWrapper: {
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  productCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    width: '48%',
  },
  productImage: {
    width: '100%',
    height: 120,
    backgroundColor: COLORS.cardElevated,
  },
  productInfo: {
    width: '100%',
    padding: SPACING.sm,
  },
  productName: {
    ...TYPOGRAPHY.body,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  productPrice: {
    ...TYPOGRAPHY.body,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: BORDER_RADIUS.round,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: 16,
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
    bottom: 95,
    left: SPACING.md,
    right: SPACING.md,
  },
  floatingCartButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    // Android Shadow
    elevation: 8,
    // iOS Shadow
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
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: 80,
    justifyContent: 'center',
    paddingBottom: Platform.OS === 'ios' ? 15 : 0,
  },
  bottomTabList: {
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  bottomTabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginHorizontal: 5,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 85,
    height: 60,
  },
  bottomTabButtonSelected: {
    backgroundColor: 'rgba(230, 95, 43, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  bottomTabIcon: {
    width: 30,
    height: 30,
    marginBottom: 4,
  },
  bottomTabText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  bottomTabTextSelected: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    ...TYPOGRAPHY.h2,
  },
  closeModalButton: {
    padding: SPACING.xs,
  },
  closeModalButtonText: {
    color: COLORS.textMuted,
    fontSize: 20,
    fontWeight: '600',
  },
  modalListContent: {
    padding: SPACING.md,
  },
  cartItemCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cartItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cartItemImage: {
    width: 42,
    height: 42,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.cardElevated,
  },
  cartItemNameContainer: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  cartItemName: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
  },
  cartItemPrice: {
    ...TYPOGRAPHY.caption,
    color: COLORS.secondary,
    marginTop: 2,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyButton: {
    backgroundColor: COLORS.cardElevated,
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
  qtyText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: SPACING.md,
    minWidth: 16,
    textAlign: 'center',
  },
  removeCartItemButton: {
    marginLeft: SPACING.md,
    padding: SPACING.xs,
  },
  modalFooter: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTotalLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  modalTotalValue: {
    ...TYPOGRAPHY.h2,
    color: COLORS.secondary,
    fontSize: 24,
  },
  checkoutButton: {
    backgroundColor: COLORS.success,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
  },
  checkoutButtonDisabled: {
    opacity: 0.6,
  },
  checkoutButtonText: {
    ...TYPOGRAPHY.button,
    fontSize: 18,
  },
  modalFormContainer: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  formSectionTitle: {
    ...TYPOGRAPHY.h3,
    marginBottom: SPACING.md,
    color: COLORS.primary,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  formHalfInputWrapper: {
    width: '48%',
  },
  formInputLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 6,
  },
  formInput: {
    height: 44,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    color: COLORS.text,
    ...TYPOGRAPHY.body,
  },
  notesInput: {
    height: 60,
    paddingTop: SPACING.sm,
    textAlignVertical: 'top',
  },
  paymentSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  paymentOption: {
    flex: 1,
    height: 40,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  paymentOptionSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: COLORS.success,
  },
  paymentOptionText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  paymentOptionTextSelected: {
    color: COLORS.success,
    fontWeight: '800',
  },

  // Estilos para el menú en cabecera
  menuButton: {
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
  },
  menuButtonText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },

  // Estilos para el Drawer Modal (Menú lateral)
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  drawerContainer: {
    width: '75%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    justifyContent: 'space-between',
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  drawerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.primary,
  },
  drawerCloseButton: {
    padding: SPACING.xs,
  },
  drawerCloseText: {
    color: COLORS.textMuted,
    fontSize: 20,
    fontWeight: '700',
  },
  drawerProfileSection: {
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  drawerProfileIconImage: {
    width: 64,
    height: 64,
    marginBottom: SPACING.xs,
  },
  drawerProfileName: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.text,
  },
  drawerProfileRole: {
    ...TYPOGRAPHY.caption,
    color: COLORS.secondary,
    fontWeight: '700',
    marginTop: 2,
  },
  drawerDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  drawerMenuOptions: {
    flex: 1,
    marginTop: SPACING.md,
  },
  drawerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  drawerOptionLogout: {
    borderBottomWidth: 0,
    marginTop: SPACING.xl,
  },
  drawerOptionIconImage: {
    width: 26,
    height: 26,
    marginRight: SPACING.md,
  },
  drawerOptionText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
  },
  drawerFooter: {
    alignItems: 'center',
    paddingTop: SPACING.md,
  },
  drawerVersionText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },

  // Estilos para el Modal de Estadísticas
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
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  statsHeaderTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.primary,
  },
  statsCloseButton: {
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.cardElevated,
    borderRadius: BORDER_RADIUS.md,
  },
  statsCloseButtonText: {
    color: COLORS.text,
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
  },
  statsContentContainer: {
    flex: 1,
    padding: SPACING.md,
  },
  statsDateRangeCard: {
    backgroundColor: 'rgba(230, 95, 43, 0.1)',
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
    color: COLORS.textMuted,
  },
  statsDateRangeValue: {
    ...TYPOGRAPHY.body,
    fontWeight: '800',
    color: COLORS.primary,
  },
  kpiCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  kpiLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  kpiValue: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.secondary,
    marginVertical: SPACING.xs,
  },
  kpiSub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.success,
    fontWeight: '600',
  },
  statsSectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statsSectionTitle: {
    ...TYPOGRAPHY.h3,
    marginBottom: SPACING.sm,
    color: COLORS.text,
  },
  statsSectionSubTitle: {
    ...TYPOGRAPHY.caption,
    marginBottom: SPACING.md,
    color: COLORS.textMuted,
  },
  noDataText: {
    ...TYPOGRAPHY.bodyMuted,
    textAlign: 'center',
    paddingVertical: SPACING.md,
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
  },
  paymentProgressValue: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: COLORS.background,
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
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  topProductIndex: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.secondary,
    marginRight: SPACING.md,
    width: 24,
  },
  topProductName: {
    flex: 1,
    ...TYPOGRAPHY.body,
    fontWeight: '700',
  },
  topProductQty: {
    ...TYPOGRAPHY.body,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  transactionCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.text,
  },
  transactionDate: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginVertical: 2,
  },
  transactionDetails: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
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

  // Modal Confirmación Eliminar
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  confirmBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  confirmEmoji: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  confirmTitle: {
    ...TYPOGRAPHY.h2,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  confirmText: {
    ...TYPOGRAPHY.bodyMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 20,
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
    backgroundColor: COLORS.cardElevated,
  },
  confirmBtnCancelText: {
    color: COLORS.text,
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
});

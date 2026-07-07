import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
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
import { getProductImage } from '../theme/assets';

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

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error al cerrar sesión:', error.message);
      showStatus('Error al cerrar sesión', 'error');
    }
  };
  const [categorias, setCategorias] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' }); // type: 'success' | 'error'

  // Detalles de pedido y estadísticas de venta
  const [mesa, setMesa] = useState('');
  const [cliente, setCliente] = useState('');
  const [notas, setNotas] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      // Fetch products and categories in parallel for efficiency
      const [prodRes, catRes] = await Promise.all([
        supabase.from('productos').select('*'),
        supabase.from('categorias').select('*'),
      ]);

      if (prodRes.error) throw prodRes.error;
      if (catRes.error) throw catRes.error;

      setProductos(prodRes.data || []);
      
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
          usuario_id: userProfile?.id || null,
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
        <View>
          <Text style={styles.headerTitle}>El Carro 🚗</Text>
          <Text style={styles.headerSubtitle}>Cajero: {userProfile?.nombre || 'Invitado'}</Text>
        </View>
        <View style={styles.headerActions}>
          {onSwitchView && (
            <TouchableOpacity style={styles.headerActionButton} onPress={onSwitchView} activeOpacity={0.7}>
              <Text style={styles.headerActionText}>Cocina 🧑‍🍳</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerActionButton} onPress={cargarDatos} activeOpacity={0.7}>
            <Text style={styles.headerActionText}>🔄</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.headerActionButton, styles.logoutButton]} 
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutButtonText}>Salir</Text>
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
                source={{ uri: getProductImage(item.nombre) }}
                style={styles.productImage}
                resizeMode="cover"
              />
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.nombre}
                </Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.productPrice}>${item.precio}</Text>
                  <View style={styles.addButton}>
                    <Text style={styles.addButtonText}>+</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* BOTTOM FLOATING CART SUMMARY (Positioned above the category bottom bar) */}
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
            <Text style={styles.floatingCartTotal}>${totalPrecio}</Text>
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
                <Text style={styles.bottomTabEmoji}>
                  {getEmojiForCategory(item.nombre)}
                </Text>
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
              <Text style={styles.modalTitle}>Pedido Actual 🛒</Text>
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
                      source={{ uri: getProductImage(item.producto.nombre) }}
                      style={styles.cartItemImage}
                      resizeMode="cover"
                    />
                    <View style={styles.cartItemNameContainer}>
                      <Text style={styles.cartItemName}>{item.producto.nombre}</Text>
                      <Text style={styles.cartItemPrice}>
                        ${item.producto.precio} c/u
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
                      <Text style={styles.removeCartItemButtonText}>🗑️</Text>
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
                        💵 Efectivo
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
                        💳 Tarjeta
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
                        📱 Transfer
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
                        ⏳ Deber
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
                <Text style={styles.modalTotalValue}>${totalPrecio}</Text>
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
  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.primary,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
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
    paddingBottom: 170, // Increased bottom padding to avoid overlapping with bottom bar AND floating cart button
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
    bottom: 95, // Floats exactly above the bottom categories tab bar (height ~75)
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
    paddingBottom: Platform.OS === 'ios' ? 15 : 0, // safe area padding on iOS
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
  bottomTabEmoji: {
    fontSize: 20,
    marginBottom: 2,
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
});

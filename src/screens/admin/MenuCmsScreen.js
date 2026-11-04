import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Platform,
  StatusBar,
  Image,
  Switch,
} from 'react-native';
import productService from '../../services/ProductService';
import {
  COLORS,
  POS_COLORS,
  SPACING,
  BORDER_RADIUS,
  TYPOGRAPHY,
} from '../../theme/theme';
import { getProductImage, FOOD_PRESET_IMAGES, getCategoryIcon } from '../../theme/assets';
import { PRODUCT_CONFIG } from '../../config/productConfig';

const formatPrice = (value) => Number(value || 0).toLocaleString('es-AR');

export default function MenuCmsScreen({ userProfile, onClose }) {
  // ─── Estado de datos ────────────────────────────────────────────────────────
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  // ─── Pestañas y Filtros ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('platos'); // 'platos' | 'categorias'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoriaId, setSelectedCategoriaId] = useState('all');

  // ─── Modal Formulario de Plato (Crear / Editar) ─────────────────────────────
  const [isModalPlatoVisible, setIsModalPlatoVisible] = useState(false);
  const [savingPlato, setSavingPlato] = useState(false);
  const [platoEditandoId, setPlatoEditandoId] = useState(null); // null = nuevo
  const [formPlato, setFormPlato] = useState({
    nombre: '',
    precio: '',
    categoria_id: '',
    descripcion: '',
    imagen_url: '',
    disponible: true,
  });
  const [mostrarGaleriaPresets, setMostrarGaleriaPresets] = useState(false);

  // ─── Modal Rápido de Precio ─────────────────────────────────────────────────
  const [modalPrecioPlato, setModalPrecioPlato] = useState(null); // { id, nombre, precio }
  const [nuevoPrecioRapido, setNuevoPrecioRapido] = useState('');
  const [guardandoPrecioRapido, setGuardandoPrecioRapido] = useState(false);

  // ─── Modal Formulario de Categoría ──────────────────────────────────────────
  const [isModalCategoriaVisible, setIsModalCategoriaVisible] = useState(false);
  const [categoriaEditandoId, setCategoriaEditandoId] = useState(null);
  const [nombreCategoria, setNombreCategoria] = useState('');
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);

  // ─── Modal Confirmación de Eliminación ──────────────────────────────────────
  const [itemAEliminar, setItemAEliminar] = useState(null); // { tipo: 'plato'|'categoria', id, nombre }
  const [eliminandoItem, setEliminandoItem] = useState(false);

  // ─── Carga Inicial ──────────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const { productos, categorias } = await productService.cargarCatalogo();
      setProductos(productos);
      setCategorias(categorias);
    } catch (error) {
      console.error('Error cargando catálogo:', error);
      showStatus('Error al conectar con la base de datos', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const showStatus = (text, type = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage({ text: '', type: '' }), 3500);
  };

  // ─── Cálculos y Filtros ─────────────────────────────────────────────────────
  const kpis = productService.getKpisCatalogo(productos, categorias);
  const productosFiltrados = productService.filtrar(
    productos,
    searchQuery,
    selectedCategoriaId
  );
  const categoriasReales = categorias.filter((c) => c.id !== 'all');

  // ─── Handlers de Plato ──────────────────────────────────────────────────────
  const abrirModalNuevoPlato = () => {
    const primeraCat = categoriasReales[0]?.id || '';
    setPlatoEditandoId(null);
    setFormPlato({
      nombre: '',
      precio: '',
      categoria_id: primeraCat,
      descripcion: '',
      imagen_url: '',
      disponible: true,
    });
    setMostrarGaleriaPresets(false);
    setIsModalPlatoVisible(true);
  };

  const abrirModalEditarPlato = (plato) => {
    setPlatoEditandoId(plato.id);
    setFormPlato({
      nombre: plato.nombre || '',
      precio: String(plato.precio || ''),
      categoria_id: plato.categoria_id || categoriasReales[0]?.id || '',
      descripcion: plato.descripcion || '',
      imagen_url: plato.imagen_url || '',
      disponible: plato.disponible !== false,
    });
    setMostrarGaleriaPresets(false);
    setIsModalPlatoVisible(true);
  };

  const guardarPlato = async () => {
    try {
      setSavingPlato(true);
      if (platoEditandoId) {
        await productService.actualizarProducto(platoEditandoId, formPlato);
        showStatus('¡Plato actualizado con éxito!', 'success');
      } else {
        await productService.crearProducto(formPlato);
        showStatus('¡Nuevo plato agregado a la carta!', 'success');
      }
      setIsModalPlatoVisible(false);
      cargarDatos();
    } catch (error) {
      console.error('Error guardando plato:', error);
      showStatus(error.message || 'Error al guardar el plato', 'error');
    } finally {
      setSavingPlato(false);
    }
  };

  const handleToggleDisponibilidad = async (plato) => {
    const nuevoEstado = !(plato.disponible !== false);
    try {
      // Actualización optimista en la UI
      setProductos((prev) =>
        prev.map((p) => (p.id === plato.id ? { ...p, disponible: nuevoEstado } : p))
      );
      await productService.toggleDisponibilidad(plato.id, nuevoEstado);
      showStatus(
        nuevoEstado
          ? `"${plato.nombre}" ahora está Disponible para la venta`
          : `"${plato.nombre}" ha sido marcado como Pausado/Agotado`,
        'success'
      );
    } catch (error) {
      console.error('Error al cambiar disponibilidad:', error);
      showStatus('Error al actualizar disponibilidad', 'error');
      cargarDatos();
    }
  };

  // ─── Handlers de Cambio Rápido de Precio ─────────────────────────────────────
  const abrirModalPrecioRapido = (plato) => {
    setModalPrecioPlato(plato);
    setNuevoPrecioRapido(String(plato.precio || ''));
  };

  const guardarPrecioRapido = async () => {
    if (!modalPrecioPlato) return;
    try {
      setGuardandoPrecioRapido(true);
      await productService.actualizarPrecio(modalPrecioPlato.id, nuevoPrecioRapido);
      showStatus(`Precio de "${modalPrecioPlato.nombre}" actualizado a Gs. ${formatPrice(nuevoPrecioRapido)}`, 'success');
      setModalPrecioPlato(null);
      cargarDatos();
    } catch (error) {
      console.error('Error al actualizar precio:', error);
      showStatus(error.message || 'Error al actualizar precio', 'error');
    } finally {
      setGuardandoPrecioRapido(false);
    }
  };

  // ─── Handlers de Categoría ──────────────────────────────────────────────────
  const abrirModalNuevaCategoria = () => {
    setCategoriaEditandoId(null);
    setNombreCategoria('');
    setIsModalCategoriaVisible(true);
  };

  const abrirModalEditarCategoria = (cat) => {
    setCategoriaEditandoId(cat.id);
    setNombreCategoria(cat.nombre || '');
    setIsModalCategoriaVisible(true);
  };

  const guardarCategoria = async () => {
    try {
      setGuardandoCategoria(true);
      if (categoriaEditandoId) {
        await productService.actualizarCategoria(categoriaEditandoId, { nombre: nombreCategoria });
        showStatus('¡Categoría actualizada!', 'success');
      } else {
        await productService.crearCategoria({ nombre: nombreCategoria });
        showStatus('¡Categoría creada con éxito!', 'success');
      }
      setIsModalCategoriaVisible(false);
      cargarDatos();
    } catch (error) {
      console.error('Error guardando categoría:', error);
      showStatus(error.message || 'Error al guardar categoría', 'error');
    } finally {
      setGuardandoCategoria(false);
    }
  };

  // ─── Handlers de Eliminación ────────────────────────────────────────────────
  const confirmarEliminar = async () => {
    if (!itemAEliminar) return;
    try {
      setEliminandoItem(true);
      if (itemAEliminar.tipo === 'plato') {
        await productService.eliminarProducto(itemAEliminar.id);
        showStatus(`Plato "${itemAEliminar.nombre}" eliminado`, 'success');
      } else if (itemAEliminar.tipo === 'categoria') {
        await productService.eliminarCategoria(itemAEliminar.id, productos);
        showStatus(`Categoría "${itemAEliminar.nombre}" eliminada`, 'success');
      }
      setItemAEliminar(null);
      cargarDatos();
    } catch (error) {
      console.error('Error al eliminar:', error);
      showStatus(error.message || 'Error al eliminar el elemento', 'error');
    } finally {
      setEliminandoItem(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={PRODUCT_CONFIG.branding.primaryDark}
      />

      {/* ─── Encabezado Principal ────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.headerTitle}>Modificar Menú</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            Modificación de precios, fotos, disponibilidad y categorías
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.btnPrimaryAction}
            onPress={abrirModalNuevoPlato}
          >
            <Text style={styles.btnPrimaryActionText}>+ Nuevo Plato</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕ Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Banner de Estado ────────────────────────────────────────────────── */}
      {statusMessage.text !== '' && (
        <View
          style={[
            styles.statusBanner,
            statusMessage.type === 'error'
              ? styles.statusBannerError
              : styles.statusBannerSuccess,
          ]}
        >
          <Text style={styles.statusBannerText}>{statusMessage.text}</Text>
        </View>
      )}

      {/* ─── 4 KPIs del Catálogo ─────────────────────────────────────────────── */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>TOTAL PLATOS</Text>
          <Text style={[styles.kpiValue, { color: POS_COLORS.ink }]}>
            {kpis.totalPlatos}
          </Text>
          <Text style={styles.kpiSub}>En la carta</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>DISPONIBLES</Text>
          <Text style={[styles.kpiValue, { color: POS_COLORS.primary }]}>
            {kpis.disponibles}
          </Text>
          <Text style={styles.kpiSub}>
            {kpis.pausados > 0 ? `${kpis.pausados} pausados` : '100% activo'}
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>CATEGORÍAS</Text>
          <Text style={[styles.kpiValue, { color: POS_COLORS.primaryDark }]}>
            {kpis.totalCategorias}
          </Text>
          <Text style={styles.kpiSub}>Secciones</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>PRECIO PROMEDIO</Text>
          <Text style={[styles.kpiValue, { color: POS_COLORS.primary }]}>
            Gs. {formatPrice(kpis.precioPromedio)}
          </Text>
          <Text style={styles.kpiSub}>Por producto</Text>
        </View>
      </View>

      {/* ─── Selector de Pestañas ────────────────────────────────────────────── */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'platos' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('platos')}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'platos' && styles.tabButtonTextActive,
            ]}
          >
            Platos y Productos ({productos.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'categorias' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('categorias')}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'categorias' && styles.tabButtonTextActive,
            ]}
          >
            Categorías ({categoriasReales.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 1: PLATOS Y PRODUCTOS                                           */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'platos' && (
        <View style={{ flex: 1 }}>
          {/* Buscador */}
          <View style={styles.searchBarContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar plato por nombre o ingredientes..."
              placeholderTextColor={POS_COLORS.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity
                style={styles.clearSearchBtn}
                onPress={() => setSearchQuery('')}
              >
                <Text style={styles.clearSearchBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Filtro horizontal de categorías */}
          <View style={styles.categoriesFilterBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categorias.map((cat) => {
                const isSelected = selectedCategoriaId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryFilterChip,
                      isSelected && styles.categoryFilterChipActive,
                    ]}
                    onPress={() => setSelectedCategoriaId(cat.id)}
                  >
                    <Text
                      style={[
                        styles.categoryFilterChipText,
                        isSelected && styles.categoryFilterChipTextActive,
                      ]}
                    >
                      {cat.nombre}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={POS_COLORS.primary} />
              <Text style={styles.loadingText}>Cargando catálogo...</Text>
            </View>
          ) : (
            <FlatList
              data={productosFiltrados}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={{ fontSize: 40, marginBottom: 8 }}>🔍</Text>
                  <Text style={styles.emptyTitle}>No se encontraron platos</Text>
                  <Text style={styles.emptySub}>
                    Prueba con otro término de búsqueda o crea un nuevo plato.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isDisponible = item.disponible !== false;
                const nombreCat =
                  item.categorias?.nombre ||
                  categoriasReales.find((c) => c.id === item.categoria_id)?.nombre ||
                  'General';

                return (
                  <View
                    style={[
                      styles.platoCard,
                      !isDisponible && styles.platoCardPausado,
                    ]}
                  >
                    {/* Imagen y Badges */}
                    <View style={styles.platoImageWrapper}>
                      <Image
                        source={getProductImage(item.nombre, item.imagen_url)}
                        style={styles.platoImage}
                        resizeMode="cover"
                      />
                      <View
                        style={[
                          styles.disponibleBadge,
                          isDisponible
                            ? styles.disponibleBadgeActivo
                            : styles.disponibleBadgePausado,
                        ]}
                      >
                        <Text
                          style={[
                            styles.disponibleBadgeText,
                            isDisponible
                              ? styles.disponibleBadgeTextActivo
                              : styles.disponibleBadgeTextPausado,
                          ]}
                        >
                          {isDisponible ? '● DISPONIBLE' : '✕ AGOTADO'}
                        </Text>
                      </View>
                    </View>

                    {/* Info Central */}
                    <View style={styles.platoInfo}>
                      <View style={styles.platoHeaderRow}>
                        <Text style={styles.platoNombre} numberOfLines={1}>
                          {item.nombre}
                        </Text>
                        <View style={styles.categoriaTag}>
                          <Text style={styles.categoriaTagText}>{nombreCat}</Text>
                        </View>
                      </View>

                      {item.descripcion ? (
                        <Text style={styles.platoDescripcion} numberOfLines={2}>
                          {item.descripcion}
                        </Text>
                      ) : null}

                      {/* Precio Destacado */}
                      <View style={styles.platoPrecioRow}>
                        <Text style={styles.platoPrecioLabel}>Precio de venta:</Text>
                        <Text style={styles.platoPrecio}>
                          Gs. {formatPrice(item.precio)}
                        </Text>
                      </View>
                    </View>

                    {/* Botones de Acción */}
                    <View style={styles.platoActionsColumn}>
                      {/* Editar Completo */}
                      <TouchableOpacity
                        style={styles.btnEditarPlato}
                        onPress={() => abrirModalEditarPlato(item)}
                      >
                        <Text style={styles.btnEditarPlatoText}>Editar</Text>
                      </TouchableOpacity>

                      {/* Switch rápido de disponibilidad */}
                      <View style={styles.switchWrapper}>
                        <Text style={styles.switchLabel}>
                          {isDisponible ? 'Activo' : 'Pausa'}
                        </Text>
                        <Switch
                          value={isDisponible}
                          onValueChange={() => handleToggleDisponibilidad(item)}
                          trackColor={{
                            false: POS_COLORS.line,
                            true: POS_COLORS.primarySoft,
                          }}
                          thumbColor={
                            isDisponible ? POS_COLORS.primary : POS_COLORS.muted
                          }
                        />
                      </View>

                      {/* Borrar */}
                      <TouchableOpacity
                        style={styles.btnBorrarIcon}
                        onPress={() =>
                          setItemAEliminar({
                            tipo: 'plato',
                            id: item.id,
                            nombre: item.nombre,
                          })
                        }
                      >
                        <Text style={styles.btnBorrarIconText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 2: CATEGORÍAS DEL MENÚ                                          */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'categorias' && (
        <View style={{ flex: 1, padding: SPACING.md }}>
          <View style={styles.categoriasTopBar}>
            <Text style={styles.sectionTitle}>Estructura de la Carta</Text>
            <TouchableOpacity
              style={styles.btnNuevaCategoria}
              onPress={abrirModalNuevaCategoria}
            >
              <Text style={styles.btnNuevaCategoriaText}>+ Nueva Categoría</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={categoriasReales}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => {
              const platosAsociados = productos.filter(
                (p) => p.categoria_id === item.id
              ).length;

              return (
                <View style={styles.categoriaCard}>
                  <View style={styles.categoriaIconBox}>
                    <Image
                      source={getCategoryIcon(item.nombre)}
                      style={styles.categoriaIcon}
                      resizeMode="contain"
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: SPACING.md }}>
                    <Text style={styles.categoriaNombre}>{item.nombre}</Text>
                    <Text style={styles.categoriaSubtext}>
                      {platosAsociados} plato(s) en esta sección
                    </Text>
                  </View>

                  <View style={styles.categoriaButtonsRow}>
                    <TouchableOpacity
                      style={styles.btnCatEditar}
                      onPress={() => abrirModalEditarCategoria(item)}
                    >
                      <Text style={styles.btnCatEditarText}>✏️ Renombrar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnCatEliminar}
                      onPress={() =>
                        setItemAEliminar({
                          tipo: 'categoria',
                          id: item.id,
                          nombre: item.nombre,
                        })
                      }
                    >
                      <Text style={styles.btnCatEliminarText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: FORMULARIO DE PLATO (ALTA / EDICIÓN)                          */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={isModalPlatoVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalPlatoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {platoEditandoId ? 'Editar Plato' : 'Nuevo Plato en Carta'}
              </Text>
              <TouchableOpacity
                onPress={() => setIsModalPlatoVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: 30 }}
            >
              {/* Vista previa de Imagen */}
              <View style={styles.previewImageContainer}>
                <Image
                  source={getProductImage(formPlato.nombre, formPlato.imagen_url)}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
                <View style={styles.previewImageBadge}>
                  <Text style={styles.previewImageBadgeText}>Vista Previa</Text>
                </View>
              </View>

              {/* Nombre */}
              <Text style={styles.inputLabel}>Nombre del Plato *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. Smash Cheddar Doble"
                placeholderTextColor={POS_COLORS.muted}
                value={formPlato.nombre}
                onChangeText={(text) =>
                  setFormPlato((prev) => ({ ...prev, nombre: text }))
                }
              />

              {/* Precio y Categoría */}
              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: SPACING.sm }}>
                  <Text style={styles.inputLabel}>Precio de Venta (Gs.) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. 35000"
                    placeholderTextColor={POS_COLORS.muted}
                    keyboardType="numeric"
                    value={formPlato.precio}
                    onChangeText={(text) =>
                      setFormPlato((prev) => ({ ...prev, precio: text }))
                    }
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Categoría *</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6, paddingTop: 4 }}
                  >
                    {categoriasReales.map((c) => {
                      const isSel = formPlato.categoria_id === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[
                            styles.catSelectChip,
                            isSel && styles.catSelectChipActive,
                          ]}
                          onPress={() =>
                            setFormPlato((prev) => ({
                              ...prev,
                              categoria_id: c.id,
                            }))
                          }
                        >
                          <Text
                            style={[
                              styles.catSelectChipText,
                              isSel && styles.catSelectChipTextActive,
                            ]}
                          >
                            {c.nombre}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>

              {/* URL de Imagen */}
              <View style={{ marginTop: SPACING.sm }}>
                <View style={styles.imageLabelRow}>
                  <Text style={styles.inputLabel}>URL de la Foto</Text>
                  <TouchableOpacity
                    onPress={() =>
                      setMostrarGaleriaPresets((prev) => !prev)
                    }
                  >
                    <Text style={styles.btnTogglePresets}>
                      {mostrarGaleriaPresets
                        ? '▲ Ocultar presets'
                        : '▼ Elegir foto de galería'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="https://... o selecciona de abajo"
                  placeholderTextColor={POS_COLORS.muted}
                  value={formPlato.imagen_url}
                  onChangeText={(text) =>
                    setFormPlato((prev) => ({ ...prev, imagen_url: text }))
                  }
                />
              </View>

              {/* Galería desplegable de Presets */}
              {mostrarGaleriaPresets && (
                <View style={styles.presetsBox}>
                  <Text style={styles.presetsBoxTitle}>
                    Toca una foto para aplicarla al plato:
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.presetsList}
                  >
                    {FOOD_PRESET_IMAGES.map((preset, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.presetItem,
                          formPlato.imagen_url === preset.url &&
                          styles.presetItemActive,
                        ]}
                        onPress={() =>
                          setFormPlato((prev) => ({
                            ...prev,
                            imagen_url: preset.url,
                          }))
                        }
                      >
                        <Image
                          source={{ uri: preset.url }}
                          style={styles.presetImage}
                        />
                        <Text style={styles.presetLabel} numberOfLines={1}>
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Disponibilidad */}
              <View style={styles.disponibilidadRow}>
                <View>
                  <Text style={styles.inputLabel}>Disponibilidad Inmediata</Text>
                  <Text style={styles.disponibilidadSub}>
                    Si está desactivado, aparecerá como "Agotado" en caja
                  </Text>
                </View>
                <Switch
                  value={formPlato.disponible}
                  onValueChange={(val) =>
                    setFormPlato((prev) => ({ ...prev, disponible: val }))
                  }
                  trackColor={{
                    false: POS_COLORS.line,
                    true: POS_COLORS.primarySoft,
                  }}
                  thumbColor={
                    formPlato.disponible ? POS_COLORS.primary : POS_COLORS.muted
                  }
                />
              </View>

              {/* Descripción / Ingredientes */}
              <Text style={[styles.inputLabel, { marginTop: SPACING.sm }]}>
                Descripción o Ingredientes (Opcional)
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Ej. Dos medallones de 90g, doble queso cheddar fundido, cebolla caramelizada y salsa KS..."
                placeholderTextColor={POS_COLORS.muted}
                multiline
                numberOfLines={3}
                value={formPlato.descripcion}
                onChangeText={(text) =>
                  setFormPlato((prev) => ({ ...prev, descripcion: text }))
                }
              />

              {/* Botón Guardar */}
              <TouchableOpacity
                style={[
                  styles.btnSubmitModal,
                  savingPlato && styles.btnSubmitModalDisabled,
                ]}
                disabled={savingPlato}
                onPress={guardarPlato}
              >
                {savingPlato ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.btnSubmitModalText}>
                    {platoEditandoId ? 'Guardar Cambios' : 'Crear Plato'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: CAMBIO RÁPIDO DE PRECIO                                        */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={modalPrecioPlato !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalPrecioPlato(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxWidth: 380 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚡ Ajustar Precio</Text>
              <TouchableOpacity
                onPress={() => setModalPrecioPlato(null)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ padding: SPACING.md }}>
              <Text style={styles.precioRapidoPlatoNombre}>
                {modalPrecioPlato?.nombre}
              </Text>
              <Text style={styles.precioRapidoActual}>
                Precio actual: Gs. {formatPrice(modalPrecioPlato?.precio)}
              </Text>

              <Text style={[styles.inputLabel, { marginTop: SPACING.md }]}>
                Nuevo Precio (Gs.):
              </Text>
              <TextInput
                style={[styles.input, styles.inputPrecioGrande]}
                keyboardType="numeric"
                value={nuevoPrecioRapido}
                onChangeText={setNuevoPrecioRapido}
                autoFocus
              />

              {/* Incrementos rápidos */}
              <View style={styles.incrementosRow}>
                {[1000, 2000, 5000].map((inc) => (
                  <TouchableOpacity
                    key={inc}
                    style={styles.btnIncremento}
                    onPress={() => {
                      const actual = Number(nuevoPrecioRapido) || 0;
                      setNuevoPrecioRapido(String(actual + inc));
                    }}
                  >
                    <Text style={styles.btnIncrementoText}>
                      +{inc.toLocaleString('es-AR')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.btnModalAction, styles.btnModalCancel]}
                  onPress={() => setModalPrecioPlato(null)}
                >
                  <Text style={styles.btnModalCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btnModalAction,
                    styles.btnModalSave,
                    guardandoPrecioRapido && styles.btnSubmitModalDisabled,
                  ]}
                  disabled={guardandoPrecioRapido}
                  onPress={guardarPrecioRapido}
                >
                  {guardandoPrecioRapido ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.btnModalSaveText}>Actualizar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: FORMULARIO DE CATEGORÍA                                        */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={isModalCategoriaVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsModalCategoriaVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxWidth: 400 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {categoriaEditandoId ? 'Editar Categoría' : 'Nueva Categoría'}
              </Text>
              <TouchableOpacity
                onPress={() => setIsModalCategoriaVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ padding: SPACING.md }}>
              <Text style={styles.inputLabel}>Nombre de la Categoría *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. Postres, Combos, Tragos..."
                placeholderTextColor={POS_COLORS.muted}
                value={nombreCategoria}
                onChangeText={setNombreCategoria}
                autoFocus
              />

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.btnModalAction, styles.btnModalCancel]}
                  onPress={() => setIsModalCategoriaVisible(false)}
                >
                  <Text style={styles.btnModalCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btnModalAction,
                    styles.btnModalSave,
                    guardandoCategoria && styles.btnSubmitModalDisabled,
                  ]}
                  disabled={guardandoCategoria}
                  onPress={guardarCategoria}
                >
                  {guardandoCategoria ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.btnModalSaveText}>Guardar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 4: CONFIRMACIÓN DE ELIMINACIÓN                                    */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={itemAEliminar !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setItemAEliminar(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxWidth: 360, alignItems: 'center', padding: SPACING.lg }]}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>⚠️</Text>
            <Text style={styles.confirmTitle}>
              ¿Eliminar {itemAEliminar?.tipo === 'plato' ? 'Plato' : 'Categoría'}?
            </Text>
            <Text style={styles.confirmSub}>
              Estás a punto de borrar permanentemente{' '}
              <Text style={{ color: POS_COLORS.ink, fontWeight: '700' }}>
                "{itemAEliminar?.nombre}"
              </Text>
              . Esta acción no se puede deshacer.
            </Text>

            <View style={[styles.modalButtonsRow, { marginTop: SPACING.lg, width: '100%' }]}>
              <TouchableOpacity
                style={[styles.btnModalAction, styles.btnModalCancel]}
                onPress={() => setItemAEliminar(null)}
              >
                <Text style={styles.btnModalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnModalAction, styles.btnModalDelete, eliminandoItem && styles.btnSubmitModalDisabled]}
                disabled={eliminandoItem}
                onPress={confirmarEliminar}
              >
                {eliminandoItem ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.btnModalDeleteText}>Sí, Eliminar</Text>
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
    backgroundColor: POS_COLORS.canvas,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: PRODUCT_CONFIG.branding.primaryDark,
    backgroundImage:
      'linear-gradient(110deg, #07130D 0%, #183B2A 58%, #244B35 100%)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.10)',
    shadowColor: '#07130D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 7,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(232, 242, 235, 0.75)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnPrimaryAction: {
    backgroundColor: PRODUCT_CONFIG.branding.primaryBright,
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  btnPrimaryActionText: {
    ...TYPOGRAPHY.button,
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  closeButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
  },
  closeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Banner
  statusBanner: {
    paddingVertical: 9,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  statusBannerSuccess: {
    backgroundColor: POS_COLORS.primarySoft,
    borderBottomWidth: 1,
    borderBottomColor: '#C7DDCE',
  },
  statusBannerError: {
    backgroundColor: '#FFF1F2',
    borderBottomWidth: 1,
    borderBottomColor: '#F2C4C8',
  },
  statusBannerText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: POS_COLORS.ink,
  },

  // KPIs
  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: POS_COLORS.canvas,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: POS_COLORS.surfaceStrong,
    padding: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    shadowColor: '#17221B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: POS_COLORS.muted,
    letterSpacing: 0.6,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '900',
    marginVertical: 2,
  },
  kpiSub: {
    fontSize: 12,
    color: POS_COLORS.muted,
    fontWeight: '600',
  },

  // Pestañas
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: POS_COLORS.canvas,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    backgroundColor: POS_COLORS.surfaceStrong,
  },
  tabButtonActive: {
    backgroundColor: POS_COLORS.primarySoft,
    borderWidth: 1,
    borderColor: '#C7DDCE',
  },
  tabButtonText: {
    ...TYPOGRAPHY.caption,
    fontSize: 14,
    fontWeight: '700',
    color: POS_COLORS.muted,
  },
  tabButtonTextActive: {
    color: POS_COLORS.primaryDark,
    fontWeight: '800',
  },

  // Buscador y Filtro
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: POS_COLORS.canvas,
  },
  searchInput: {
    flex: 1,
    height: 42,
    backgroundColor: POS_COLORS.surfaceStrong,
    borderColor: POS_COLORS.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    color: POS_COLORS.ink,
    fontSize: 14,
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 24,
    padding: 6,
  },
  clearSearchBtnText: {
    color: POS_COLORS.muted,
    fontSize: 14,
  },
  categoriesFilterBar: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: POS_COLORS.canvas,
  },
  categoryFilterChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: POS_COLORS.surfaceStrong,
    marginRight: 6,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  categoryFilterChipActive: {
    backgroundColor: POS_COLORS.primarySoft,
    borderColor: '#C7DDCE',
  },
  categoryFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: POS_COLORS.muted,
  },
  categoryFilterChipTextActive: {
    color: POS_COLORS.primaryDark,
    fontWeight: '800',
  },

  // Listado de Platos
  listContent: {
    padding: SPACING.md,
    paddingBottom: 40,
    gap: 10,
  },
  platoCard: {
    flexDirection: 'row',
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    shadowColor: '#17221B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
    padding: SPACING.sm,
  },
  platoCardPausado: {
    opacity: 0.65,
    borderColor: '#F2C4C8',
  },
  platoImageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: POS_COLORS.line,
  },
  platoImage: {
    width: '100%',
    height: '100%',
  },
  disponibleBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 3,
    alignItems: 'center',
  },
  disponibleBadgeActivo: {
    backgroundColor: POS_COLORS.primary,
  },
  disponibleBadgePausado: {
    backgroundColor: 'rgba(239, 68, 68, 0.92)',
  },
  disponibleBadgeText: {
    fontSize: 8,
    fontWeight: '800',
  },
  disponibleBadgeTextActivo: {
    color: '#FFF',
  },
  disponibleBadgeTextPausado: {
    color: '#FFF',
  },
  platoInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
    justifyContent: 'space-between',
  },
  platoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  platoNombre: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    fontWeight: '800',
    color: POS_COLORS.ink,
    flex: 1,
  },
  categoriaTag: {
    backgroundColor: POS_COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7DDCE',
  },
  categoriaTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: POS_COLORS.primaryDark,
  },
  platoDescripcion: {
    fontSize: 12,
    color: POS_COLORS.muted,
    lineHeight: 16,
    marginVertical: 2,
  },
  platoPrecioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  platoPrecioLabel: {
    fontSize: 12,
    color: POS_COLORS.muted,
    fontWeight: '600',
  },
  platoPrecio: {
    fontSize: 15,
    fontWeight: '900',
    color: POS_COLORS.primaryDark,
  },

  // Acciones en tarjeta de plato
  platoActionsColumn: {
    width: 98,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingLeft: 6,
  },
  btnPrecioRapido: {
    backgroundColor: POS_COLORS.primarySoft,
    borderColor: '#C7DDCE',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  btnPrecioRapidoText: {
    fontSize: 10,
    fontWeight: '800',
    color: POS_COLORS.primaryDark,
  },
  btnEditarPlato: {
    backgroundColor: POS_COLORS.primarySoft,
    borderWidth: 1,
    borderColor: '#C7DDCE',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginTop: 2,
  },
  btnEditarPlatoText: {
    fontSize: 12,
    fontWeight: '800',
    color: POS_COLORS.primaryDark,
  },
  switchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  switchLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: POS_COLORS.muted,
  },
  btnBorrarIcon: {
    padding: 5,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
    alignSelf: 'flex-end',
  },
  btnBorrarIconText: {
    fontSize: 13,
  },

  // Categorías Tab
  categoriasTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 17,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  btnNuevaCategoria: {
    backgroundColor: POS_COLORS.primaryDark,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnNuevaCategoriaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  categoriaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    shadowColor: '#17221B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  categoriaIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: POS_COLORS.primarySoft,
    borderWidth: 1,
    borderColor: '#C7DDCE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriaIcon: {
    width: 24,
    height: 24,
    tintColor: POS_COLORS.primaryDark,
  },
  categoriaNombre: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  categoriaSubtext: {
    fontSize: 12,
    color: POS_COLORS.muted,
    marginTop: 2,
  },
  categoriaButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnCatEditar: {
    backgroundColor: POS_COLORS.primarySoft,
    borderWidth: 1,
    borderColor: '#C7DDCE',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
  },
  btnCatEditarText: {
    fontSize: 12,
    fontWeight: '700',
    color: POS_COLORS.primaryDark,
  },
  btnCatEliminar: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#F2C4C8',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 9,
  },
  btnCatEliminarText: {
    fontSize: 12,
  },

  // Modales
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 19, 13, 0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    maxHeight: '90%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.line,
    backgroundColor: POS_COLORS.surfaceStrong,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: POS_COLORS.muted,
  },
  modalBody: {
    padding: SPACING.md,
  },

  // Inputs
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: POS_COLORS.muted,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    height: 44,
    backgroundColor: POS_COLORS.surface,
    borderColor: POS_COLORS.line,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: SPACING.md,
    color: POS_COLORS.ink,
    fontSize: 14,
  },
  textArea: {
    height: 76,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
  },
  catSelectChip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  catSelectChipActive: {
    backgroundColor: POS_COLORS.primarySoft,
    borderColor: POS_COLORS.primary,
  },
  catSelectChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: POS_COLORS.muted,
  },
  catSelectChipTextActive: {
    color: POS_COLORS.primaryDark,
    fontWeight: '800',
  },

  // Imagen Preview
  previewImageContainer: {
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    position: 'relative',
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewImageBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(7, 19, 13, 0.72)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
  },
  previewImageBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  imageLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  btnTogglePresets: {
    fontSize: 12,
    color: POS_COLORS.primary,
    fontWeight: '800',
  },

  // Galería de Presets
  presetsBox: {
    backgroundColor: POS_COLORS.surface,
    padding: SPACING.sm,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  presetsBoxTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: POS_COLORS.muted,
    marginBottom: 6,
  },
  presetsList: {
    gap: 8,
  },
  presetItem: {
    width: 78,
    alignItems: 'center',
    padding: 5,
    borderRadius: 9,
    backgroundColor: POS_COLORS.surfaceStrong,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  presetItemActive: {
    borderColor: POS_COLORS.primary,
    backgroundColor: POS_COLORS.primarySoft,
  },
  presetImage: {
    width: 66,
    height: 50,
    borderRadius: 6,
  },
  presetLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: POS_COLORS.ink,
    marginTop: 4,
    textAlign: 'center',
  },

  // Disponibilidad en Formulario
  disponibilidadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: POS_COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  disponibilidadSub: {
    fontSize: 11,
    color: POS_COLORS.muted,
    marginTop: 2,
  },

  // Botón Submit Modal
  btnSubmitModal: {
    backgroundColor: POS_COLORS.primaryDark,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  btnSubmitModalDisabled: {
    opacity: 0.6,
  },
  btnSubmitModalText: {
    ...TYPOGRAPHY.button,
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },

  // Modal Rápido de Precio
  precioRapidoPlatoNombre: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  precioRapidoActual: {
    fontSize: 12,
    color: POS_COLORS.muted,
    marginTop: 2,
  },
  inputPrecioGrande: {
    fontSize: 20,
    fontWeight: '900',
    color: POS_COLORS.primaryDark,
    textAlign: 'center',
    height: 48,
  },
  incrementosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    gap: 8,
  },
  btnIncremento: {
    flex: 1,
    backgroundColor: POS_COLORS.primarySoft,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7DDCE',
  },
  btnIncrementoText: {
    fontSize: 11,
    fontWeight: '800',
    color: POS_COLORS.primaryDark,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.md,
  },
  btnModalAction: {
    flex: 1,
    height: 44,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnModalCancel: {
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  btnModalCancelText: {
    color: POS_COLORS.muted,
    fontWeight: '700',
    fontSize: 13,
  },
  btnModalSave: {
    backgroundColor: POS_COLORS.primaryDark,
  },
  btnModalSaveText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
  btnModalDelete: {
    backgroundColor: COLORS.danger,
  },
  btnModalDeleteText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },

  // Confirmación
  confirmTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 17,
    fontWeight: '800',
    color: POS_COLORS.ink,
    textAlign: 'center',
  },
  confirmSub: {
    fontSize: 13,
    color: POS_COLORS.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },

  // Helpers
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    color: POS_COLORS.muted,
    marginTop: 10,
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  emptySub: {
    fontSize: 13,
    color: POS_COLORS.muted,
    marginTop: 4,
    textAlign: 'center',
  },
});

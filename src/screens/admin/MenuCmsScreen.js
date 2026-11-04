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
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../theme/theme';
import { getProductImage, FOOD_PRESET_IMAGES, getCategoryIcon } from '../../theme/assets';

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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

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
          <Text style={[styles.kpiValue, { color: COLORS.text }]}>
            {kpis.totalPlatos}
          </Text>
          <Text style={styles.kpiSub}>En la carta</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>DISPONIBLES</Text>
          <Text style={[styles.kpiValue, { color: '#10B981' }]}>
            {kpis.disponibles}
          </Text>
          <Text style={styles.kpiSub}>
            {kpis.pausados > 0 ? `${kpis.pausados} pausados` : '100% activo'}
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>CATEGORÍAS</Text>
          <Text style={[styles.kpiValue, { color: '#63B3ED' }]}>
            {kpis.totalCategorias}
          </Text>
          <Text style={styles.kpiSub}>Secciones</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>PRECIO PROMEDIO</Text>
          <Text style={[styles.kpiValue, { color: '#F59E0B' }]}>
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
              placeholderTextColor={COLORS.textMuted}
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
              <ActivityIndicator size="large" color={COLORS.primary} />
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
                      {/* Cambio rápido de precio 
                      <TouchableOpacity
                        style={styles.btnPrecioRapido}
                        onPress={() => abrirModalPrecioRapido(item)}
                      >
                        <Text style={styles.btnPrecioRapidoText}>Gs. Precio</Text>
                      </TouchableOpacity>
                        */}

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
                          trackColor={{ false: '#334155', true: 'rgba(16, 185, 129, 0.4)' }}
                          thumbColor={isDisponible ? '#10B981' : '#94A3B8'}
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
                placeholderTextColor={COLORS.textMuted}
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
                    placeholderTextColor={COLORS.textMuted}
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
                  placeholderTextColor={COLORS.textMuted}
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
                  trackColor={{ false: '#334155', true: 'rgba(16, 185, 129, 0.4)' }}
                  thumbColor={formPlato.disponible ? '#10B981' : '#94A3B8'}
                />
              </View>

              {/* Descripción / Ingredientes */}
              <Text style={[styles.inputLabel, { marginTop: SPACING.sm }]}>
                Descripción o Ingredientes (Opcional)
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Ej. Dos medallones de 90g, doble queso cheddar fundido, cebolla caramelizada y salsa KS..."
                placeholderTextColor={COLORS.textMuted}
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
                placeholderTextColor={COLORS.textMuted}
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
              <Text style={{ color: COLORS.text, fontWeight: '700' }}>
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
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.secondaryBackground,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
  },
  headerSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnPrimaryAction: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.sm,
  },
  btnPrimaryActionText: {
    ...TYPOGRAPHY.button,
    fontSize: 12,
    color: '#FFF',
    fontWeight: '700',
  },
  closeButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    backgroundColor: 'rgba(247, 170, 170, 1)',
    borderRadius: 20,
  },
  closeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.danger,
  },

  // Banner
  statusBanner: {
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  statusBannerSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderBottomWidth: 1,
    borderBottomColor: '#10B981',
  },
  statusBannerError: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderBottomWidth: 1,
    borderBottomColor: '#EF4444',
  },
  statusBannerText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: COLORS.text,
  },

  // KPIs
  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.tOBlack,
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '900',
    marginVertical: 2,
  },
  kpiSub: {
    fontSize: 14,
    color: COLORS.tOBlack,
  },

  // Pestañas
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.background,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
    shadowColor: COLORS.card,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 0.5,
    borderColor: COLORS.card,
    backgroundColor: COLORS.background,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(92, 139, 248, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  tabButtonText: {
    ...TYPOGRAPHY.caption,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabButtonTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },

  // Buscador y Filtro
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  searchInput: {
    flex: 1,
    height: 38,
    backgroundColor: COLORS.background,
    borderColor: COLORS.primary,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    color: COLORS.text,
    fontSize: 13,
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 24,
    padding: 6,
  },
  clearSearchBtnText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  categoriesFilterBar: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  categoryFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.background,
    marginRight: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  categoryFilterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryFilterChipText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  categoryFilterChipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },

  // Listado de Platos
  listContent: {
    padding: SPACING.md,
    paddingBottom: 40,
    gap: 10,
  },
  platoCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    shadowColor: COLORS.card,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    overflow: 'hidden',
    padding: SPACING.sm,
  },
  platoCardPausado: {
    opacity: 0.65,
    borderColor: '#EF4444',
  },
  platoImageWrapper: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  platoImage: {
    width: '130%',
    height: '130%',
  },
  disponibleBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 2,
    alignItems: 'center',
  },
  disponibleBadgeActivo: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
  },
  disponibleBadgePausado: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
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
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  categoriaTag: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  categoriaTagText: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  platoDescripcion: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 15,
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
    color: COLORS.text,
  },
  platoPrecio: {
    fontSize: 14,
    fontWeight: '900',
    color: '#10B981',
  },

  // Acciones en tarjeta de plato
  platoActionsColumn: {
    width: 95,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingLeft: 6,
  },
  btnPrecioRapido: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
    width: '100%',
    alignItems: 'center',
  },
  btnPrecioRapidoText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
  },
  btnEditarPlato: {
    backgroundColor: 'rgba(255, 255, 255, 1)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 3,
  },
  btnEditarPlatoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#63B3ED',
  },
  switchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  switchLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  btnBorrarIcon: {
    padding: 3,
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
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  btnNuevaCategoria: {
    backgroundColor: '#63B3ED',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  btnNuevaCategoriaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  categoriaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoriaIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriaIcon: {
    width: 26,
    height: 26,
  },
  categoriaNombre: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  categoriaSubtext: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  categoriaButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnCatEditar: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.xs,
  },
  btnCatEditarText: {
    fontSize: 11,
    color: COLORS.text,
  },
  btnCatEliminar: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.xs,
  },
  btnCatEliminarText: {
    fontSize: 12,
  },

  // Modales
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseBtnText: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
  modalBody: {
    padding: SPACING.md,
  },

  // Inputs
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  input: {
    height: 42,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    color: COLORS.text,
    fontSize: 13,
  },
  textArea: {
    height: 70,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
  },
  catSelectChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catSelectChipActive: {
    backgroundColor: 'rgba(92, 139, 248, 0.2)',
    borderColor: COLORS.primary,
  },
  catSelectChipText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  catSelectChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Imagen Preview
  previewImageContainer: {
    height: 140,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    position: 'relative',
    backgroundColor: COLORS.background,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewImageBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
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
    fontSize: 11,
    color: '#63B3ED',
    fontWeight: '700',
  },

  // Galería de Presets
  presetsBox: {
    backgroundColor: COLORS.background,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  presetsBoxTitle: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  presetsList: {
    gap: 8,
  },
  presetItem: {
    width: 75,
    alignItems: 'center',
    padding: 4,
    borderRadius: BORDER_RADIUS.xs,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetItemActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(92, 139, 248, 0.15)',
  },
  presetImage: {
    width: 65,
    height: 50,
    borderRadius: BORDER_RADIUS.xs,
  },
  presetLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },

  // Disponibilidad en Formulario
  disponibilidadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  disponibilidadSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Botón Submit Modal
  btnSubmitModal: {
    backgroundColor: COLORS.primary,
    height: 44,
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  btnSubmitModalDisabled: {
    opacity: 0.6,
  },
  btnSubmitModalText: {
    ...TYPOGRAPHY.button,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },

  // Modal Rápido de Precio
  precioRapidoPlatoNombre: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  precioRapidoActual: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  inputPrecioGrande: {
    fontSize: 20,
    fontWeight: '900',
    color: '#10B981',
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnIncrementoText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.md,
  },
  btnModalAction: {
    flex: 1,
    height: 40,
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnModalCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  btnModalCancelText: {
    color: COLORS.textMuted,
    fontWeight: '700',
    fontSize: 12,
  },
  btnModalSave: {
    backgroundColor: COLORS.primary,
  },
  btnModalSaveText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
  },
  btnModalDelete: {
    backgroundColor: '#EF4444',
  },
  btnModalDeleteText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
  },

  // Confirmación
  confirmTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  confirmSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  // Helpers
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    color: COLORS.textMuted,
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
    fontSize: 15,
    color: COLORS.text,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
});

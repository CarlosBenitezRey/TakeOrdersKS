import React, { useState, useEffect, useCallback } from 'react';
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
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import empleadoService, { ROLES_DISPONIBLES } from '../../services/EmpleadoService';
import productService from '../../services/ProductService';
import {
  COLORS,
  POS_COLORS,
  SPACING,
  BORDER_RADIUS,
  TYPOGRAPHY,
} from '../../theme/theme';
import { PRODUCT_CONFIG } from '../../config/productConfig';
import PremiumLoader from '../../components/PremiumLoader';

// ─── Constantes de UI ─────────────────────────────────────────────────────────

const FORM_INICIAL = {
  nombre: '',
  rol: 'cajero',
  sucursalId: null,
  sueldoBase: '',
  telefono: '',
  fechaIngreso: new Date().toISOString().split('T')[0],
};

const ROL_COLORES = {
  cajero: { bg: POS_COLORS.primarySoft, text: POS_COLORS.primaryDark },
  cocinero: { bg: '#FFF8E8', text: '#A66A16' },
  mozo: { bg: '#F0F9FF', text: '#0369A1' },
  supervisor: { bg: '#EEF2FF', text: '#4338CA' },
  admin: { bg: '#ECFDF5', text: '#047857' },
};

const formatPrice = (value) =>
  Number(value || 0).toLocaleString('es-AR');

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function PersonalScreen({ userProfile, onClose }) {
  const [empleados, setEmpleados] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  // Estado del modal de formulario (agregar / editar)
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [empleadoEditando, setEmpleadoEditando] = useState(null); // null = nuevo
  const [formData, setFormData] = useState(FORM_INICIAL);
  const [savingForm, setSavingForm] = useState(false);

  // Estado del modal de confirmación de baja
  const [empleadoADarDeBaja, setEmpleadoADarDeBaja] = useState(null);

  // ─── Carga de datos ─────────────────────────────────────────────────────────

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [listaEmpleados, listaSucursales] = await Promise.all([
        empleadoService.getEmpleados(null),
        productService.getSucursales(),
      ]);
      setEmpleados(listaEmpleados);
      setSucursales(listaSucursales);
    } catch (error) {
      console.error('Error al cargar personal en PersonalScreen:', error);
      showStatus(error.message || 'Error al cargar personal', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Handlers de formulario ──────────────────────────────────────────────────

  const abrirFormNuevo = () => {
    setEmpleadoEditando(null);
    setFormData(FORM_INICIAL);
    setIsFormVisible(true);
  };

  const abrirFormEditar = (empleado) => {
    setEmpleadoEditando(empleado);
    setFormData({
      nombre: empleado.nombre || '',
      rol: empleado.rol || 'cajero',
      sucursalId: empleado.sucursal_id || null,
      sueldoBase: String(empleado.sueldo_base || ''),
      telefono: empleado.telefono || '',
      fechaIngreso: empleado.fecha_ingreso || new Date().toISOString().split('T')[0],
    });
    setIsFormVisible(true);
  };

  const cerrarForm = () => {
    setIsFormVisible(false);
    setEmpleadoEditando(null);
    setFormData(FORM_INICIAL);
  };

  const handleGuardar = async () => {
    try {
      setSavingForm(true);
      if (empleadoEditando) {
        const actualizado = await empleadoService.actualizarEmpleado(
          empleadoEditando.id,
          formData
        );
        setEmpleados((prev) =>
          prev.map((e) => (e.id === actualizado.id ? { ...actualizado, sucursales: e.sucursales } : e))
        );
        showStatus('Empleado actualizado correctamente', 'success');
      } else {
        await empleadoService.crearEmpleado(formData);
        await cargarDatos(); // Recargar para obtener el JOIN con sucursales
        showStatus('Empleado agregado correctamente', 'success');
      }
      cerrarForm();
    } catch (error) {
      showStatus(error.message, 'error');
    } finally {
      setSavingForm(false);
    }
  };

  const handleDarDeBaja = async () => {
    if (!empleadoADarDeBaja) return;
    try {
      await empleadoService.darDeBaja(empleadoADarDeBaja.id);
      setEmpleados((prev) => prev.filter((e) => e.id !== empleadoADarDeBaja.id));
      setEmpleadoADarDeBaja(null);
      showStatus('Empleado dado de baja correctamente', 'success');
    } catch (error) {
      showStatus('Error al dar de baja al empleado', 'error');
      setEmpleadoADarDeBaja(null);
    }
  };

  // ─── Utilidades ──────────────────────────────────────────────────────────────

  const showStatus = (text, type = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage({ text: '', type: '' }), 3500);
  };

  const getRolColor = (rol) =>
    ROL_COLORES[rol] || { bg: POS_COLORS.surface, text: POS_COLORS.muted };

  // ─── Render de tarjeta de empleado ───────────────────────────────────────────

  const renderEmpleado = ({ item }) => {
    const rolColor = getRolColor(item.rol);
    return (
      <View style={styles.empleadoCard}>
        {/* Avatar inicial */}
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {item.nombre?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>

        {/* Datos del empleado */}
        <View style={styles.empleadoInfo}>
          <Text style={styles.empleadoNombre} numberOfLines={1}>
            {item.nombre}
          </Text>

          <View style={styles.empleadoMeta}>
            {/* Badge de rol */}
            <View style={[styles.rolBadge, { backgroundColor: rolColor.bg }]}>
              <Text style={[styles.rolBadgeText, { color: rolColor.text }]}>
                {item.rol?.toUpperCase()}
              </Text>
            </View>
            {/* Sucursal */}
            {(item.sucursales?.nombre || sucursales.find((s) => s.id === item.sucursal_id)?.nombre) ? (
              <Text style={styles.sucursalText} numberOfLines={1}>
                📍 {item.sucursales?.nombre || sucursales.find((s) => s.id === item.sucursal_id)?.nombre}
              </Text>
            ) : null}
          </View>

          {/* Sueldo */}
          <Text style={styles.sueldoText}>
            Gs. {formatPrice(item.sueldo_base)} / mes
          </Text>

          {/* Teléfono */}
          {item.telefono ? (
            <Text style={styles.telefonoText}>📞 {item.telefono}</Text>
          ) : null}
        </View>

        {/* Acciones */}
        <View style={styles.empleadoAcciones}>
          <TouchableOpacity
            style={[styles.accionBtn, styles.accionEditar]}
            onPress={() => abrirFormEditar(item)}
          >
            <Text style={styles.accionEditarText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.accionBtn, styles.accionBaja]}
            onPress={() => setEmpleadoADarDeBaja(item)}
          >
            <Text style={styles.accionBajaText}>🚫</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Render Principal ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={PRODUCT_CONFIG.branding.primaryDark}
      />

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Personal</Text>
          <Text style={styles.headerSubtitle}>
            {empleados.length} empleado{empleados.length !== 1 ? 's' : ''} activo{empleados.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.btnAgregar} onPress={abrirFormNuevo}>
            <Text style={styles.btnAgregarText}>+ Agregar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCerrar} onPress={onClose}>
            <Text style={styles.btnCerrarText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* STATUS BANNER */}
      {statusMessage.text !== '' && (
        <View
          style={[
            styles.statusBanner,
            statusMessage.type === 'error'
              ? styles.statusError
              : styles.statusSuccess,
          ]}
        >
          <Text style={styles.statusText}>{statusMessage.text}</Text>
        </View>
      )}

      {/* LISTA DE EMPLEADOS */}
      {loading ? (
        <PremiumLoader
          message="Cargando personal"
          detail="Sincronizando empleados y sucursales"
        />
      ) : empleados.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>👤</Text>
          <Text style={styles.emptyTitle}>Sin personal registrado</Text>
          <Text style={styles.emptySubtitle}>
            Agregá tu primer empleado con el botón "+ Agregar"
          </Text>
        </View>
      ) : (
        <FlatList
          data={empleados}
          keyExtractor={(item) => String(item.id || Math.random())}
          renderItem={renderEmpleado}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── MODAL: FORMULARIO AGREGAR / EDITAR ─────────────────────────────── */}
      <Modal
        visible={isFormVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={cerrarForm}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.formModal}>
            {/* Header del modal */}
            <View style={styles.formModalHeader}>
              <Text style={styles.formModalTitle}>
                {empleadoEditando ? '✏️ Editar Empleado' : '➕ Nuevo Empleado'}
              </Text>
              <TouchableOpacity
                style={styles.formModalCloseBtn}
                onPress={cerrarForm}
              >
                <Text style={styles.formModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Nombre */}
              <Text style={styles.fieldLabel}>Nombre completo *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ej. Juan García"
                placeholderTextColor={POS_COLORS.muted}
                value={formData.nombre}
                onChangeText={(v) => setFormData((p) => ({ ...p, nombre: v }))}
                autoCapitalize="words"
              />

              {/* Rol */}
              <Text style={styles.fieldLabel}>Rol *</Text>
              <View style={styles.rolSelector}>
                {ROLES_DISPONIBLES.map((r) => {
                  const isSelected = formData.rol === r.value;
                  const color = getRolColor(r.value);
                  return (
                    <TouchableOpacity
                      key={r.value}
                      style={[
                        styles.rolOption,
                        isSelected && { backgroundColor: color.bg, borderColor: color.text },
                      ]}
                      onPress={() => setFormData((p) => ({ ...p, rol: r.value }))}
                    >
                      <Text
                        style={[
                          styles.rolOptionText,
                          isSelected && { color: color.text, fontWeight: '800' },
                        ]}
                      >
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Sucursal */}
              <Text style={styles.fieldLabel}>Sucursal</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sucursalSelector}
              >
                <TouchableOpacity
                  style={[
                    styles.sucursalOption,
                    !formData.sucursalId && styles.sucursalOptionSelected,
                  ]}
                  onPress={() => setFormData((p) => ({ ...p, sucursalId: null }))}
                >
                  <Text
                    style={[
                      styles.sucursalOptionText,
                      !formData.sucursalId && styles.sucursalOptionTextSelected,
                    ]}
                  >
                    Global
                  </Text>
                </TouchableOpacity>
                {sucursales.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.sucursalOption,
                      formData.sucursalId === s.id && styles.sucursalOptionSelected,
                    ]}
                    onPress={() => setFormData((p) => ({ ...p, sucursalId: s.id }))}
                  >
                    <Text
                      style={[
                        styles.sucursalOptionText,
                        formData.sucursalId === s.id && styles.sucursalOptionTextSelected,
                      ]}
                    >
                      {s.nombre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Sueldo Base */}
              <Text style={styles.fieldLabel}>Sueldo Base (Gs.)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ej. 2500000"
                placeholderTextColor={POS_COLORS.muted}
                value={formData.sueldoBase}
                onChangeText={(v) =>
                  setFormData((p) => ({ ...p, sueldoBase: v.replace(/\D/g, '') }))
                }
                keyboardType="numeric"
              />

              {/* Teléfono */}
              <Text style={styles.fieldLabel}>Teléfono (opcional)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ej. 0981 123 456"
                placeholderTextColor={POS_COLORS.muted}
                value={formData.telefono}
                onChangeText={(v) => setFormData((p) => ({ ...p, telefono: v }))}
                keyboardType="phone-pad"
              />

              {/* Fecha de ingreso */}
              <Text style={styles.fieldLabel}>Fecha de Ingreso (AAAA-MM-DD)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ej. 2025-01-15"
                placeholderTextColor={POS_COLORS.muted}
                value={formData.fechaIngreso}
                onChangeText={(v) => setFormData((p) => ({ ...p, fechaIngreso: v }))}
              />
            </ScrollView>

            {/* Botón Guardar */}
            <View style={styles.formFooter}>
              <TouchableOpacity
                style={[styles.btnGuardar, savingForm && styles.btnGuardarDisabled]}
                onPress={handleGuardar}
                disabled={savingForm}
              >
                {savingForm ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.btnGuardarText}>
                    {empleadoEditando ? 'Guardar Cambios' : 'Agregar Empleado'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL: CONFIRMACIÓN DE BAJA ─────────────────────────────────────── */}
      <Modal
        visible={empleadoADarDeBaja !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEmpleadoADarDeBaja(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmEmoji}>🚫</Text>
            <Text style={styles.confirmTitle}>¿Dar de baja?</Text>
            <Text style={styles.confirmNombre}>
              {empleadoADarDeBaja?.nombre}
            </Text>
            <Text style={styles.confirmText}>
              El empleado dejará de aparecer en la lista activa. Sus datos históricos se conservan para registros de salarios y reportes.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnCancel]}
                onPress={() => setEmpleadoADarDeBaja(null)}
              >
                <Text style={styles.confirmBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnDelete]}
                onPress={handleDarDeBaja}
              >
                <Text style={styles.confirmBtnDeleteText}>Sí, dar de baja</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: POS_COLORS.canvas,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },

  // Header
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
    gap: SPACING.sm,
  },
  btnAgregar: {
    backgroundColor: PRODUCT_CONFIG.branding.primaryBright,
    paddingVertical: 9,
    paddingHorizontal: SPACING.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  btnAgregarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  btnCerrar: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  btnCerrarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Status Banner
  statusBanner: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
  },
  statusSuccess: {
    backgroundColor: POS_COLORS.primarySoft,
    borderWidth: 1,
    borderColor: '#C7DDCE',
  },
  statusError: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#F2C4C8',
  },
  statusText: {
    ...TYPOGRAPHY.body,
    color: POS_COLORS.ink,
    fontWeight: '700',
    fontSize: 13,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: POS_COLORS.ink,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    color: POS_COLORS.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Lista
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl * 2,
  },

  // Tarjeta de empleado
  empleadoCard: {
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    // Sombra iOS
    shadowColor: '#17221B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    // Sombra Android
    elevation: 2,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: POS_COLORS.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    flexShrink: 0,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  empleadoInfo: {
    flex: 1,
  },
  empleadoNombre: {
    ...TYPOGRAPHY.body,
    fontWeight: '800',
    color: POS_COLORS.ink,
    marginBottom: 4,
  },
  empleadoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  rolBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  rolBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sucursalText: {
    ...TYPOGRAPHY.caption,
    color: POS_COLORS.muted,
  },
  sueldoText: {
    ...TYPOGRAPHY.caption,
    color: POS_COLORS.primaryDark,
    fontWeight: '800',
    marginTop: 2,
  },
  telefonoText: {
    ...TYPOGRAPHY.caption,
    color: POS_COLORS.muted,
    marginTop: 2,
  },
  empleadoAcciones: {
    flexDirection: 'column',
    gap: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  accionBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  accionEditar: {
    backgroundColor: POS_COLORS.primarySoft,
    borderColor: '#C7DDCE',
  },
  accionEditarText: {
    fontSize: 16,
  },
  accionBaja: {
    backgroundColor: '#FFF1F2',
    borderColor: '#F2C4C8',
  },
  accionBajaText: {
    fontSize: 16,
  },

  // Modal de formulario
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 19, 13, 0.76)',
    justifyContent: 'flex-end',
  },
  formModal: {
    backgroundColor: POS_COLORS.surfaceStrong,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderTopColor: POS_COLORS.line,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  formModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.line,
    backgroundColor: POS_COLORS.surfaceStrong,
  },
  formModalTitle: {
    ...TYPOGRAPHY.h3,
    color: POS_COLORS.ink,
    fontWeight: '800',
  },
  formModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formModalClose: {
    color: POS_COLORS.muted,
    fontSize: 16,
    fontWeight: '700',
  },
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.sm,
  },

  // Campos del formulario
  fieldLabel: {
    ...TYPOGRAPHY.caption,
    color: POS_COLORS.muted,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: SPACING.md,
  },
  fieldInput: {
    height: 46,
    backgroundColor: POS_COLORS.surface,
    borderColor: POS_COLORS.line,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: SPACING.md,
    color: POS_COLORS.ink,
    fontSize: 14,
  },

  // Selector de rol
  rolSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  rolOption: {
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    borderRadius: 10,
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  rolOptionText: {
    fontSize: 13,
    color: POS_COLORS.muted,
    fontWeight: '600',
  },

  // Selector de sucursal
  sucursalSelector: {
    gap: SPACING.xs,
    paddingVertical: 4,
  },
  sucursalOption: {
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    borderRadius: 10,
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  sucursalOptionSelected: {
    backgroundColor: POS_COLORS.primarySoft,
    borderColor: POS_COLORS.primary,
  },
  sucursalOptionText: {
    fontSize: 13,
    color: POS_COLORS.muted,
    fontWeight: '600',
  },
  sucursalOptionTextSelected: {
    color: POS_COLORS.primaryDark,
    fontWeight: '800',
  },

  // Footer del formulario
  formFooter: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: POS_COLORS.line,
    backgroundColor: POS_COLORS.surfaceStrong,
  },
  btnGuardar: {
    backgroundColor: POS_COLORS.primaryDark,
    borderRadius: 13,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: POS_COLORS.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnGuardarDisabled: {
    opacity: 0.6,
  },
  btnGuardarText: {
    ...TYPOGRAPHY.button,
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Modal de confirmación de baja
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 19, 13, 0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  confirmBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: 22,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmEmoji: {
    fontSize: 52,
    marginBottom: SPACING.sm,
  },
  confirmTitle: {
    ...TYPOGRAPHY.h2,
    textAlign: 'center',
    marginBottom: SPACING.xs,
    color: POS_COLORS.ink,
    fontWeight: '800',
  },
  confirmNombre: {
    ...TYPOGRAPHY.body,
    fontWeight: '800',
    color: POS_COLORS.primaryDark,
    marginBottom: SPACING.md,
    textAlign: 'center',
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
    width: '100%',
    gap: SPACING.sm,
  },
  confirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: COLORS.textLight,
    fontWeight: '800',
  },
});

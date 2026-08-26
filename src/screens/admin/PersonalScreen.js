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
import empleadoService, { ROLES_DISPONIBLES } from '../services/EmpleadoService';
import productoRepository from '../repositories/ProductoRepository';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../theme/theme';

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
  cajero:     { bg: 'rgba(248, 92, 92, 0.15)',   text: '#f85c5c' },
  cocinero:   { bg: 'rgba(242, 169, 59, 0.15)',   text: '#F2A93B' },
  mozo:       { bg: 'rgba(99, 179, 237, 0.15)',   text: '#63B3ED' },
  supervisor: { bg: 'rgba(167, 139, 250, 0.15)',  text: '#A78BFA' },
  admin:      { bg: 'rgba(16, 185, 129, 0.15)',   text: '#10B981' },
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
        empleadoService.getEmpleados(userProfile?.sucursal_id || null),
        productoRepository.getSucursales(),
      ]);
      setEmpleados(listaEmpleados);
      setSucursales(listaSucursales);
    } catch (error) {
      showStatus('Error al cargar personal', 'error');
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
      nombre:       empleado.nombre || '',
      rol:          empleado.rol || 'cajero',
      sucursalId:   empleado.sucursal_id || null,
      sueldoBase:   String(empleado.sueldo_base || ''),
      telefono:     empleado.telefono || '',
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
    ROL_COLORES[rol] || { bg: 'rgba(148, 163, 184, 0.15)', text: COLORS.textMuted };

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
            {item.sucursales?.nombre && (
              <Text style={styles.sucursalText} numberOfLines={1}>
                📍 {item.sucursales.nombre}
              </Text>
            )}
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>👥 Personal</Text>
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
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loaderText}>Cargando personal...</Text>
        </View>
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
          keyExtractor={(item) => item.id}
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
              <TouchableOpacity onPress={cerrarForm}>
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
                placeholderTextColor={COLORS.textMuted}
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
                placeholderTextColor={COLORS.textMuted}
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
                placeholderTextColor={COLORS.textMuted}
                value={formData.telefono}
                onChangeText={(v) => setFormData((p) => ({ ...p, telefono: v }))}
                keyboardType="phone-pad"
              />

              {/* Fecha de ingreso */}
              <Text style={styles.fieldLabel}>Fecha de Ingreso (AAAA-MM-DD)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ej. 2025-01-15"
                placeholderTextColor={COLORS.textMuted}
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
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.primary,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  btnAgregar: {
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  btnAgregarText: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: 14,
  },
  btnCerrar: {
    backgroundColor: COLORS.cardElevated,
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.round,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnCerrarText: {
    color: COLORS.textMuted,
    fontSize: 16,
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
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  statusError: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  statusText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    fontSize: 13,
  },

  // Loader / Empty
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: SPACING.md,
    ...TYPOGRAPHY.bodyMuted,
  },
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
    ...TYPOGRAPHY.h3,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    ...TYPOGRAPHY.bodyMuted,
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
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    // Sombra iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    // Sombra Android
    elevation: 3,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    flexShrink: 0,
  },
  avatarText: {
    color: COLORS.textLight,
    fontSize: 22,
    fontWeight: '800',
  },
  empleadoInfo: {
    flex: 1,
  },
  empleadoNombre: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
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
    color: COLORS.textMuted,
  },
  sueldoText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.secondary,
    fontWeight: '700',
    marginTop: 2,
  },
  telefonoText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
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
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  accionEditar: {
    backgroundColor: 'rgba(242, 169, 59, 0.1)',
    borderColor: '#F2A93B',
  },
  accionEditarText: {
    fontSize: 16,
  },
  accionBaja: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: COLORS.danger,
  },
  accionBajaText: {
    fontSize: 16,
  },

  // Modal de formulario
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  formModal: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  formModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  formModalTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.primary,
  },
  formModalClose: {
    color: COLORS.textMuted,
    fontSize: 20,
    fontWeight: '700',
    padding: SPACING.xs,
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
    color: COLORS.text,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: SPACING.md,
  },
  fieldInput: {
    height: 46,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    color: COLORS.text,
    ...TYPOGRAPHY.body,
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
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rolOptionText: {
    fontSize: 13,
    color: COLORS.textMuted,
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
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sucursalOptionSelected: {
    backgroundColor: 'rgba(248, 92, 92, 0.15)',
    borderColor: COLORS.primary,
  },
  sucursalOptionText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  sucursalOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '800',
  },

  // Footer del formulario
  formFooter: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  btnGuardar: {
    backgroundColor: COLORS.success,
    borderRadius: BORDER_RADIUS.lg,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnGuardarDisabled: {
    opacity: 0.6,
  },
  btnGuardarText: {
    ...TYPOGRAPHY.button,
    fontSize: 17,
  },

  // Modal de confirmación de baja
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  confirmBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  confirmEmoji: {
    fontSize: 52,
    marginBottom: SPACING.sm,
  },
  confirmTitle: {
    ...TYPOGRAPHY.h2,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  confirmNombre: {
    ...TYPOGRAPHY.body,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  confirmText: {
    ...TYPOGRAPHY.bodyMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: SPACING.sm,
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnCancel: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
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
});

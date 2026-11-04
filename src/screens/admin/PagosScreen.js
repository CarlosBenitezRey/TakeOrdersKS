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
import pagoService, {
  METODOS_PAGO_EGRESO,
  ESTADOS_PAGO_PROVEEDOR,
} from '../../services/PagoService';
import proveedorService, { CATEGORIAS_PROVEEDOR } from '../../services/ProveedorService';
import empleadoService, { ROLES_DISPONIBLES } from '../../services/EmpleadoService';
import productService from '../../services/ProductService';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../theme/theme';

const formatPrice = (value) => Number(value || 0).toLocaleString('es-AR');

const ROL_COLORES = {
  cajero:     { bg: 'rgba(248, 92, 92, 0.15)',   text: '#f85c5c' },
  cocinero:   { bg: 'rgba(242, 169, 59, 0.15)',   text: '#F2A93B' },
  mozo:       { bg: 'rgba(99, 179, 237, 0.15)',   text: '#63B3ED' },
  supervisor: { bg: 'rgba(167, 139, 250, 0.15)',  text: '#A78BFA' },
  admin:      { bg: 'rgba(16, 185, 129, 0.15)',   text: '#10B981' },
};

export default function PagosScreen({ userProfile, onClose }) {
  // Tab activo: 'salarios' | 'proveedores'
  const [activeTab, setActiveTab] = useState('salarios');

  // Datos principales
  const [pagosSalarios, setPagosSalarios] = useState([]);
  const [pagosProveedores, setPagosProveedores] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [sucursales, setSucursales] = useState([]);

  // Filtros
  const [selectedSucursalId, setSelectedSucursalId] = useState(
    userProfile?.sucursal_id || 'all'
  );
  const [filtroEstadoProveedor, setFiltroEstadoProveedor] = useState('all'); // 'all' | 'pagado' | 'pendiente'

  // Estados de carga y mensajes
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  // ─── Modales de Salarios ──────────────────────────────────────────────────
  const [isModalSalarioVisible, setIsModalSalarioVisible] = useState(false);
  const [savingSalario, setSavingSalario] = useState(false);
  const [formSalario, setFormSalario] = useState({
    empleadoId: '',
    monto: '',
    periodo: pagoService.getPeriodosDisponibles()[0]?.value || '',
    fechaPago: new Date().toISOString().split('T')[0],
    metodoPago: 'transferencia',
    notas: '',
  });

  // ─── Modales de Proveedores & Facturas ────────────────────────────────────
  const [isModalProveedorVisible, setIsModalProveedorVisible] = useState(false);
  const [savingProveedor, setSavingProveedor] = useState(false);
  const [formProveedor, setFormProveedor] = useState({
    nombre: '',
    ruc: '',
    telefono: '',
    categoria: 'Carnes',
    sucursalId: userProfile?.sucursal_id || null,
  });

  const [isModalGastoVisible, setIsModalGastoVisible] = useState(false);
  const [savingGasto, setSavingGasto] = useState(false);
  const [formGasto, setFormGasto] = useState({
    proveedorId: '',
    concepto: '',
    monto: '',
    fecha: new Date().toISOString().split('T')[0],
    estado: 'pagado',
    metodoPago: 'transferencia',
    sucursalId: userProfile?.sucursal_id || null,
  });

  // Confirmación de eliminación
  const [itemAEliminar, setItemAEliminar] = useState(null); // { tipo: 'salario'|'proveedor'|'gasto', id, nombre }

  // ─── Carga de datos ────────────────────────────────────────────────────────
  const cargarTodo = useCallback(async () => {
    try {
      setLoading(true);
      const sucursalParam = selectedSucursalId === 'all' ? null : selectedSucursalId;

      const [
        resSalarios,
        resProveedoresPagos,
        resEmpleados,
        resProveedores,
        resSucursales,
      ] = await Promise.all([
        pagoService.getPagosSalarios(sucursalParam),
        pagoService.getPagosProveedores(sucursalParam),
        empleadoService.getEmpleados(sucursalParam),
        proveedorService.getProveedores(sucursalParam),
        productService.getSucursales(),
      ]);

      setPagosSalarios(resSalarios);
      setPagosProveedores(resProveedoresPagos);
      setEmpleados(resEmpleados);
      setProveedores(resProveedores);
      setSucursales(resSucursales);
    } catch (error) {
      console.error('Error cargando módulo de pagos:', error);
      showStatus('Error al conectar con la base de datos', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedSucursalId]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  const showStatus = (text, type = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage({ text: '', type: '' }), 3500);
  };

  // ─── Handlers de Salarios ──────────────────────────────────────────────────
  const handleSeleccionarEmpleado = (empleado) => {
    setFormSalario((prev) => ({
      ...prev,
      empleadoId: empleado.id,
      monto: empleado.sueldo_base ? String(empleado.sueldo_base) : prev.monto,
    }));
  };

  const handleGuardarSalario = async () => {
    try {
      setSavingSalario(true);
      await pagoService.registrarPagoSalario(formSalario, userProfile?.id);
      showStatus('Pago de salario registrado exitosamente');
      setIsModalSalarioVisible(false);
      setFormSalario({
        empleadoId: '',
        monto: '',
        periodo: pagoService.getPeriodosDisponibles()[0]?.value || '',
        fechaPago: new Date().toISOString().split('T')[0],
        metodoPago: 'transferencia',
        notas: '',
      });
      cargarTodo();
    } catch (error) {
      showStatus(error.message, 'error');
    } finally {
      setSavingSalario(false);
    }
  };

  // ─── Handlers de Proveedores & Gastos ──────────────────────────────────────
  const handleGuardarProveedor = async () => {
    try {
      setSavingProveedor(true);
      await proveedorService.crearProveedor(formProveedor);
      showStatus('Proveedor registrado con éxito');
      setIsModalProveedorVisible(false);
      setFormProveedor({
        nombre: '',
        ruc: '',
        telefono: '',
        categoria: 'Carnes',
        sucursalId: userProfile?.sucursal_id || null,
      });
      cargarTodo();
    } catch (error) {
      showStatus(error.message, 'error');
    } finally {
      setSavingProveedor(false);
    }
  };

  const handleGuardarGasto = async () => {
    try {
      setSavingGasto(true);
      await pagoService.registrarPagoProveedor(formGasto, userProfile?.id);
      showStatus('Factura/Gasto registrado con éxito');
      setIsModalGastoVisible(false);
      setFormGasto({
        proveedorId: '',
        concepto: '',
        monto: '',
        fecha: new Date().toISOString().split('T')[0],
        estado: 'pagado',
        metodoPago: 'transferencia',
        sucursalId: userProfile?.sucursal_id || null,
      });
      cargarTodo();
    } catch (error) {
      showStatus(error.message, 'error');
    } finally {
      setSavingGasto(false);
    }
  };

  const handleMarcarPagado = async (id) => {
    try {
      await pagoService.marcarComoPagado(id);
      showStatus('Gasto actualizado a Pagado');
      cargarTodo();
    } catch (error) {
      showStatus(error.message, 'error');
    }
  };

  const handleConfirmarEliminacion = async () => {
    if (!itemAEliminar) return;
    try {
      if (itemAEliminar.tipo === 'salario') {
        await pagoService.eliminarPagoSalario(itemAEliminar.id);
        showStatus('Registro de salario eliminado');
      } else if (itemAEliminar.tipo === 'gasto') {
        await pagoService.eliminarPagoProveedor(itemAEliminar.id);
        showStatus('Registro de gasto eliminado');
      }
      setItemAEliminar(null);
      cargarTodo();
    } catch (error) {
      showStatus('Error al eliminar registro: ' + error.message, 'error');
    }
  };

  // ─── Métricas Calculadas ───────────────────────────────────────────────────
  const resumen = pagoService.calcularResumenEgresos(pagosSalarios, pagosProveedores);

  const pagosProveedoresFiltrados = pagosProveedores.filter((p) => {
    if (filtroEstadoProveedor === 'all') return true;
    return p.estado === filtroEstadoProveedor;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Gestión de Pagos</Text>
          <Text style={styles.headerSubtitle}>Egresos, Salarios y Proveedores</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* ── BANNER DE ESTADO ───────────────────────────────────────────────── */}
      {statusMessage.text ? (
        <View
          style={[
            styles.statusBar,
            statusMessage.type === 'error'
              ? styles.statusBarError
              : styles.statusBarSuccess,
          ]}
        >
          <Text style={styles.statusBarText}>{statusMessage.text}</Text>
        </View>
      ) : null}

      {/* ── FILTRO POR SUCURSAL (Solo Admin Global) ────────────────────────── */}
      {!userProfile?.sucursal_id && sucursales.length > 0 && (
        <View style={styles.sucursalBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sucursalList}>
            <TouchableOpacity
              style={[
                styles.sucursalPill,
                selectedSucursalId === 'all' && styles.sucursalPillActive,
              ]}
              onPress={() => setSelectedSucursalId('all')}
            >
              <Text
                style={[
                  styles.sucursalPillText,
                  selectedSucursalId === 'all' && styles.sucursalPillTextActive,
                ]}
              >
                Todas las Sucursales
              </Text>
            </TouchableOpacity>
            {sucursales.map((suc) => (
              <TouchableOpacity
                key={suc.id}
                style={[
                  styles.sucursalPill,
                  selectedSucursalId === suc.id && styles.sucursalPillActive,
                ]}
                onPress={() => setSelectedSucursalId(suc.id)}
              >
                <Text
                  style={[
                    styles.sucursalPillText,
                    selectedSucursalId === suc.id && styles.sucursalPillTextActive,
                  ]}
                >
                  📍 {suc.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── TABS PRINCIPALES ───────────────────────────────────────────────── */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'salarios' && styles.tabButtonActive]}
          onPress={() => setActiveTab('salarios')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'salarios' && styles.tabButtonTextActive]}>
            💼 Salarios ({pagosSalarios.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'proveedores' && styles.tabButtonActive]}
          onPress={() => setActiveTab('proveedores')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'proveedores' && styles.tabButtonTextActive]}>
            🚚 Proveedores & Gastos ({pagosProveedores.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── RESUMEN FINANCIERO ─────────────────────────────────────────────── */}
      <View style={styles.kpiContainer}>
        {activeTab === 'salarios' ? (
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL PAGADO EN SALARIOS</Text>
            <Text style={styles.kpiValue}>Gs. {formatPrice(resumen.totalSalarios)}</Text>
            <Text style={styles.kpiSub}>Registros: {pagosSalarios.length}</Text>
          </View>
        ) : (
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { flex: 1, marginRight: 6 }]}>
              <Text style={styles.kpiLabel}>PROVEEDORES PAGADO</Text>
              <Text style={[styles.kpiValue, { color: COLORS.success }]}>
                Gs. {formatPrice(resumen.totalProveedoresPagado)}
              </Text>
            </View>
            <View style={[styles.kpiCard, { flex: 1, marginLeft: 6 }]}>
              <Text style={styles.kpiLabel}>FACTURAS PENDIENTES</Text>
              <Text style={[styles.kpiValue, { color: COLORS.secondary }]}>
                Gs. {formatPrice(resumen.totalProveedoresPendiente)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ── CONTENIDO DEL TAB ──────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Cargando datos de pagos...</Text>
        </View>
      ) : activeTab === 'salarios' ? (
        // ─── TAB SALARIOS ──────────────────────────────────────────────────
        <View style={styles.tabContent}>
          <View style={styles.actionBar}>
            <Text style={styles.sectionTitle}>Historial de Salarios</Text>
            <TouchableOpacity
              style={styles.actionBtnPrimary}
              onPress={() => setIsModalSalarioVisible(true)}
            >
              <Text style={styles.actionBtnPrimaryText}>+ Pagar Salario</Text>
            </TouchableOpacity>
          </View>

          {pagosSalarios.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💳</Text>
              <Text style={styles.emptyTitle}>Sin pagos de salarios</Text>
              <Text style={styles.emptySub}>
                Aún no has registrado pagos de nómina para esta sucursal.
              </Text>
            </View>
          ) : (
            <FlatList
              data={pagosSalarios}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const rol = item.empleados?.rol || 'cajero';
                const rolColor = ROL_COLORES[rol] || ROL_COLORES.cajero;
                return (
                  <View style={styles.cardItem}>
                    <View style={styles.cardHeader}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>
                          {item.empleados?.nombre?.charAt(0).toUpperCase() || '👤'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>
                          {item.empleados?.nombre || 'Empleado Desconocido'}
                        </Text>
                        <View style={styles.metaRow}>
                          <View style={[styles.badge, { backgroundColor: rolColor.bg }]}>
                            <Text style={[styles.badgeText, { color: rolColor.text }]}>
                              {rol.toUpperCase()}
                            </Text>
                          </View>
                          {item.empleados?.sucursales?.nombre && (
                            <Text style={styles.metaText}>
                              📍 {item.empleados.sucursales.nombre}
                            </Text>
                          )}
                        </View>
                      </View>

                      <View style={styles.amountBox}>
                        <Text style={styles.amountValue}>Gs. {formatPrice(item.monto)}</Text>
                        <Text style={styles.amountSub}>Período: {item.periodo}</Text>
                      </View>
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.footerInfo}>
                        📅 {item.fecha_pago} · 💳 {item.metodo_pago?.toUpperCase()}
                      </Text>
                      {item.notas ? (
                        <Text style={styles.notesText} numberOfLines={1}>
                          📝 {item.notas}
                        </Text>
                      ) : null}
                      <TouchableOpacity
                        style={styles.deleteMiniBtn}
                        onPress={() =>
                          setItemAEliminar({
                            tipo: 'salario',
                            id: item.id,
                            nombre: `Salario ${item.periodo} de ${item.empleados?.nombre}`,
                          })
                        }
                      >
                        <Text style={styles.deleteMiniBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      ) : (
        // ─── TAB PROVEEDORES & GASTOS ────────────────────────────────────────
        <View style={styles.tabContent}>
          <View style={styles.actionBar}>
            <View style={styles.filterGroup}>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  filtroEstadoProveedor === 'all' && styles.filterPillActive,
                ]}
                onPress={() => setFiltroEstadoProveedor('all')}
              >
                <Text style={styles.filterPillText}>Todos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  filtroEstadoProveedor === 'pendiente' && styles.filterPillActive,
                ]}
                onPress={() => setFiltroEstadoProveedor('pendiente')}
              >
                <Text style={styles.filterPillText}>Pendientes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  filtroEstadoProveedor === 'pagado' && styles.filterPillActive,
                ]}
                onPress={() => setFiltroEstadoProveedor('pagado')}
              >
                <Text style={styles.filterPillText}>Pagados</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                style={styles.actionBtnSecondary}
                onPress={() => setIsModalProveedorVisible(true)}
              >
                <Text style={styles.actionBtnSecondaryText}>+ Proveedor</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnPrimary}
                onPress={() => setIsModalGastoVisible(true)}
              >
                <Text style={styles.actionBtnPrimaryText}>+ Gasto</Text>
              </TouchableOpacity>
            </View>
          </View>

          {pagosProveedoresFiltrados.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🚚</Text>
              <Text style={styles.emptyTitle}>Sin gastos registrados</Text>
              <Text style={styles.emptySub}>
                Registra compras de mercaderías e insumos para tus locales.
              </Text>
            </View>
          ) : (
            <FlatList
              data={pagosProveedoresFiltrados}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const esPendiente = item.estado === 'pendiente';
                return (
                  <View style={styles.cardItem}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.itemTitle}>
                            {item.proveedores?.nombre || 'Proveedor'}
                          </Text>
                          <View style={styles.catBadge}>
                            <Text style={styles.catBadgeText}>
                              {item.proveedores?.categoria || 'Insumos'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.conceptoText}>{item.concepto}</Text>
                        {item.proveedores?.ruc ? (
                          <Text style={styles.metaText}>RUC: {item.proveedores.ruc}</Text>
                        ) : null}
                      </View>

                      <View style={styles.amountBox}>
                        <Text style={styles.amountValue}>Gs. {formatPrice(item.monto)}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            esPendiente ? styles.statusBadgePending : styles.statusBadgePaid,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              esPendiente
                                ? styles.statusBadgeTextPending
                                : styles.statusBadgeTextPaid,
                            ]}
                          >
                            {esPendiente ? 'PENDIENTE' : 'PAGADO'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.footerInfo}>
                        📅 {item.fecha} · 💳 {item.metodo_pago?.toUpperCase()}
                        {item.sucursales?.nombre ? ` · 📍 ${item.sucursales.nombre}` : ''}
                      </Text>

                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        {esPendiente && (
                          <TouchableOpacity
                            style={styles.payNowBtn}
                            onPress={() => handleMarcarPagado(item.id)}
                          >
                            <Text style={styles.payNowBtnText}>✓ Marcar Pagado</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.deleteMiniBtn}
                          onPress={() =>
                            setItemAEliminar({
                              tipo: 'gasto',
                              id: item.id,
                              nombre: `${item.concepto} de ${item.proveedores?.nombre}`,
                            })
                          }
                        >
                          <Text style={styles.deleteMiniBtnText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      {/* ── MODAL: REGISTRAR SALARIO ────────────────────────────────────────── */}
      <Modal
        visible={isModalSalarioVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalSalarioVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Pago de Salario</Text>
              <TouchableOpacity onPress={() => setIsModalSalarioVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {/* Selector de empleado */}
              <Text style={styles.fieldLabel}>Seleccionar Empleado *</Text>
              <View style={styles.selectorGrid}>
                {empleados.map((emp) => {
                  const isSelected = formSalario.empleadoId === emp.id;
                  return (
                    <TouchableOpacity
                      key={emp.id}
                      style={[
                        styles.selectorPill,
                        isSelected && styles.selectorPillSelected,
                      ]}
                      onPress={() => handleSeleccionarEmpleado(emp)}
                    >
                      <Text
                        style={[
                          styles.selectorPillText,
                          isSelected && styles.selectorPillTextSelected,
                        ]}
                      >
                        {emp.nombre} ({emp.rol})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Monto */}
              <Text style={styles.fieldLabel}>Monto a Pagar (Gs.) *</Text>
              <TextInput
                style={styles.fieldInput}
                keyboardType="numeric"
                placeholder="Ej. 2500000"
                placeholderTextColor={COLORS.textMuted}
                value={formSalario.monto}
                onChangeText={(text) =>
                  setFormSalario((prev) => ({ ...prev, monto: text }))
                }
              />

              {/* Período */}
              <Text style={styles.fieldLabel}>Período / Mes *</Text>
              <View style={styles.selectorGrid}>
                {pagoService.getPeriodosDisponibles().slice(0, 6).map((per) => {
                  const isSelected = formSalario.periodo === per.value;
                  return (
                    <TouchableOpacity
                      key={per.value}
                      style={[
                        styles.selectorPill,
                        isSelected && styles.selectorPillSelected,
                      ]}
                      onPress={() =>
                        setFormSalario((prev) => ({ ...prev, periodo: per.value }))
                      }
                    >
                      <Text
                        style={[
                          styles.selectorPillText,
                          isSelected && styles.selectorPillTextSelected,
                        ]}
                      >
                        {per.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Método de pago */}
              <Text style={styles.fieldLabel}>Forma de Pago</Text>
              <View style={styles.selectorGrid}>
                {METODOS_PAGO_EGRESO.map((m) => {
                  const isSelected = formSalario.metodoPago === m.value;
                  return (
                    <TouchableOpacity
                      key={m.value}
                      style={[
                        styles.selectorPill,
                        isSelected && styles.selectorPillSelected,
                      ]}
                      onPress={() =>
                        setFormSalario((prev) => ({ ...prev, metodoPago: m.value }))
                      }
                    >
                      <Text
                        style={[
                          styles.selectorPillText,
                          isSelected && styles.selectorPillTextSelected,
                        ]}
                      >
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Notas */}
              <Text style={styles.fieldLabel}>Notas u Observaciones</Text>
              <TextInput
                style={[styles.fieldInput, { height: 70 }]}
                placeholder="Ej: Incluye bono por puntualidad"
                placeholderTextColor={COLORS.textMuted}
                multiline
                value={formSalario.notas}
                onChangeText={(text) =>
                  setFormSalario((prev) => ({ ...prev, notas: text }))
                }
              />

              <TouchableOpacity
                style={[styles.submitButton, savingSalario && styles.submitButtonDisabled]}
                disabled={savingSalario}
                onPress={handleGuardarSalario}
              >
                {savingSalario ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Confirmar Pago de Salario</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL: NUEVO PROVEEDOR ─────────────────────────────────────────── */}
      <Modal
        visible={isModalProveedorVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalProveedorVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Alta de Proveedor</Text>
              <TouchableOpacity onPress={() => setIsModalProveedorVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Nombre o Razón Social *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ej: Frigorífico Guaraní"
                placeholderTextColor={COLORS.textMuted}
                value={formProveedor.nombre}
                onChangeText={(text) =>
                  setFormProveedor((prev) => ({ ...prev, nombre: text }))
                }
              />

              <Text style={styles.fieldLabel}>RUC (Opcional)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ej: 80012345-6"
                placeholderTextColor={COLORS.textMuted}
                value={formProveedor.ruc}
                onChangeText={(text) =>
                  setFormProveedor((prev) => ({ ...prev, ruc: text }))
                }
              />

              <Text style={styles.fieldLabel}>Teléfono / Contacto</Text>
              <TextInput
                style={styles.fieldInput}
                keyboardType="phone-pad"
                placeholder="Ej: 0981 123 456"
                placeholderTextColor={COLORS.textMuted}
                value={formProveedor.telefono}
                onChangeText={(text) =>
                  setFormProveedor((prev) => ({ ...prev, telefono: text }))
                }
              />

              <Text style={styles.fieldLabel}>Rubro / Categoría</Text>
              <View style={styles.selectorGrid}>
                {CATEGORIAS_PROVEEDOR.map((cat) => {
                  const isSelected = formProveedor.categoria === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.selectorPill,
                        isSelected && styles.selectorPillSelected,
                      ]}
                      onPress={() =>
                        setFormProveedor((prev) => ({ ...prev, categoria: cat }))
                      }
                    >
                      <Text
                        style={[
                          styles.selectorPillText,
                          isSelected && styles.selectorPillTextSelected,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.submitButton, savingProveedor && styles.submitButtonDisabled]}
                disabled={savingProveedor}
                onPress={handleGuardarProveedor}
              >
                {savingProveedor ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Guardar Proveedor</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL: REGISTRAR GASTO / FACTURA ───────────────────────────────── */}
      <Modal
        visible={isModalGastoVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalGastoVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Factura / Gasto</Text>
              <TouchableOpacity onPress={() => setIsModalGastoVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {/* Proveedor */}
              <Text style={styles.fieldLabel}>Seleccionar Proveedor *</Text>
              {proveedores.length === 0 ? (
                <Text style={styles.warningText}>
                  ⚠️ No hay proveedores cargados. Da de alta uno primero con el botón "+ Proveedor".
                </Text>
              ) : (
                <View style={styles.selectorGrid}>
                  {proveedores.map((prov) => {
                    const isSelected = formGasto.proveedorId === prov.id;
                    return (
                      <TouchableOpacity
                        key={prov.id}
                        style={[
                          styles.selectorPill,
                          isSelected && styles.selectorPillSelected,
                        ]}
                        onPress={() =>
                          setFormGasto((prev) => ({ ...prev, proveedorId: prov.id }))
                        }
                      >
                        <Text
                          style={[
                            styles.selectorPillText,
                            isSelected && styles.selectorPillTextSelected,
                          ]}
                        >
                          {prov.nombre} ({prov.categoria})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Concepto */}
              <Text style={styles.fieldLabel}>Concepto o Factura N° *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Ej: Factura 001-002-8493 - 50kg carne smash"
                placeholderTextColor={COLORS.textMuted}
                value={formGasto.concepto}
                onChangeText={(text) =>
                  setFormGasto((prev) => ({ ...prev, concepto: text }))
                }
              />

              {/* Monto */}
              <Text style={styles.fieldLabel}>Monto del Gasto (Gs.) *</Text>
              <TextInput
                style={styles.fieldInput}
                keyboardType="numeric"
                placeholder="Ej: 1450000"
                placeholderTextColor={COLORS.textMuted}
                value={formGasto.monto}
                onChangeText={(text) =>
                  setFormGasto((prev) => ({ ...prev, monto: text }))
                }
              />

              {/* Estado */}
              <Text style={styles.fieldLabel}>Estado de la Factura</Text>
              <View style={styles.selectorGrid}>
                {ESTADOS_PAGO_PROVEEDOR.map((est) => {
                  const isSelected = formGasto.estado === est.value;
                  return (
                    <TouchableOpacity
                      key={est.value}
                      style={[
                        styles.selectorPill,
                        isSelected && styles.selectorPillSelected,
                      ]}
                      onPress={() =>
                        setFormGasto((prev) => ({ ...prev, estado: est.value }))
                      }
                    >
                      <Text
                        style={[
                          styles.selectorPillText,
                          isSelected && styles.selectorPillTextSelected,
                        ]}
                      >
                        {est.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Método */}
              <Text style={styles.fieldLabel}>Forma de Pago</Text>
              <View style={styles.selectorGrid}>
                {METODOS_PAGO_EGRESO.map((m) => {
                  const isSelected = formGasto.metodoPago === m.value;
                  return (
                    <TouchableOpacity
                      key={m.value}
                      style={[
                        styles.selectorPill,
                        isSelected && styles.selectorPillSelected,
                      ]}
                      onPress={() =>
                        setFormGasto((prev) => ({ ...prev, metodoPago: m.value }))
                      }
                    >
                      <Text
                        style={[
                          styles.selectorPillText,
                          isSelected && styles.selectorPillTextSelected,
                        ]}
                      >
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.submitButton, savingGasto && styles.submitButtonDisabled]}
                disabled={savingGasto || proveedores.length === 0}
                onPress={handleGuardarGasto}
              >
                {savingGasto ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Registrar Gasto</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL: CONFIRMAR ELIMINACIÓN ───────────────────────────────────── */}
      <Modal
        visible={!!itemAEliminar}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setItemAEliminar(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>¿Eliminar Registro?</Text>
            <Text style={styles.confirmMessage}>
              ¿Estás seguro de que deseas eliminar permanentemente:
              {"\n\n"}
              <Text style={{ color: COLORS.text, fontWeight: '700' }}>
                {itemAEliminar?.nombre}
              </Text>
              ? Esta acción no se puede deshacer.
            </Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnCancel]}
                onPress={() => setItemAEliminar(null)}
              >
                <Text style={styles.confirmBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnDelete]}
                onPress={handleConfirmarEliminacion}
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

// ─── ESTILOS ─────────────────────────────────────────────────────────────────
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
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.primary,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  closeBtnText: {
    color: COLORS.textMuted,
    fontSize: 22,
    fontWeight: '700',
  },
  statusBar: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  statusBarSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusBarError: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusBarText: {
    color: COLORS.textLight,
    fontWeight: '600',
    fontSize: 13,
  },
  sucursalBar: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 6,
  },
  sucursalList: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  sucursalPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sucursalPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sucursalPillText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  sucursalPillTextActive: {
    color: COLORS.textLight,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    padding: 6,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
  },
  tabButtonActive: {
    backgroundColor: COLORS.cardElevated,
  },
  tabButtonText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  kpiContainer: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  kpiRow: {
    flexDirection: 'row',
  },
  kpiCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  kpiLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginVertical: 4,
  },
  kpiSub: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  actionBtnPrimary: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
  },
  actionBtnPrimaryText: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtnSecondary: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
  },
  actionBtnSecondaryText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 13,
  },
  filterGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPillActive: {
    backgroundColor: COLORS.cardElevated,
    borderColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  cardItem: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.cardElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  catBadge: {
    backgroundColor: 'rgba(99, 179, 237, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  catBadgeText: {
    color: '#63B3ED',
    fontSize: 10,
    fontWeight: '700',
  },
  conceptoText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  amountBox: {
    alignItems: 'flex-end',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  amountSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
  },
  statusBadgePaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusBadgePending: {
    backgroundColor: 'rgba(242, 169, 59, 0.15)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadgeTextPaid: {
    color: COLORS.success,
  },
  statusBadgeTextPending: {
    color: COLORS.secondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
  },
  footerInfo: {
    fontSize: 11,
    color: COLORS.textMuted,
    flex: 1,
  },
  notesText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    maxWidth: 120,
    marginRight: 6,
  },
  payNowBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  payNowBtnText: {
    color: COLORS.success,
    fontSize: 11,
    fontWeight: '700',
  },
  deleteMiniBtn: {
    padding: 4,
  },
  deleteMiniBtnText: {
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  emptySub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },

  // ─── MODALES ───────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.primary,
  },
  modalCloseText: {
    color: COLORS.textMuted,
    fontSize: 22,
    fontWeight: '700',
  },
  modalScroll: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    fontWeight: '700',
    marginTop: SPACING.sm,
    marginBottom: 6,
  },
  fieldInput: {
    height: 46,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    color: COLORS.text,
    fontSize: 14,
  },
  selectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  selectorPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectorPillSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  selectorPillText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  selectorPillTextSelected: {
    color: COLORS.textLight,
    fontWeight: '700',
  },
  warningText: {
    color: COLORS.secondary,
    fontSize: 12,
    marginBottom: SPACING.sm,
    lineHeight: 16,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    ...TYPOGRAPHY.button,
  },

  // Confirm delete
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  confirmCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  confirmTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.danger,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  confirmMessage: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
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
});

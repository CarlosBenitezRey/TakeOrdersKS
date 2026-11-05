import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  StatusBar,
  Modal,
  Image,
  Animated,
  Easing,
} from 'react-native';
import balanceService from '../../services/BalanceService';
import productService from '../../services/ProductService';
import authService from '../../services/AuthService';
import {
  COLORS,
  POS_COLORS,
  SPACING,
  BORDER_RADIUS,
  TYPOGRAPHY,
} from '../../theme/theme';
import { APP_ICONS } from '../../theme/assets';
import PersonalScreen from './PersonalScreen';
import PagosScreen from './PagosScreen';
import FacturasScreen from './FacturasScreen';
import MenuCmsScreen from './MenuCmsScreen';

const formatPrice = (value) => Number(value || 0).toLocaleString('es-AR');

const PERIODOS = [
  { id: 'hoy', label: 'Hoy (Arqueo)' },
  { id: 'semana', label: '7 Días' },
  { id: 'mes', label: 'Este Mes' },
  { id: 'historico', label: 'Histórico' },
];

export default function BalanceScreen({ userProfile, onClose }) {
  const [balance, setBalance] = useState(null);
  const [periodo, setPeriodo] = useState('mes');
  const [activeTab, setActiveTab] = useState('estado_resultados'); // 'estado_resultados' | 'arqueo_caja' | 'ventas_productos'
  const [sucursales, setSucursales] = useState([]);
  const [selectedSucursalId, setSelectedSucursalId] = useState(
    userProfile?.sucursal_id || 'all'
  );
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  // Estados del Menú Lateral Dual (para el rol Admin) y Modales Administrativos
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [drawerActiveTab, setDrawerActiveTab] = useState('finanzas');
  const [isPersonalVisible, setIsPersonalVisible] = useState(false);
  const [isPagosVisible, setIsPagosVisible] = useState(false);
  const [isFacturasVisible, setIsFacturasVisible] = useState(false);
  const [isCmsVisible, setIsCmsVisible] = useState(false);

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
        duration: 240,
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
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsDrawerVisible(false);
      if (typeof callback === 'function') {
        callback();
      }
    });
  };

  const esAdminGlobal = !userProfile?.sucursal_id;

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const [resBalance, resSucursales] = await Promise.all([
        balanceService.obtenerBalanceFinanciero({
          periodo,
          sucursalId: selectedSucursalId,
          userSucursalId: userProfile?.sucursal_id || null,
        }),
        productService.getSucursales(),
      ]);

      setBalance(resBalance);
      setSucursales(resSucursales);
    } catch (error) {
      console.error('Error cargando balance financiero:', error);
      setStatusMessage({ text: 'Error al calcular balance financiero', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [periodo, selectedSucursalId, userProfile?.sucursal_id]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const kpis = balance?.kpis || {
    ingresosTotales: 0,
    totalEgresos: 0,
    utilidadNeta: 0,
    margenOperativo: 0,
    totalPedidos: 0,
    ticketPromedio: 0,
  };

  const estadoResultados = balance?.estadoResultados || {
    ingresosTotales: 0,
    egresosSalarios: 0,
    egresosProveedores: 0,
    totalEgresos: 0,
    utilidadNeta: 0,
    porcentajeSalarios: 0,
    porcentajeInsumos: 0,
    deudaProveedoresPendiente: 0,
  };

  const arqueo = balance?.arqueoCaja || {
    ventasEfectivo: 0,
    totalSalidasEfectivo: 0,
    saldoEsperadoCajaFisica: 0,
    totalCobrosElectronicos: 0,
    ventasTarjeta: 0,
    ventasTransferencia: 0,
    ventasPendiente: 0,
  };

  const esGanancia = kpis.utilidadNeta >= 0;

  // Pestañas del Menú Lateral Dual para rol Admin (todas las opciones excepto Cocina y Cajero)
  const drawerTabs = [
    {
      id: 'finanzas',
      label: 'Finanzas',
      icon: APP_ICONS.statistics,
      submenu: {
        mainTitle: 'Balance y Finanzas',
        mainAction: () => {
          setActiveTab('estado_resultados');
          closeDrawer();
        },
        items: [
          {
            label: 'Métricas de Ventas',
            action: () => {
              setActiveTab('estado_resultados');
              closeDrawer();
            },
          },
          {
            label: 'Arqueo de Caja',
            action: () => {
              setActiveTab('arqueo_caja');
              closeDrawer();
            },
          },
          {
            label: 'Desglose de Cobros',
            action: () => {
              setActiveTab('ventas_productos');
              closeDrawer();
            },
          },
        ],
      },
    },
    {
      id: 'personal',
      label: 'Personal',
      icon: APP_ICONS.userDefault,
      submenu: {
        mainTitle: 'Gestión de Personal',
        mainAction: () => {
          closeDrawer(() => setIsPersonalVisible(true));
        },
        items: [
          {
            label: 'Plantel de Empleados',
            action: () => {
              closeDrawer(() => setIsPersonalVisible(true));
            },
          },
          {
            label: 'Registrar Empleado',
            action: () => {
              closeDrawer(() => setIsPersonalVisible(true));
            },
          },
          {
            label: 'Control de Salarios',
            action: () => {
              closeDrawer(() => setIsPersonalVisible(true));
            },
          },
        ],
      },
    },
    {
      id: 'compras',
      label: 'Compras',
      icon: APP_ICONS.statistics,
      submenu: {
        mainTitle: 'Pagos y Proveedores',
        mainAction: () => {
          closeDrawer(() => setIsPagosVisible(true));
        },
        items: [
          {
            label: 'Facturas y Comprobantes',
            action: () => {
              closeDrawer(() => setIsFacturasVisible(true));
            },
          },
          {
            label: 'Directorio de Proveedores',
            action: () => {
              closeDrawer(() => setIsPagosVisible(true));
            },
          },
          {
            label: 'Registro de Gastos',
            action: () => {
              closeDrawer(() => setIsPagosVisible(true));
            },
          },
        ],
      },
    },
    {
      id: 'catalogo',
      label: 'Catálogo',
      icon: APP_ICONS.hamburguesa || APP_ICONS.todos,
      submenu: {
        mainTitle: 'CMS Menú y Precios',
        mainAction: () => {
          closeDrawer(() => setIsCmsVisible(true));
        },
        items: [
          {
            label: 'Modificar Platos y Precios',
            action: () => {
              closeDrawer(() => setIsCmsVisible(true));
            },
          },
          {
            label: 'Administrar Categorías',
            action: () => {
              closeDrawer(() => setIsCmsVisible(true));
            },
          },
          {
            label: 'Control de Disponibilidad',
            action: () => {
              closeDrawer(() => setIsCmsVisible(true));
            },
          },
        ],
      },
    },
    {
      id: 'cuenta',
      label: 'Cuenta',
      icon: APP_ICONS.admin,
      submenu: {
        mainTitle: userProfile?.nombre || 'Mi Perfil',
        mainSubtitle: userProfile?.rol?.toUpperCase() || 'ADMIN',
        mainAction: null,
        items: [
          {
            label: `Sucursal: ${userProfile?.sucursales?.nombre || 'Global / Central'}`,
            action: null,
          },
          ...(userProfile?.email
            ? [
                {
                  label: userProfile.email,
                  action: null,
                },
              ]
            : []),
          {
            label: 'Cerrar Sesión',
            danger: true,
            action: () => {
              closeDrawer(() => authService.logout());
            },
          },
        ],
      },
    },
  ];

  const currentDrawerTab =
    drawerTabs.find((t) => t.id === drawerActiveTab) || drawerTabs[0];
  const currentSubmenu = currentDrawerTab.submenu;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={POS_COLORS.canvas} />

      {/* ─── Encabezado ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Balance & Finanzas</Text>
          <Text style={styles.headerSubtitle}>
            {onClose
              ? 'Control integral de ingresos, egresos y utilidades'
              : `${userProfile?.nombre || 'Admin'} (${userProfile?.rol || 'admin'})`}
          </Text>
        </View>
        {onClose ? (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕ Cerrar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.menuButton} onPress={openDrawer}>
            <Text style={styles.menuButtonText}>☰ Menú</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Selector de Período ─────────────────────────────────────────────── */}
      <View style={styles.periodosContainer}>
        {PERIODOS.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[
              styles.periodoChip,
              periodo === p.id && styles.periodoChipActive,
            ]}
            onPress={() => setPeriodo(p.id)}
          >
            <Text
              style={[
                styles.periodoChipText,
                periodo === p.id && styles.periodoChipTextActive,
              ]}
            >
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── Selector de Sucursal (Admin Global) ──────────────────────────────── */}
      {esAdminGlobal && sucursales.length > 0 && (
        <View style={styles.sucursalFilterContainer}>
          <Text style={styles.sucursalFilterLabel}>Local:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.sucursalChip,
                selectedSucursalId === 'all' && styles.sucursalChipActive,
              ]}
              onPress={() => setSelectedSucursalId('all')}
            >
              <Text
                style={[
                  styles.sucursalChipText,
                  selectedSucursalId === 'all' && styles.sucursalChipTextActive,
                ]}
              >
                Todas las Sucursales
              </Text>
            </TouchableOpacity>
            {sucursales.map((suc) => (
              <TouchableOpacity
                key={suc.id}
                style={[
                  styles.sucursalChip,
                  selectedSucursalId === suc.id && styles.sucursalChipActive,
                ]}
                onPress={() => setSelectedSucursalId(suc.id)}
              >
                <Text
                  style={[
                    styles.sucursalChipText,
                    selectedSucursalId === suc.id && styles.sucursalChipTextActive,
                  ]}
                >
                  {suc.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={POS_COLORS.primary} />
          <Text style={styles.loadingText}>Consolidando balances contables...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={{ paddingBottom: 50 }}
        >
          {/* ─── 4 Tarjetas KPI Principales ─────────────────────────────────── */}
          <View style={styles.kpiGrid}>
            {/* 1. Ingresos */}
            <View style={[styles.kpiCard, styles.kpiCardIngresos]}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel}>INGRESOS (VENTAS)</Text>
                <Text style={styles.kpiIcon}>📈</Text>
              </View>
              <Text style={[styles.kpiValue, { color: '#10B981' }]}>
                Gs. {formatPrice(kpis.ingresosTotales)}
              </Text>
              <Text style={styles.kpiSubtext}>
                {kpis.totalPedidos} pedidos registrados
              </Text>
            </View>

            {/* 2. Egresos */}
            <View style={[styles.kpiCard, styles.kpiCardEgresos]}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel}>EGRESOS TOTALES</Text>
                <Text style={styles.kpiIcon}>📉</Text>
              </View>
              <Text style={[styles.kpiValue, { color: '#EF4444' }]}>
                Gs. {formatPrice(kpis.totalEgresos)}
              </Text>
              <Text style={styles.kpiSubtext}>Nómina + Insumos de proveedores</Text>
            </View>

            {/* 3. Utilidad Neta */}
            <View
              style={[
                styles.kpiCard,
                esGanancia ? styles.kpiCardUtilidadPos : styles.kpiCardUtilidadNeg,
              ]}
            >
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel}>UTILIDAD NETA</Text>
                <View
                  style={[
                    styles.estadoBadge,
                    esGanancia ? styles.estadoBadgePos : styles.estadoBadgeNeg,
                  ]}
                >
                  <Text
                    style={[
                      styles.estadoBadgeText,
                      esGanancia
                        ? styles.estadoBadgeTextPos
                        : styles.estadoBadgeTextNeg,
                    ]}
                  >
                    {esGanancia ? 'SUPERÁVIT' : 'DÉFICIT'}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.kpiValue,
                  { color: esGanancia ? '#34D399' : '#F87171' },
                ]}
              >
                Gs. {formatPrice(kpis.utilidadNeta)}
              </Text>
              <Text style={styles.kpiSubtext}>
                Margen Operativo: {kpis.margenOperativo}%
              </Text>
            </View>

            {/* 4. Ticket Promedio */}
            <View style={[styles.kpiCard, styles.kpiCardPromedio]}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel}>TICKET PROMEDIO</Text>
                <Text style={styles.kpiIcon}>🧾</Text>
              </View>
              <Text style={[styles.kpiValue, { color: '#F59E0B' }]}>
                Gs. {formatPrice(kpis.ticketPromedio)}
              </Text>
              <Text style={styles.kpiSubtext}>Por orden atendida</Text>
            </View>
          </View>

          {/* ─── Pestañas de Navegación ────────────────────────────────────── */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'estado_resultados' && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab('estado_resultados')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'estado_resultados' && styles.tabButtonTextActive,
                ]}
              >
                📊 Estado de Resultados
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'arqueo_caja' && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab('arqueo_caja')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'arqueo_caja' && styles.tabButtonTextActive,
                ]}
              >
                💵 Arqueo de Caja
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'ventas_productos' && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab('ventas_productos')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'ventas_productos' && styles.tabButtonTextActive,
                ]}
              >
                🍔 Ventas & Top
              </Text>
            </TouchableOpacity>
          </View>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: ESTADO DE RESULTADOS                                         */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'estado_resultados' && (
            <View style={styles.sectionContainer}>
              {/* Barra comparativa Ingresos vs Egresos */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Proporción Ingresos vs Egresos</Text>
                {kpis.ingresosTotales > 0 || kpis.totalEgresos > 0 ? (
                  <View style={styles.proporcionContainer}>
                    <View style={styles.barraProporcionBg}>
                      <View
                        style={[
                          styles.barraProporcionIngresos,
                          {
                            flex:
                              kpis.ingresosTotales > 0 ? kpis.ingresosTotales : 0.001,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.barraProporcionEgresos,
                          {
                            flex:
                              kpis.totalEgresos > 0 ? kpis.totalEgresos : 0.001,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.proporcionLabelsRow}>
                      <View style={styles.legendItem}>
                        <View
                          style={[
                            styles.legendBullet,
                            { backgroundColor: '#10B981' },
                          ]}
                        />
                        <Text style={styles.legendText}>
                          Ventas (
                          {kpis.ingresosTotales + kpis.totalEgresos > 0
                            ? Math.round(
                                (kpis.ingresosTotales /
                                  (kpis.ingresosTotales + kpis.totalEgresos)) *
                                  100
                              )
                            : 0}
                          %)
                        </Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View
                          style={[
                            styles.legendBullet,
                            { backgroundColor: '#EF4444' },
                          ]}
                        />
                        <Text style={styles.legendText}>
                          Egresos (
                          {kpis.ingresosTotales + kpis.totalEgresos > 0
                            ? Math.round(
                                (kpis.totalEgresos /
                                  (kpis.ingresosTotales + kpis.totalEgresos)) *
                                  100
                              )
                            : 0}
                          %)
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>Sin movimientos en este período</Text>
                )}
              </View>

              {/* Detalle Contable del Estado de Resultados */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Desglose del Ejercicio</Text>

                {/* Ingresos brutos */}
                <View style={styles.desgloseRow}>
                  <Text style={styles.desgloseLabel}>
                    (+) Ingresos Operativos por Ventas
                  </Text>
                  <Text style={[styles.desgloseMonto, { color: '#10B981' }]}>
                    Gs. {formatPrice(estadoResultados.ingresosTotales)}
                  </Text>
                </View>

                <View style={styles.divider} />

                {/* Egresos: Nómina */}
                <View style={styles.desgloseRow}>
                  <View>
                    <Text style={styles.desgloseLabel}>
                      (-) Salarios y Nómina de Personal
                    </Text>
                    <Text style={styles.desgloseSub}>
                      {estadoResultados.porcentajeSalarios}% del total de egresos
                    </Text>
                  </View>
                  <Text style={[styles.desgloseMonto, { color: '#F87171' }]}>
                    Gs. {formatPrice(estadoResultados.egresosSalarios)}
                  </Text>
                </View>

                {/* Egresos: Proveedores */}
                <View style={styles.desgloseRow}>
                  <View>
                    <Text style={styles.desgloseLabel}>
                      (-) Compras e Insumos (Proveedores)
                    </Text>
                    <Text style={styles.desgloseSub}>
                      {estadoResultados.porcentajeInsumos}% del total de egresos
                    </Text>
                  </View>
                  <Text style={[styles.desgloseMonto, { color: '#F87171' }]}>
                    Gs. {formatPrice(estadoResultados.egresosProveedores)}
                  </Text>
                </View>

                <View style={styles.dividerTotal} />

                {/* Subtotal Egresos */}
                <View style={styles.desgloseRow}>
                  <Text style={[styles.desgloseLabel, { fontWeight: '700' }]}>
                    (=) Total Costos & Gastos Operativos
                  </Text>
                  <Text style={[styles.desgloseMonto, { color: '#EF4444', fontWeight: '800' }]}>
                    Gs. {formatPrice(estadoResultados.totalEgresos)}
                  </Text>
                </View>

                <View style={styles.dividerTotal} />

                {/* Utilidad Neta Final */}
                <View style={[styles.desgloseRow, styles.desgloseRowDestacado]}>
                  <Text style={styles.utilidadNetaTitulo}>
                    (=) UTILIDAD NETA DEL PERÍODO
                  </Text>
                  <Text
                    style={[
                      styles.utilidadNetaValor,
                      { color: esGanancia ? '#34D399' : '#F87171' },
                    ]}
                  >
                    Gs. {formatPrice(estadoResultados.utilidadNeta)}
                  </Text>
                </View>
              </View>

              {/* Compromisos Pendientes a Proveedores (Cuentas por pagar) */}
              {estadoResultados.deudaProveedoresPendiente > 0 && (
                <View style={styles.alertaDeudaCard}>
                  <Text style={styles.alertaDeudaIcon}>⚠️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertaDeudaTitulo}>
                      Cuentas Pendientes de Pago a Proveedores
                    </Text>
                    <Text style={styles.alertaDeudaTexto}>
                      Tienes facturas en estado 'Pendiente' por un total de{' '}
                      <Text style={{ fontWeight: '800', color: '#F59E0B' }}>
                        Gs. {formatPrice(estadoResultados.deudaProveedoresPendiente)}
                      </Text>
                      . Puedes liquidarlas desde el módulo 'Pagos y Proveedores'.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: ARQUEO DE CAJA (CIERRE DE TURNO)                             */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'arqueo_caja' && (
            <View style={styles.sectionContainer}>
              {/* Tarjeta de Gaveta de Efectivo Físico */}
              <View style={[styles.card, styles.cardCajaFisica]}>
                <View style={styles.cardHeaderWithBadge}>
                  <Text style={styles.cardTitle}>💵 Gaveta de Efectivo Físico</Text>
                  <View style={styles.cajaBadge}>
                    <Text style={styles.cajaBadgeText}>CIERRE EN VIVO</Text>
                  </View>
                </View>

                <Text style={styles.cajaSubtext}>
                  Saldo físico teórico que debe encontrarse en la caja registradora:
                </Text>

                {/* Saldo esperado grande */}
                <View style={styles.saldoCajaBox}>
                  <Text style={styles.saldoCajaLabel}>EFECTIVO ESPERADO EN CAJA</Text>
                  <Text style={styles.saldoCajaMonto}>
                    Gs. {formatPrice(arqueo.saldoEsperadoCajaFisica)}
                  </Text>
                </View>

                {/* Movimientos de efectivo */}
                <View style={styles.arqueoItemRow}>
                  <Text style={styles.arqueoItemLabel}>
                    (+) Cobranzas de Pedidos en Efectivo
                  </Text>
                  <Text style={[styles.arqueoItemMonto, { color: '#10B981' }]}>
                    Gs. {formatPrice(arqueo.ventasEfectivo)}
                  </Text>
                </View>

                <View style={styles.arqueoItemRow}>
                  <Text style={styles.arqueoItemLabel}>
                    (-) Egresos pagados en Efectivo (Caja Chica)
                  </Text>
                  <Text style={[styles.arqueoItemMonto, { color: '#EF4444' }]}>
                    Gs. {formatPrice(arqueo.totalSalidasEfectivo)}
                  </Text>
                </View>
              </View>

              {/* Cobros Digitales / Bancarios */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>💳 Cobros Electrónicos / Bancos</Text>
                <Text style={styles.cajaSubtext}>
                  Ingresos directos a cuentas bancarias y terminales POS:
                </Text>

                <View style={styles.desgloseRow}>
                  <Text style={styles.desgloseLabel}>Terminales POS (Tarjeta)</Text>
                  <Text style={[styles.desgloseMonto, { color: '#60A5FA' }]}>
                    Gs. {formatPrice(arqueo.ventasTarjeta)}
                  </Text>
                </View>

                <View style={styles.desgloseRow}>
                  <Text style={styles.desgloseLabel}>Transferencias / QR Bancario</Text>
                  <Text style={[styles.desgloseMonto, { color: '#A78BFA' }]}>
                    Gs. {formatPrice(arqueo.ventasTransferencia)}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.desgloseRow}>
                  <Text style={[styles.desgloseLabel, { fontWeight: '700' }]}>
                    Total en Bancos / Medios Digitales
                  </Text>
                  <Text style={[styles.desgloseMonto, { color: '#38BDF8', fontWeight: '800' }]}>
                    Gs. {formatPrice(arqueo.totalCobrosElectronicos)}
                  </Text>
                </View>
              </View>

              {/* Ventas a cobrar / Deuda */}
              {arqueo.ventasPendiente > 0 && (
                <View style={styles.card}>
                  <Text style={[styles.cardTitle, { color: '#F59E0B' }]}>
                    ⏳ Cobranzas Pendientes (A Deber)
                  </Text>
                  <View style={styles.desgloseRow}>
                    <Text style={styles.desgloseLabel}>
                      Ventas con método 'Pendiente'
                    </Text>
                    <Text style={[styles.desgloseMonto, { color: '#F59E0B' }]}>
                      Gs. {formatPrice(arqueo.ventasPendiente)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: VENTAS Y TOP PRODUCTOS                                       */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'ventas_productos' && (
            <View style={styles.sectionContainer}>
              {/* Top 5 Productos */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🏆 Top 5 Productos Más Vendidos</Text>
                {balance?.topProductos?.length === 0 ? (
                  <Text style={styles.emptyText}>No hay ventas en este período</Text>
                ) : (
                  balance.topProductos.map((p, idx) => (
                    <View key={p.nombre} style={styles.topProdRow}>
                      <View style={styles.topProdRankBadge}>
                        <Text style={styles.topProdRankText}>#{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1, marginHorizontal: SPACING.sm }}>
                        <Text style={styles.topProdNombre}>{p.nombre}</Text>
                        <Text style={styles.topProdSub}>
                          Gs. {formatPrice(p.total)} generados
                        </Text>
                      </View>
                      <View style={styles.topProdQtyBadge}>
                        <Text style={styles.topProdQtyText}>{p.cantidad} u.</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Últimas Transacciones del Período */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📜 Últimas Transacciones</Text>
                {balance?.transaccionesRecientes?.length === 0 ? (
                  <Text style={styles.emptyText}>Sin transacciones</Text>
                ) : (
                  balance.transaccionesRecientes.map((ped) => (
                    <View key={ped.id} style={styles.transaccionItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.transaccionId}>
                          Pedido #{ped.id.slice(0, 8).toUpperCase()}
                        </Text>
                        <Text style={styles.transaccionSub}>
                          {new Date(ped.created_at).toLocaleDateString()} ·{' '}
                          {new Date(ped.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {ped.mesa ? ` · Mesa ${ped.mesa}` : ''}
                          {ped.cliente ? ` · ${ped.cliente}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.transaccionMonto}>
                          Gs. {formatPrice(ped.total)}
                        </Text>
                        <Text style={styles.transaccionMetodo}>
                          {ped.metodo_pago?.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ─── Menú Lateral de 2 Columnas (para rol Admin) ─────────────────────── */}
      <Modal
        visible={isDrawerVisible}
        animationType="none"
        transparent={true}
        onRequestClose={() => closeDrawer()}
      >
        <View style={styles.drawerOverlay}>
          {/* Fondo oscuro animado */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: 'rgba(7, 19, 13, 0.55)',
                opacity: drawerBackdropAnim,
              },
            ]}
          />

          {/* Área de clic fuera del cajón para cerrarlo */}
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => closeDrawer()}
          />

          <Animated.View
            style={[
              styles.dualDrawerContainer,
              { transform: [{ translateX: drawerSlideAnim }] },
            ]}
          >
            <View style={styles.dualDrawerInner}>
              {/* ── COLUMNA 1: Rail Izquierdo de Categorías ── */}
              <View style={styles.railColumn}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.railScrollContent}
                >
                  {drawerTabs.map((tab) => {
                    const isSelected = drawerActiveTab === tab.id;
                    return (
                      <TouchableOpacity
                        key={tab.id}
                        style={[
                          styles.railTabItem,
                          isSelected && styles.railTabItemSelected,
                        ]}
                        onPress={() => setDrawerActiveTab(tab.id)}
                        activeOpacity={0.75}
                      >
                        <Image
                          source={tab.icon}
                          style={[
                            styles.railTabIcon,
                            { tintColor: isSelected ? POS_COLORS.primaryDark : POS_COLORS.muted },
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

              {/* ── COLUMNA 2: Submenú Derecho Contextual ── */}
              <View style={styles.submenuColumn}>
                <TouchableOpacity
                  style={styles.submenuCloseBtn}
                  onPress={() => closeDrawer()}
                >
                  <Text style={styles.submenuCloseText}>✕</Text>
                </TouchableOpacity>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.submenuScrollContent}
                >
                  {/* Botón / Píldora Destacada Principal */}
                  <TouchableOpacity
                    style={styles.submenuMainPill}
                    activeOpacity={currentSubmenu.mainAction ? 0.8 : 1}
                    onPress={() => {
                      if (currentSubmenu.mainAction) {
                        currentSubmenu.mainAction();
                      }
                    }}
                  >
                    <Text style={styles.submenuMainPillText}>
                      {currentSubmenu.mainTitle}
                    </Text>
                    {currentSubmenu.mainSubtitle ? (
                      <Text style={styles.submenuMainPillSub}>
                        {currentSubmenu.mainSubtitle}
                      </Text>
                    ) : null}
                  </TouchableOpacity>

                  {/* Lista de Sub-ítems */}
                  <View style={styles.submenuLinksList}>
                    {currentSubmenu.items.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.submenuLinkItem,
                          item.danger && styles.submenuLinkItemDanger,
                        ]}
                        activeOpacity={item.action ? 0.65 : 1}
                        onPress={() => {
                          if (item.action) item.action();
                        }}
                      >
                        <Text
                          style={[
                            styles.submenuLinkText,
                            item.danger && styles.submenuLinkDanger,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal de Gestión de Personal y Salarios */}
      <Modal
        visible={isPersonalVisible}
        animationType="slide"
        onRequestClose={() => {
          setIsPersonalVisible(false);
          cargarDatos();
        }}
      >
        <PersonalScreen
          userProfile={userProfile}
          onClose={() => {
            setIsPersonalVisible(false);
            cargarDatos();
          }}
        />
      </Modal>

      {/* Modal de Pagos y Proveedores */}
      <Modal
        visible={isPagosVisible}
        animationType="slide"
        onRequestClose={() => {
          setIsPagosVisible(false);
          cargarDatos();
        }}
      >
        <PagosScreen
          userProfile={userProfile}
          onClose={() => {
            setIsPagosVisible(false);
            cargarDatos();
          }}
        />
      </Modal>

      {/* Modal de Facturas y Comprobantes */}
      <Modal
        visible={isFacturasVisible}
        animationType="slide"
        onRequestClose={() => {
          setIsFacturasVisible(false);
          cargarDatos();
        }}
      >
        <FacturasScreen
          userProfile={userProfile}
          onClose={() => {
            setIsFacturasVisible(false);
            cargarDatos();
          }}
        />
      </Modal>

      {/* Modal de CMS Menú y Precios */}
      <Modal
        visible={isCmsVisible}
        animationType="slide"
        onRequestClose={() => setIsCmsVisible(false)}
      >
        <MenuCmsScreen
          userProfile={userProfile}
          onClose={() => setIsCmsVisible(false)}
        />
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
    paddingVertical: SPACING.md,
    backgroundColor: POS_COLORS.surfaceStrong,
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 18,
    fontWeight: '900',
    color: POS_COLORS.ink,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: POS_COLORS.muted,
    fontWeight: '600',
  },
  closeButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    backgroundColor: POS_COLORS.surface,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  closeButtonText: {
    ...TYPOGRAPHY.button,
    fontSize: 13,
    color: POS_COLORS.muted,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: COLORS.danger,
  },
  logoutButtonText: {
    color: COLORS.danger,
  },

  // Períodos
  periodosContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: POS_COLORS.surfaceStrong,
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.line,
    gap: 8,
  },
  periodoChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: POS_COLORS.surface,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  periodoChipActive: {
    backgroundColor: POS_COLORS.primarySoft,
    borderColor: POS_COLORS.primary,
  },
  periodoChipText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '600',
    color: POS_COLORS.muted,
  },
  periodoChipTextActive: {
    color: POS_COLORS.primaryDark,
    fontWeight: '800',
  },

  // Sucursales
  sucursalFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    backgroundColor: POS_COLORS.surfaceStrong,
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.line,
  },
  sucursalFilterLabel: {
    ...TYPOGRAPHY.caption,
    color: POS_COLORS.muted,
    fontWeight: '700',
    marginRight: SPACING.sm,
  },
  sucursalChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: POS_COLORS.surface,
    marginRight: 6,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  sucursalChipActive: {
    backgroundColor: POS_COLORS.primaryDark,
    borderColor: POS_COLORS.primaryDark,
  },
  sucursalChipText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: POS_COLORS.muted,
    fontWeight: '600',
  },
  sucursalChipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },

  // Contenido
  contentScroll: {
    flex: 1,
    padding: SPACING.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    color: POS_COLORS.muted,
    marginTop: SPACING.md,
  },

  // Grid de KPIs
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: SPACING.md,
  },
  kpiCard: {
    width: '48.5%',
    backgroundColor: POS_COLORS.surfaceStrong,
    padding: SPACING.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  kpiCardIngresos: {
    borderLeftWidth: 4,
    borderLeftColor: POS_COLORS.primary,
  },
  kpiCardEgresos: {
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  kpiCardUtilidadPos: {
    borderLeftWidth: 4,
    borderLeftColor: POS_COLORS.primary,
  },
  kpiCardUtilidadNeg: {
    borderLeftWidth: 4,
    borderLeftColor: '#F87171',
  },
  kpiCardPromedio: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontWeight: '800',
    color: POS_COLORS.muted,
    letterSpacing: 0.5,
  },
  kpiIcon: {
    fontSize: 14,
  },
  kpiValue: {
    ...TYPOGRAPHY.h2,
    fontSize: 16,
    fontWeight: '900',
    marginVertical: 4,
  },
  kpiSubtext: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    color: POS_COLORS.muted,
  },
  estadoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  estadoBadgePos: {
    backgroundColor: POS_COLORS.primarySoft,
  },
  estadoBadgeNeg: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
  },
  estadoBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  estadoBadgeTextPos: {
    color: POS_COLORS.primaryDark,
  },
  estadoBadgeTextNeg: {
    color: '#F87171',
  },

  // Pestañas
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: POS_COLORS.surfaceStrong,
    borderRadius: 14,
    padding: 4,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: POS_COLORS.primarySoft,
  },
  tabButtonText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '600',
    color: POS_COLORS.muted,
  },
  tabButtonTextActive: {
    color: POS_COLORS.primaryDark,
    fontWeight: '800',
  },

  // Tarjetas internas
  sectionContainer: {
    gap: 12,
  },
  card: {
    backgroundColor: POS_COLORS.surfaceStrong,
    padding: SPACING.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    ...TYPOGRAPHY.subtitle,
    fontSize: 14,
    fontWeight: '800',
    color: POS_COLORS.ink,
    marginBottom: SPACING.sm,
  },
  cardHeaderWithBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cajaBadge: {
    backgroundColor: POS_COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cajaBadgeText: {
    color: POS_COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '800',
  },
  cajaSubtext: {
    ...TYPOGRAPHY.caption,
    color: POS_COLORS.muted,
    marginBottom: SPACING.md,
  },

  // Barra de proporción
  proporcionContainer: {
    marginVertical: SPACING.xs,
  },
  barraProporcionBg: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: POS_COLORS.surface,
  },
  barraProporcionIngresos: {
    backgroundColor: POS_COLORS.primary,
  },
  barraProporcionEgresos: {
    backgroundColor: '#EF4444',
  },
  proporcionLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    ...TYPOGRAPHY.caption,
    color: POS_COLORS.muted,
    fontSize: 11,
  },

  // Desglose
  desgloseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  desgloseRowDestacado: {
    backgroundColor: POS_COLORS.primarySoft,
    padding: SPACING.sm,
    borderRadius: 10,
    marginTop: 4,
  },
  desgloseLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: POS_COLORS.ink,
    fontWeight: '600',
  },
  desgloseSub: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    color: POS_COLORS.muted,
  },
  desgloseMonto: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: POS_COLORS.line,
    marginVertical: 4,
  },
  dividerTotal: {
    height: 1.5,
    backgroundColor: POS_COLORS.line,
    marginVertical: 6,
  },
  utilidadNetaTitulo: {
    ...TYPOGRAPHY.subtitle,
    fontSize: 13,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  utilidadNetaValor: {
    ...TYPOGRAPHY.h2,
    fontSize: 16,
    fontWeight: '900',
  },

  // Alerta deuda
  alertaDeudaCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    padding: SPACING.md,
    borderRadius: 16,
    gap: SPACING.sm,
  },
  alertaDeudaIcon: {
    fontSize: 20,
  },
  alertaDeudaTitulo: {
    ...TYPOGRAPHY.subtitle,
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
    marginBottom: 2,
  },
  alertaDeudaTexto: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: POS_COLORS.muted,
    lineHeight: 16,
  },

  // Arqueo Caja
  cardCajaFisica: {
    borderLeftWidth: 4,
    borderLeftColor: POS_COLORS.primary,
  },
  saldoCajaBox: {
    backgroundColor: POS_COLORS.primarySoft,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  saldoCajaLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontWeight: '800',
    color: POS_COLORS.primaryDark,
    letterSpacing: 0.5,
  },
  saldoCajaMonto: {
    ...TYPOGRAPHY.h1,
    fontSize: 22,
    fontWeight: '900',
    color: POS_COLORS.primaryDark,
    marginTop: 4,
  },
  arqueoItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  arqueoItemLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: POS_COLORS.muted,
  },
  arqueoItemMonto: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    fontWeight: '700',
  },

  // Top Productos
  topProdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.line,
  },
  topProdRankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: POS_COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topProdRankText: {
    color: POS_COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
  topProdNombre: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    fontWeight: '700',
    color: POS_COLORS.ink,
  },
  topProdSub: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    color: POS_COLORS.muted,
  },
  topProdQtyBadge: {
    backgroundColor: POS_COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  topProdQtyText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: POS_COLORS.primaryDark,
  },

  // Transacciones
  transaccionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: POS_COLORS.line,
  },
  transaccionId: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  transaccionSub: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    color: POS_COLORS.muted,
  },
  transaccionMonto: {
    ...TYPOGRAPHY.body,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  transaccionMetodo: {
    ...TYPOGRAPHY.caption,
    fontSize: 9,
    color: POS_COLORS.muted,
  },
  emptyText: {
    ...TYPOGRAPHY.caption,
    color: POS_COLORS.muted,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  menuButton: {
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: 11,
    backgroundColor: POS_COLORS.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
  },
  menuButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  // ─── Dual-Column Lateral Drawer (Anclado a la derecha) ──
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  dualDrawerContainer: {
    flexDirection: 'row',
    backgroundColor: POS_COLORS.surfaceStrong,
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
    backgroundColor: POS_COLORS.primaryDark,
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
    borderRadius: 11,
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
});

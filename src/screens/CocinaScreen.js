import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { supabase } from '../services/supabase';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../theme/theme';

export default function CocinaScreen({ userProfile, onSwitchView }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarPedidos();

    // Subscribe to realtime changes on the pedidos table
    const subscription = supabase
      .channel('pedidos_channel')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'pedidos',
        },
        (payload) => {
          console.log('Cambio en pedidos:', payload);
          // Reload all orders to get the updated joined data
          cargarPedidos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const cargarPedidos = async () => {
    try {
      setLoading(true);
      // Fetch orders that are 'pendiente' or 'listo', including details and product info
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          *,
          detalle_pedido (
            cantidad,
            precio,
            productos (
              nombre
            )
          )
        `)
        .in('estado', ['pendiente', 'listo'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPedidos(data || []);
    } catch (error) {
      console.error('Error cargando pedidos:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const actualizarEstadoPedido = async (pedidoId, nuevoEstado) => {
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ estado: nuevoEstado })
        .eq('id', pedidoId);

      if (error) throw error;
      
      // The realtime subscription will trigger a reload, but we can do an optimistic update
      setPedidos(current => 
        current.map(p => p.id === pedidoId ? { ...p, estado: nuevoEstado } : p)
      );
      
      if (nuevoEstado === 'entregado') {
        // If it's delivered, we can remove it from the screen optimistically
        setPedidos(current => current.filter(p => p.id !== pedidoId));
      }
    } catch (error) {
      console.error('Error actualizando estado:', error.message);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error al cerrar sesión:', error.message);
    }
  };

  const pendientes = pedidos.filter(p => p.estado === 'pendiente');
  const listos = pedidos.filter(p => p.estado === 'listo');

  const renderPedido = ({ item }) => {
    const isPendiente = item.estado === 'pendiente';
    return (
      <View style={[styles.pedidoCard, !isPendiente && styles.pedidoCardListo]}>
        <View style={styles.pedidoHeader}>
          <Text style={styles.pedidoId}>Pedido #{item.id.toString().slice(0, 5)}</Text>
          <Text style={styles.pedidoTime}>{formatTime(item.created_at)}</Text>
        </View>

        <View style={styles.pedidoInfo}>
          {item.mesa ? <Text style={styles.pedidoMetaText}>📍 Mesa: {item.mesa}</Text> : null}
          {item.cliente ? <Text style={styles.pedidoMetaText}>👤 Cliente: {item.cliente}</Text> : null}
        </View>

        <View style={styles.divider} />

        <View style={styles.detallesContainer}>
          {item.detalle_pedido?.map((detalle, index) => (
            <View key={index} style={styles.detalleItem}>
              <Text style={styles.detalleCantidad}>{detalle.cantidad}x</Text>
              <Text style={styles.detalleNombre}>{detalle.productos?.nombre}</Text>
            </View>
          ))}
        </View>

        {item.notas ? (
          <View style={styles.notasContainer}>
            <Text style={styles.notasTitle}>📝 Notas:</Text>
            <Text style={styles.notasText}>{item.notas}</Text>
          </View>
        ) : null}

        <View style={styles.actionContainer}>
          {isPendiente ? (
            <TouchableOpacity 
              style={[styles.actionButton, styles.buttonListo]}
              onPress={() => actualizarEstadoPedido(item.id, 'listo')}
            >
              <Text style={styles.actionButtonText}>Marcar como Listo ✓</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.actionButton, styles.buttonEntregado]}
              onPress={() => actualizarEstadoPedido(item.id, 'entregado')}
            >
              <Text style={styles.actionButtonText}>Entregado (Quitar) 🚀</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Vista de Cocina 🧑‍🍳</Text>
          <Text style={styles.headerSubtitle}>Preparación de pedidos</Text>
        </View>
        <View style={styles.headerActions}>
          {onSwitchView && (
            <TouchableOpacity style={styles.headerActionButton} onPress={onSwitchView}>
              <Text style={styles.headerActionText}>Cajero 🔄</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.headerActionButton, styles.logoutButton]} 
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && pedidos.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loaderText}>Cargando pedidos...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Pendientes 🕒 ({pendientes.length})</Text>
          {pendientes.length === 0 ? (
            <Text style={styles.emptyText}>No hay pedidos pendientes</Text>
          ) : (
            <FlatList
              data={pendientes}
              keyExtractor={item => item.id.toString()}
              renderItem={renderPedido}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          )}

          <Text style={[styles.sectionTitle, styles.sectionTitleListo]}>Listos para Entregar ✅ ({listos.length})</Text>
          {listos.length === 0 ? (
            <Text style={styles.emptyText}>No hay pedidos listos esperando entrega</Text>
          ) : (
            <FlatList
              data={listos}
              keyExtractor={item => item.id.toString()}
              renderItem={renderPedido}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          )}
        </ScrollView>
      )}
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
    backgroundColor: COLORS.cardElevated,
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.primary,
    fontSize: 22,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerActionButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginLeft: 8,
    justifyContent: 'center',
  },
  headerActionText: {
    color: COLORS.text,
    fontWeight: '600',
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
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: SPACING.md,
    ...TYPOGRAPHY.bodyMuted,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl * 2,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.warning, // Orange/yellow for pending
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  sectionTitleListo: {
    color: COLORS.success,
    marginTop: SPACING.xl,
  },
  emptyText: {
    ...TYPOGRAPHY.bodyMuted,
    fontStyle: 'italic',
    marginBottom: SPACING.md,
  },
  listContainer: {
    gap: SPACING.md,
  },
  pedidoCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  pedidoCardListo: {
    borderLeftColor: COLORS.success,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  pedidoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  pedidoId: {
    ...TYPOGRAPHY.h3,
    fontWeight: '800',
  },
  pedidoTime: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  pedidoInfo: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  pedidoMetaText: {
    ...TYPOGRAPHY.caption,
    backgroundColor: COLORS.cardElevated,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  detallesContainer: {
    marginVertical: SPACING.sm,
  },
  detalleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  detalleCantidad: {
    ...TYPOGRAPHY.body,
    fontWeight: '800',
    color: COLORS.primary,
    width: 35,
  },
  detalleNombre: {
    ...TYPOGRAPHY.body,
    flex: 1,
  },
  notasContainer: {
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    marginTop: SPACING.sm,
  },
  notasTitle: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: COLORS.warning,
    marginBottom: 2,
  },
  notasText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
  },
  actionContainer: {
    marginTop: SPACING.md,
    alignItems: 'flex-end',
  },
  actionButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonListo: {
    backgroundColor: COLORS.success,
  },
  buttonEntregado: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: '700',
    ...TYPOGRAPHY.button,
  },
});

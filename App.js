import React, { useState, useEffect } from 'react';
import authService from './src/services/AuthService';
import LoginScreen from './src/screens/LoginScreen';
import CajeroScreen from './src/screens/CajeroScreen';
import CocinaScreen from './src/screens/CocinaScreen';
import DeliveryScreen from './src/screens/DeliveryScreen';
import BalanceScreen from './src/screens/admin/BalanceScreen';
import PremiumLoader from './src/components/PremiumLoader';

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentView, setCurrentView] = useState('cajero'); // 'cajero' | 'cocina' | 'delivery'

  useEffect(() => {
    // 1. Recuperar sesión activa al abrir la app
    authService.getSesionActual().then((session) => {
      setSession(session);
      if (session) {
        cargarPerfil(session.user.id, session.user.email);
      } else {
        setCheckingAuth(false);
      }
    });

    // 2. Escuchar cambios de estado de autenticación (login, logout, token refresh)
    const subscription = authService.suscribirCambiosAuth((_event, session) => {
      setSession(session);
      if (session) {
        cargarPerfil(session.user.id, session.user.email);
      } else {
        setUserProfile(null);
        setCheckingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const cargarPerfil = async (userId, userEmail) => {
    try {
      const perfil = await authService.cargarPerfil(userId, userEmail);
      setUserProfile(perfil);
    } catch (error) {
      console.warn('Error al cargar perfil en App.js:', error.message);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLoginSuccess = (perfil) => {
    setUserProfile(perfil);
  };

  // Splash loader mientras se recupera el estado de sesión
  if (checkingAuth) {
    return (
      <PremiumLoader
        fullScreen
        message="Preparando tu espacio de trabajo"
        detail="Validando sesión y permisos"
      />
    );
  }

  // Mostrar login si no hay perfil de usuario
  if (!userProfile) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const rolUsuario = userProfile?.rol?.toLowerCase()?.trim();

  // Rol admin: acceso exclusivo a finanzas y gestión (sin Cocina ni Cajero)
  if (rolUsuario === 'admin') {
    return <BalanceScreen userProfile={userProfile} />;
  }

  // Rol delivery / repartidor: acceso directo a DeliveryScreen
  if (rolUsuario === 'delivery' || rolUsuario === 'repartidor') {
    return <DeliveryScreen userProfile={userProfile} />;
  }

  // Rol cocina / cocinero: acceso directo a CocinaScreen (y puede ver Delivery)
  if (rolUsuario === 'cocina' || rolUsuario === 'cocinero') {
    return currentView === 'delivery' ? (
      <DeliveryScreen
        userProfile={userProfile}
        onNavigateCocina={() => setCurrentView('cocina')}
      />
    ) : (
      <CocinaScreen
        userProfile={userProfile}
        onNavigateDelivery={() => setCurrentView('delivery')}
      />
    );
  }

  if (currentView === 'cocina') {
    return (
      <CocinaScreen
        userProfile={userProfile}
        onSwitchView={() => setCurrentView('cajero')}
        onNavigateDelivery={() => setCurrentView('delivery')}
      />
    );
  }

  if (currentView === 'delivery') {
    return (
      <DeliveryScreen
        userProfile={userProfile}
        onNavigateCajero={() => setCurrentView('cajero')}
        onNavigateCocina={() => setCurrentView('cocina')}
      />
    );
  }

  return (
    <CajeroScreen
      userProfile={userProfile}
      onSwitchView={() => setCurrentView('cocina')}
      onNavigateDelivery={() => setCurrentView('delivery')}
    />
  );
}

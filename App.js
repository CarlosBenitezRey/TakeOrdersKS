import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import authService from './src/services/AuthService';
import LoginScreen from './src/screens/LoginScreen';
import CajeroScreen from './src/screens/CajeroScreen';
import CocinaScreen from './src/screens/CocinaScreen';
import { COLORS } from './src/theme/theme';

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentView, setCurrentView] = useState('cajero'); // 'cajero' | 'cocina'

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
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Mostrar login si no hay perfil de usuario
  if (!userProfile) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return currentView === 'cajero' ? (
    <CajeroScreen
      userProfile={userProfile}
      onSwitchView={() => setCurrentView('cocina')}
    />
  ) : (
    <CocinaScreen
      userProfile={userProfile}
      onSwitchView={() => setCurrentView('cajero')}
    />
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from './src/services/supabase';
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
    // 1. Recover active session on app launch
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id, session.user.email);
      } else {
        setCheckingAuth(false);
      }
    });

    // 2. Listen to authentication state changes (e.g. login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        // Pass email directly to avoid stale closure on the session state variable
        fetchUserProfile(session.user.id, session.user.email);
      } else {
        setUserProfile(null);
        setCheckingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch the cashier profile from the 'usuarios' table
  const fetchUserProfile = async (userId, userEmail) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setUserProfile(data);
      } else {
        const nombre = userEmail ? userEmail.split('@')[0] : 'Usuario';
        setUserProfile({
          id: userId,
          nombre,
          rol: 'cajero',
          email: userEmail || '',
          sucursal_id: null,
        });
      }
    } catch (error) {
      console.warn('Error fetching profile from "usuarios" table:', error.message);
      const nombre = userEmail ? userEmail.split('@')[0] : 'Usuario';
      setUserProfile({
        id: userId,
        nombre,
        rol: 'cajero',
        email: userEmail || '',
        sucursal_id: null,
      });
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLoginSuccess = (profile) => {
    setUserProfile(profile);
  };

  // Render a clean dark-themed splash loader while retrieving session state
  if (checkingAuth) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Render main app if user is logged in, else render LoginScreen
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

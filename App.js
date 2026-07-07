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
        fetchUserProfile(session.user.id);
      } else {
        setCheckingAuth(false);
      }
    });

    // 2. Listen to authentication state changes (e.g. login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setCheckingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch the cashier profile from the 'usuarios' table
  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.warn('Error fetching profile from "usuarios" table:', error.message);
      // Fallback: extract username prefix from email if profile table row doesn't exist yet
      const currentUser = supabase.auth.user ? supabase.auth.user() : null;
      const email = session?.user?.email || '';
      setUserProfile({
        id: userId,
        nombre: email ? email.split('@')[0] : 'Cajero',
        rol: 'cajero',
        email: email,
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

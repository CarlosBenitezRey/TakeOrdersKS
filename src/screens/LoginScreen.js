import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import authService from '../services/AuthService';
import { APP_VERSION_LABEL, PRODUCT_CONFIG } from '../config/productConfig';

const BRAND = PRODUCT_CONFIG.branding;

export default function LoginScreen({ onLoginSuccess }) {
  const { height } = useWindowDimensions();
  const compact = height < 720;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const clearError = () => {
    if (errorMessage) setErrorMessage('');
  };

  const handleLogin = async () => {
    if (loading) return;

    try {
      setLoading(true);
      setErrorMessage('');
      const { perfil } = await authService.login(email, password);
      onLoginSuccess(perfil);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenManageopy = () => {
    Linking.openURL(PRODUCT_CONFIG.attribution.url).catch(() => {
      setErrorMessage('No se pudo abrir el sitio de Manageopy.');
    });
  };

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND.background} />

      <View pointerEvents="none" style={styles.backgroundDecor}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.shell}>
            <View style={[styles.card, compact && styles.cardCompact]}>
              <View style={[styles.brandBlock, compact && styles.brandBlockCompact]}>
                <Image
                  accessibilityLabel={`Logo de ${PRODUCT_CONFIG.name}`}
                  resizeMode="contain"
                  source={PRODUCT_CONFIG.logo}
                  style={[styles.brandLogo, compact && styles.brandLogoCompact]}
                />
                <Text style={styles.productName}>{PRODUCT_CONFIG.name}</Text>
                <Text style={styles.productSubtitle}>{PRODUCT_CONFIG.subtitle}</Text>
              </View>

              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputWrap}>
                    <Text style={styles.inputLeading}>@</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="usuario@empresa.com"
                      placeholderTextColor="#8A958E"
                      value={email}
                      onChangeText={(value) => {
                        setEmail(value);
                        clearError();
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                      returnKeyType="next"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Contraseña</Text>
                  <View style={styles.inputWrap}>
                    <View style={styles.lockIcon}>
                      <View style={styles.lockShackle} />
                      <View style={styles.lockBody} />
                    </View>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      placeholder="••••••••"
                      placeholderTextColor="#8A958E"
                      value={password}
                      onChangeText={(value) => {
                        setPassword(value);
                        clearError();
                      }}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="current-password"
                      textContentType="password"
                      returnKeyType="go"
                      onSubmitEditing={handleLogin}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                      }
                      hitSlop={6}
                      onPress={() => setShowPassword((visible) => !visible)}
                      style={({ pressed }) => [
                        styles.passwordToggle,
                        pressed && styles.passwordTogglePressed,
                      ]}
                    >
                      <Text style={styles.passwordToggleText}>
                        {showPassword ? 'Ocultar' : 'Mostrar'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {errorMessage ? (
                  <View accessibilityRole="alert" style={styles.errorBanner}>
                    <View style={styles.errorIcon}>
                      <Text style={styles.errorIconText}>!</Text>
                    </View>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={handleLogin}
                  style={({ pressed }) => [
                    styles.submitButton,
                    pressed && !loading && styles.submitButtonPressed,
                    loading && styles.submitButtonDisabled,
                  ]}
                >
                  {loading ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.submitButtonText}>Verificando...</Text>
                    </>
                  ) : (
                    <Text style={styles.submitButtonText}>Ingresar al sistema</Text>
                  )}
                </Pressable>
              </View>

              <View style={styles.taglineRow}>
                <Text style={styles.taglineText}>· {PRODUCT_CONFIG.tagline} ·</Text>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{PRODUCT_CONFIG.attribution.prefix}</Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Abrir el sitio web de Manageopy"
                hitSlop={8}
                onPress={handleOpenManageopy}
                style={({ pressed }) => pressed && styles.manageopyLinkPressed}
              >
                <Text style={styles.manageopyLink}>{PRODUCT_CONFIG.attribution.label}</Text>
              </Pressable>
              <Text style={styles.footerText}>· {APP_VERSION_LABEL}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: BRAND.background,
    backgroundImage: 'linear-gradient(145deg, #07130D 0%, #183B2A 55%, #0B1D13 100%)',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  backgroundDecor: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glowTop: {
    position: 'absolute',
    width: 700,
    height: 700,
    top: -430,
    right: -160,
    borderRadius: 350,
    backgroundColor: 'rgba(90, 152, 112, 0.07)',
  },
  glowBottom: {
    position: 'absolute',
    width: 580,
    height: 580,
    bottom: -410,
    left: -190,
    borderRadius: 290,
    backgroundColor: 'rgba(53, 106, 75, 0.09)',
  },
  shell: {
    width: '100%',
    maxWidth: 420,
  },
  card: {
    width: '100%',
    paddingHorizontal: 40,
    paddingTop: 42,
    paddingBottom: 34,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.92)',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 28 },
    shadowOpacity: 0.34,
    shadowRadius: 48,
    elevation: 18,
  },
  cardCompact: {
    paddingTop: 26,
    paddingBottom: 24,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandBlockCompact: {
    marginBottom: 22,
  },
  brandLogo: {
    width: 178,
    height: 89,
    marginBottom: 10,
  },
  brandLogoCompact: {
    width: 146,
    height: 73,
    marginBottom: 7,
  },
  productName: {
    color: '#17231C',
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.9,
    textAlign: 'center',
  },
  productSubtitle: {
    marginTop: 7,
    color: '#6E7A72',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  form: {
    gap: 18,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: '#56645B',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  inputWrap: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: '#D9E1DB',
    borderRadius: 13,
    backgroundColor: '#F7F9F7',
  },
  inputLeading: {
    position: 'absolute',
    left: 15,
    zIndex: 2,
    color: '#718078',
    fontSize: 16,
    fontWeight: '800',
  },
  input: {
    flex: 1,
    height: 52,
    paddingLeft: 43,
    paddingRight: 14,
    color: '#17231C',
    fontSize: 14,
    fontWeight: '600',
  },
  passwordInput: {
    paddingRight: 84,
  },
  lockIcon: {
    position: 'absolute',
    left: 15,
    top: 16,
    width: 16,
    height: 20,
    zIndex: 2,
  },
  lockShackle: {
    position: 'absolute',
    top: 0,
    left: 4,
    width: 9,
    height: 9,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: '#718078',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  lockBody: {
    position: 'absolute',
    left: 1,
    bottom: 0,
    width: 15,
    height: 12,
    borderWidth: 1.5,
    borderColor: '#718078',
    borderRadius: 3,
  },
  passwordToggle: {
    position: 'absolute',
    right: 8,
    minWidth: 68,
    height: 36,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordTogglePressed: {
    backgroundColor: '#E6F0E9',
  },
  passwordToggleText: {
    color: BRAND.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F2C4C8',
    backgroundColor: '#FFF1F2',
  },
  errorIcon: {
    width: 18,
    height: 18,
    marginTop: 1,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#C83E49',
  },
  errorIconText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  errorText: {
    flex: 1,
    color: '#A52B35',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  submitButton: {
    minHeight: 52,
    marginTop: 3,
    paddingHorizontal: 18,
    borderRadius: 13,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
    backgroundColor: BRAND.primaryDark,
    shadowColor: BRAND.primaryDark,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.3,
    shadowRadius: 13,
    elevation: 5,
  },
  submitButtonPressed: {
    transform: [{ translateY: 1 }],
    shadowOpacity: 0.18,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  taglineRow: {
    marginTop: 25,
    alignItems: 'center',
  },
  taglineText: {
    color: '#738077',
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
  },
  footerText: {
    color: 'rgba(232, 242, 235, 0.62)',
    fontSize: 10,
    fontWeight: '600',
  },
  manageopyLink: {
    color: 'rgba(245, 250, 247, 0.96)',
    fontSize: 10,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
  manageopyLinkPressed: {
    opacity: 0.62,
  },
});

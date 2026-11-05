import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PRODUCT_CONFIG } from '../config/productConfig';

export default function PremiumLoader({
  message = 'Preparando el sistema',
  detail = 'Un momento, por favor',
  fullScreen = false,
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const rotationAnimation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    pulseAnimation.start();
    rotationAnimation.start();

    return () => {
      pulseAnimation.stop();
      rotationAnimation.stop();
    };
  }, [pulse, rotation]);

  const haloStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.28, 0.58],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1.06],
        }),
      },
    ],
  };

  const plateStyle = {
    transform: [
      {
        translateY: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, -2],
        }),
      },
    ],
  };

  const rotationStyle = {
    transform: [
      {
        rotate: rotation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  return (
    <View
      accessibilityLabel={`${message}. ${detail}`}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={[
        styles.container,
        fullScreen ? styles.containerFull : styles.containerEmbedded,
      ]}
    >
      <View pointerEvents="none" style={styles.ambientGlow} />

      <View style={styles.content}>
        <View style={styles.logoStage}>
          <Animated.View
            style={[
              styles.logoHalo,
              fullScreen ? styles.logoHaloDark : styles.logoHaloLight,
              haloStyle,
            ]}
          />
          <Animated.View style={[styles.logoPlate, plateStyle]}>
            <Image
              source={PRODUCT_CONFIG.logo}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        <Text style={[styles.eyebrow, fullScreen && styles.textOnDark]}>
          {PRODUCT_CONFIG.name.toUpperCase()}
        </Text>
        <Text style={[styles.message, fullScreen && styles.messageOnDark]}>
          {message}
        </Text>
        <Text style={[styles.detail, fullScreen && styles.detailOnDark]}>
          {detail}
        </Text>

        <View style={styles.loaderRingShell}>
          <Animated.View
            style={[
              styles.loaderRing,
              fullScreen ? styles.loaderRingDark : styles.loaderRingLight,
              rotationStyle,
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerFull: {
    minHeight: '100%',
    backgroundColor: PRODUCT_CONFIG.branding.background,
    backgroundImage:
      Platform.OS === 'web'
        ? 'linear-gradient(145deg, #07130D 0%, #183B2A 58%, #0B1D13 100%)'
        : undefined,
  },
  containerEmbedded: {
    minHeight: 320,
    backgroundColor: '#F4F6F3',
  },
  ambientGlow: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(90, 152, 112, 0.07)',
  },
  content: {
    width: '100%',
    maxWidth: 360,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoStage: {
    width: 180,
    height: 116,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 21,
  },
  logoHalo: {
    position: 'absolute',
    width: 174,
    height: 108,
    borderRadius: 30,
    borderWidth: 1,
  },
  logoHaloDark: {
    borderColor: 'rgba(125, 196, 150, 0.34)',
    backgroundColor: 'rgba(90, 152, 112, 0.08)',
  },
  logoHaloLight: {
    borderColor: 'rgba(53, 106, 75, 0.18)',
    backgroundColor: 'rgba(53, 106, 75, 0.05)',
  },
  logoPlate: {
    width: 150,
    height: 90,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#07130D',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 26,
    elevation: 10,
  },
  logo: {
    width: 126,
    height: 63,
  },
  eyebrow: {
    color: PRODUCT_CONFIG.branding.primary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 2.1,
    marginBottom: 9,
  },
  textOnDark: {
    color: '#7DC496',
  },
  message: {
    color: '#17231C',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.45,
    textAlign: 'center',
  },
  messageOnDark: {
    color: '#FFFFFF',
  },
  detail: {
    marginTop: 6,
    color: '#6E7A72',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailOnDark: {
    color: 'rgba(232, 242, 235, 0.64)',
  },
  loaderRingShell: {
    width: 38,
    height: 38,
    marginTop: 22,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(53, 106, 75, 0.06)',
  },
  loaderRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
  },
  loaderRingLight: {
    borderColor: '#D4DFD6',
    borderTopColor: PRODUCT_CONFIG.branding.primary,
    borderRightColor: PRODUCT_CONFIG.branding.primary,
  },
  loaderRingDark: {
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderTopColor: PRODUCT_CONFIG.branding.primaryBright,
    borderRightColor: PRODUCT_CONFIG.branding.primaryBright,
  },
});

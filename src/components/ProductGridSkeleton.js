import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { POS_COLORS } from '../theme/theme';

function useSkeletonAnimation() {
  const pulse = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1050,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1050,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const sweepAnimation = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1650,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      })
    );

    pulseAnimation.start();
    sweepAnimation.start();

    return () => {
      pulseAnimation.stop();
      sweepAnimation.stop();
    };
  }, [pulse, sweep]);

  return { pulse, sweep };
}

export default function ProductGridSkeleton({
  containerWidth,
  cardWidth,
  cardHeight,
  imageSize,
  columns,
  gap,
}) {
  const { pulse, sweep } = useSkeletonAnimation();
  const rows = 3;
  const items = useMemo(
    () => Array.from({ length: columns * rows }, (_, index) => index),
    [columns]
  );

  const pulseStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.58, 0.94],
    }),
  };
  const shineStyle = {
    transform: [
      {
        translateX: sweep.interpolate({
          inputRange: [0, 1],
          outputRange: [-80, cardWidth + 80],
        }),
      },
      { rotate: '12deg' },
    ],
  };

  return (
    <View
      accessibilityLabel="Cargando productos"
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={[styles.grid, { width: containerWidth }]}
    >
      {items.map((item, index) => {
        const isLastColumn = (index + 1) % columns === 0;

        return (
          <View
            key={item}
            style={[
              styles.cardShadow,
              {
                width: cardWidth,
                height: cardHeight,
                marginRight: isLastColumn ? 0 : gap,
                marginBottom: gap,
              },
            ]}
          >
            <View style={styles.card}>
              <Animated.View style={[styles.placeholderLayer, pulseStyle]}>
                <View style={styles.titleLine} />
                <View style={styles.titleLineShort} />

                <View style={styles.bottomRow}>
                  <View style={styles.priceLine} />
                  <View style={styles.addButton} />
                </View>

                <View
                  style={[
                    styles.image,
                    {
                      width: imageSize,
                      height: imageSize,
                      borderRadius: Math.min(22, imageSize * 0.22),
                    },
                  ]}
                />
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[styles.shine, { height: cardHeight + 54 }, shineStyle]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 42,
  },
  cardShadow: {
    borderRadius: 14,
    backgroundColor: POS_COLORS.surfaceStrong,
    shadowColor: '#17221B',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  card: {
    width: '100%',
    height: '100%',
    padding: 13,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E1E6E2',
    backgroundColor: '#FBFCFB',
  },
  placeholderLayer: {
    width: '100%',
    height: '100%',
  },
  titleLine: {
    width: '48%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DCE4DE',
  },
  titleLineShort: {
    width: '35%',
    height: 10,
    marginTop: 8,
    borderRadius: 5,
    backgroundColor: '#E4EAE5',
  },
  bottomRow: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: '58%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceLine: {
    width: '56%',
    height: 11,
    borderRadius: 6,
    backgroundColor: '#DCE4DE',
  },
  addButton: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#D7E4DB',
  },
  image: {
    position: 'absolute',
    right: -9,
    bottom: -7,
    borderWidth: 1,
    borderColor: '#DEE5DF',
    backgroundColor: '#E7ECE8',
  },
  shine: {
    position: 'absolute',
    top: -27,
    width: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
  },
});

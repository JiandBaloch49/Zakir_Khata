import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../theme/theme';

const { width, height } = Dimensions.get('window');

interface AmbientBackgroundProps {
  children?: React.ReactNode;
  style?: any;
}

export const AmbientBackground: React.FC<AmbientBackgroundProps> = ({ children, style }) => {
  return (
    <View style={[styles.container, style]}>
      {/* Background ambient lighting layers */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {/* Base dark background */}
        <View style={styles.baseBg} />

        {/* Top-Left Emerald Ambient Light Sphere */}
        <LinearGradient
          colors={['#00A651', '#1dd1a1', 'rgba(0, 166, 81, 0.2)', 'transparent']}
          locations={[0, 0.35, 0.7, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 0.9 }}
          style={styles.topGlow}
        />

        {/* Center-Right Purple Ambient Light Sphere */}
        <LinearGradient
          colors={['#5f27cd', 'rgba(95, 39, 205, 0.4)', 'rgba(95, 39, 205, 0.1)', 'transparent']}
          locations={[0, 0.4, 0.75, 1]}
          start={{ x: 1, y: 0.2 }}
          end={{ x: 0.1, y: 0.9 }}
          style={styles.midGlow}
        />

        {/* Top Beam Light Glow */}
        <LinearGradient
          colors={['rgba(29, 209, 161, 0.25)', 'rgba(0, 166, 81, 0.08)', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.45 }}
          style={styles.topBeam}
        />
      </View>

      {/* Screen Content */}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1015',
  },
  baseBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0B1015',
  },
  topGlow: {
    position: 'absolute',
    top: -height * 0.1,
    left: -width * 0.25,
    width: width * 1.3,
    height: height * 0.55,
    borderRadius: width,
    opacity: 0.45,
  },
  midGlow: {
    position: 'absolute',
    top: height * 0.25,
    right: -width * 0.35,
    width: width * 1.35,
    height: height * 0.55,
    borderRadius: width,
    opacity: 0.38,
  },
  topBeam: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
  },
});

export default AmbientBackground;

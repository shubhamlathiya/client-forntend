import React, { useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginTypeSelectionScreen() {
  const router = useRouter();
  const scaleInd = useRef(new Animated.Value(1)).current;
  const scaleBiz = useRef(new Animated.Value(1)).current;

  function animateScale(anim, to) {
    Animated.spring(anim, { toValue: to, useNativeDriver: true, friction: 6, tension: 80 }).start();
  }

  async function handleSelect(type) {
    try {
      const normalized = type === 'business' ? 'business' : 'individual';
      await AsyncStorage.setItem('loginType', normalized);
    } catch {}
    router.replace('/Home');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose how you want to continue</Text>

      <View style={styles.cardsRow}>
        <Animated.View style={[styles.cardWrapper, { transform: [{ scale: scaleInd }] }]}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.card}
            onPress={() => handleSelect('individual')}
            onPressIn={() => animateScale(scaleInd, 0.95)}
            onPressOut={() => animateScale(scaleInd, 1)}
          >
            <Image source={require('../../assets/icons/user.png')} style={styles.iconLarge} />
            <Text style={styles.cardTitle}>Individual Login</Text>
            <Text style={styles.cardText}>View normal product pricing.</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[styles.cardWrapper, { transform: [{ scale: scaleBiz }] }]}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.card}
            onPress={() => handleSelect('business')}
            onPressIn={() => animateScale(scaleBiz, 0.95)}
            onPressOut={() => animateScale(scaleBiz, 1)}
          >
            <Image source={require('../../assets/icons/shopping.png')} style={styles.iconLarge} />
            <Text style={styles.cardTitle}>Business Login</Text>
            <Text style={styles.cardText}>See tier-based pricing.</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
    color: '#1B1B1B',
    textAlign: 'center',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  cardWrapper: {
    width: 160,
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#fff',
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  iconLarge: {
    width: 48,
    height: 48,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  cardText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
});


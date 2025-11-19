import React, { useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from "expo-secure-store";
import {clearCart, getCurrentSessionId, getOrCreateSessionId} from "../../api/cartApi";

const { width } = Dimensions.get('window');

export default function LoginTypeSelectionScreen() {
  const router = useRouter();
  const scaleInd = useRef(new Animated.Value(1)).current;
  const scaleBiz = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  function animateScale(anim, to) {
    Animated.spring(anim, {
      toValue: to,
      useNativeDriver: true,
      friction: 6,
      tension: 80
    }).start();
  }

    async function handleSelect(type) {
        try {
            const currentLoginType = await AsyncStorage.getItem('loginType');

            // If switching to the same type, just navigate
            if (currentLoginType === type) {
                router.replace('/Home');
                return;
            }

            // 1. Clear server cart for current session
            try {
                const currentSessionId = await getCurrentSessionId();
                if (currentSessionId) {
                    await clearCart();
                }
            } catch (_) {}

            // 2. Save new loginType
            const normalized = type === 'business' ? 'business' : 'individual';
            await AsyncStorage.setItem('loginType', normalized);

            // 3. Set user-specific settings based on type
            if (normalized === 'business') {
                await AsyncStorage.setItem('userTier', 'business_premium');
                await AsyncStorage.setItem('canNegotiate', 'true');
            } else {
                // Clear business-specific settings when switching to individual
                await AsyncStorage.multiRemove(['userTier', 'canNegotiate']);
            }

            // 4. Get or create session ID for the new login type
            // This will reuse existing session if available, or create new one
            const newSessionId = await getOrCreateSessionId(normalized);

            console.log(`Switched to ${normalized} account with session:`, newSessionId);

            // 5. Navigate
            router.replace('/Home');

        } catch (error) {
            console.error('Error switching profile:', error);
        }
    }


  return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.background}
        />

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.header}>
            <Image
                source={require('../../assets/img.png')}
                style={styles.logo}
            />
            <Text style={styles.title}>Welcome to StorePro</Text>
            <Text style={styles.subtitle}>
              Choose your account type to get started
            </Text>
          </View>

          <View style={styles.cardsContainer}>
            {/* Individual User Card */}
            <Animated.View
                style={[
                  styles.cardWrapper,
                  { transform: [{ scale: scaleInd }] }
                ]}
            >
              <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.card}
                  onPress={() => handleSelect('individual')}
                  onPressIn={() => animateScale(scaleInd, 0.95)}
                  onPressOut={() => animateScale(scaleInd, 1)}
              >
                <LinearGradient
                    colors={['#4facfe', '#00f2fe']}
                    style={styles.cardGradient}
                >
                  <View style={styles.iconContainer}>
                    <Ionicons name="person-outline" size={32} color="#fff" />
                  </View>

                  <Text style={styles.cardTitle}>Individual</Text>
                  <Text style={styles.cardSubtitle}>Personal Shopper</Text>

                  <View style={styles.featuresList}>
                    <View style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                      <Text style={styles.featureText}>Standard Pricing</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                      <Text style={styles.featureText}>Retail Shopping</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                      <Text style={styles.featureText}>Quick Checkout</Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.footerText}>Perfect for personal use</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Business User Card */}
            <Animated.View
                style={[
                  styles.cardWrapper,
                  { transform: [{ scale: scaleBiz }] }
                ]}
            >
              <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.card}
                  onPress={() => handleSelect('business')}
                  onPressIn={() => animateScale(scaleBiz, 0.95)}
                  onPressOut={() => animateScale(scaleBiz, 1)}
              >
                <LinearGradient
                    colors={['#ff6b6b', '#ffa726']}
                    style={styles.cardGradient}
                >
                  <View style={styles.iconContainer}>
                    <Ionicons name="business-outline" size={32} color="#fff" />
                  </View>

                  <Text style={styles.cardTitle}>Business</Text>
                  <Text style={styles.cardSubtitle}>Wholesale Buyer</Text>

                  <View style={styles.featuresList}>
                    <View style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                      <Text style={styles.featureText}>Tier-based Pricing</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                      <Text style={styles.featureText}>Bulk Negotiation</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                      <Text style={styles.featureText}>Volume Discounts</Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.footerText}>Ideal for businesses & resellers</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerNote}>
              You can change this later in settings
            </Text>
          </View>
        </Animated.View>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '40%',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
    borderRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    maxWidth: 300,
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  cardWrapper: {
    width: (width - 72) / 2, // 24*3 padding
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    height: 320,
  },
  cardGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 20,
  },
  featuresList: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
  },
  cardFooter: {
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  footer: {
    alignItems: 'center',
  },
  footerNote: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
});
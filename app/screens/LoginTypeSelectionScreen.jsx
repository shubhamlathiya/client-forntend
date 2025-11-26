import React, { useRef, useEffect } from 'react';
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
import { clearCart } from "../../api/cartApi";
import { getCurrentSessionId, getOrCreateSessionId } from "../../api/sessionManager";

const { width } = Dimensions.get('window');

export default function LoginTypeSelectionScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  async function handleSelect(type) {
    try {
      const currentLoginType = await AsyncStorage.getItem('loginType');

      if (currentLoginType === type) {
        router.replace('/Home');
        return;
      }

      try {
        const sessionId = await getCurrentSessionId();
        if (sessionId) await clearCart();
      } catch (_) {}

      const normalized = type === 'business' ? 'business' : 'individual';
      await AsyncStorage.setItem('loginType', normalized);

      if (normalized === 'business') {
        await AsyncStorage.setItem('userTier', 'business_premium');
        await AsyncStorage.setItem('canNegotiate', 'true');
      } else {
        await AsyncStorage.multiRemove(['userTier', 'canNegotiate']);
      }

      await getOrCreateSessionId(normalized);

      router.replace('/Home');
    } catch (err) {
      console.log(err);
    }
  }

  return (
      <SafeAreaView style={styles.container}>

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>


          <View style={styles.cardsContainer}>
            {/* Individual */}
            <TouchableOpacity
                activeOpacity={0.9}
                style={styles.cardWrapper}
                onPress={() => handleSelect('individual')}
            >
              <LinearGradient
                  colors={['#A8CFFF', '#D6E8FF']}
                  style={styles.cardGradient}
              >
                <View style={styles.iconBox}>
                  <Ionicons name="person-outline" size={30} color="#3A6EA5" />
                </View>

                <Text style={styles.cardTitle}>Individual</Text>
                <Text style={styles.cardSubtitle}>Personal Shopping</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Business */}
            <TouchableOpacity
                activeOpacity={0.9}
                style={styles.cardWrapper}
                onPress={() => handleSelect('business')}
            >
              <LinearGradient
                  colors={['#A0E8AF', '#C8F5D2']}
                  style={styles.cardGradient}
              >
                <View style={styles.iconBox}>
                  <Ionicons name="business-outline" size={30} color="#2A8C4A" />
                </View>

                <Text style={styles.cardTitle}>Business</Text>
                <Text style={styles.cardSubtitle}>Wholesale & Bulk</Text>

              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerNote}>
              You can change this anytime in settings
            </Text>
          </View>

        </Animated.View>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F9FF',
  },
  background: {
    position: 'absolute',
    width: '100%',
    height: '50%',
  },
  logo: {
    width: 120,
    height: 100,
    borderRadius: 16,
    marginBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2A4A7B',
  },
  subtitle: {
    marginTop: 4,
    color: '#3A6EA5',
    fontSize: 14,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',     // centers everything vertically
  },

  header: {
    alignItems: 'center',
    marginBottom: 30,             // cleaner spacing
  },

  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
    marginBottom: 20,
  },
  cardWrapper: {
    width: width * 0.42,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 6,
    backgroundColor: '#fff',
  },

  cardGradient: {
    padding: 18,
    height: 180,
    borderRadius: 20,
    justifyContent: 'space-between',
  },
  iconBox: {
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    textAlign: 'center',
    fontSize: 22,
    color: '#1F3A61',
    fontWeight: '700',
  },
  cardSubtitle: {
    textAlign: 'center',
    fontSize: 14,
    color: '#3A6EA5',
    marginBottom: 10,
  },
  featuresList: {
    marginTop: 10,
  },
  feature: {
    fontSize: 13,
    color: '#4F6F99',
    marginBottom: 6,
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
  },
  footerNote: {
    color: '#7A8FA6',
    fontSize: 12,
  }
});

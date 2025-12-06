import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
  Platform,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../../components/ui/AppHeader';
import { requestReturn, requestReplacement } from '../../api/ordersApi';

export default function ReturnReplacementForm() {
  const router = useRouter();
  const { orderId, items: itemsParam, actionType } = useLocalSearchParams();
  const parsedItems = useMemo(() => {
    try { return JSON.parse(itemsParam); } catch { return []; }
  }, [itemsParam]);

  const [resolution, setResolution] = useState('refund'); // refund | replacement (for return)
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const showMessage = (message, isError = false) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, isError ? ToastAndroid.LONG : ToastAndroid.SHORT);
    } else {
      Alert.alert(isError ? 'Error' : 'Success', message);
    }
  };

  const handleSubmit = async () => {
    try {
      if (!reason || reason.trim().length === 0) {
        showMessage('Please enter a reason for the request', true);
        return;
      }
      setSubmitting(true);

      const payloadBase = {
        orderId: String(orderId),
        items: parsedItems.map((i) => ({ productId: i.productId, quantity: Number(i.quantity || 1) })),
        reason: reason.trim(),
      };

      let res;
      if (actionType === 'return') {
        res = await requestReturn({ ...payloadBase, resolution });
      } else if (actionType === 'replacement') {
        res = await requestReplacement(payloadBase);
      } else {
        showMessage('Unknown action type', true);
        return;
      }

      if (res?.success) {
        showMessage('Request Submitted Successfully.');
        router.replace('/screens/MyOrderScreen');
      } else {
        const msg = res?.error || res?.message || 'Failed to submit request';
        showMessage(msg, true);
      }
    } catch (error) {
      console.error('Submit request error:', error);
      const msg = error?.response?.data?.message || error?.message || 'Failed to submit request';
      showMessage(msg, true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.container}>
          <AppHeader title={actionType === 'Replacement' ? 'Replacement Request' : 'Return Request'} />
          <ScrollView style={styles.content}>
            <View style={styles.card}>
              <Text style={styles.label}>Order ID</Text>
              <Text style={styles.value}>{String(orderId)}</Text>
            </View>

            {actionType === 'return' && (
                <View style={styles.card}>
                  <Text style={styles.label}>Resolution</Text>
                  <View style={styles.segmented}>
                    <Pressable
                        style={[styles.segment, resolution === 'refund' && styles.segmentActive]}
                        onPress={() => setResolution('refund')}
                    >
                      <Text style={[styles.segmentText, resolution === 'refund' && styles.segmentTextActive]}>Refund</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.segment, resolution === 'replacement' && styles.segmentActive]}
                        onPress={() => setResolution('replacement')}
                    >
                      <Text style={[styles.segmentText, resolution === 'replacement' && styles.segmentTextActive]}>Replacement</Text>
                    </Pressable>
                  </View>
                </View>
            )}

            <View style={styles.card}>
              <Text style={styles.label}>Reason / Note</Text>
              <TextInput
                  style={styles.input}
                  placeholder="Describe your reason"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={4}
              />
            </View>

            <Pressable style={[styles.submitButton, submitting && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting}>
              <Text style={styles.submitText}>{submitting ? 'Submitting…' : 'Submit Request'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </SafeAreaView>

  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, marginBottom: 12 },
  label: { fontSize: 12, color: '#868889', marginBottom: 4 },
  value: { fontSize: 14, color: '#1B1B1B', fontWeight: '500' },
  segmented: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 8, padding: 4 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  segmentActive: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#4CAD73' },
  segmentText: { color: '#1B1B1B', fontSize: 14 },
  segmentTextActive: { color: '#4CAD73', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 10, minHeight: 90, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#4CAD73', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
});
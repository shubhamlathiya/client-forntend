import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Platform,
  ToastAndroid,
  StatusBar
} from 'react-native';
import AppHeader from '../../components/ui/AppHeader';
import { requestReturn, requestReplacement } from '../../api/ordersApi';
import { API_BASE_URL } from '../../config/apiConfig';

export default function ReturnReplacementScreen() {
  const router = useRouter();
  const { orderId, type, orderDetails: orderDetailsParam } = useLocalSearchParams();
  const orderDetails = useMemo(() => {
    try { return JSON.parse(orderDetailsParam); } catch { return {}; }
  }, [orderDetailsParam]);

  const [itemsState, setItemsState] = useState([]);
  const [reason, setReason] = useState('');
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const items = Array.isArray(orderDetails?.items) ? orderDetails.items : [];
    const normalized = items.map((i) => ({
      productId: i.productId || i._id,
      productName: i.name || i.productName || 'Item',
      image: i.image ? `${API_BASE_URL}${i.image.startsWith('/') ? i.image : '/' + i.image}` : null,
      price: Number(i.unitPrice || i.price || 0),
      quantity: Number(i.quantity || 1),
      selected: false,
      returnQty: 0,
      brand: i.brand || '',
      variantAttributes: i.variantAttributes || ''
    }));
    setItemsState(normalized);
  }, [orderDetailsParam]);

  const showMessage = (message, isError = false) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, isError ? ToastAndroid.LONG : ToastAndroid.SHORT);
    } else {
      Alert.alert(isError ? 'Error' : 'Success', message);
    }
  };

  const toggleItem = (idx) => {
    setItemsState((prev) => prev.map((it, i) => i === idx ? { ...it, selected: !it.selected, returnQty: !it.selected ? Math.min(1, it.quantity) : 0 } : it));
  };

  const adjustQty = (idx, delta) => {
    setItemsState((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      let next = Math.max(0, Math.min(it.quantity, (it.returnQty || 0) + delta));
      return { ...it, returnQty: next, selected: next > 0 };
    }));
  };

  const setQty = (idx, value) => {
    const parsed = parseInt(String(value).replace(/[^0-9]/g, ''), 10);
    const safe = isNaN(parsed) ? 0 : parsed;
    setItemsState((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const next = Math.max(0, Math.min(it.quantity, safe));
      return { ...it, returnQty: next, selected: next > 0 };
    }));
  };

  const addImageUrl = () => {
    Alert.prompt(
        'Add Image URL',
        'Paste the URL of your image',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add', onPress: (text) => {
              const url = String(text || '').trim();
              if (!url) return;
              setImages((prev) => prev.length >= 3 ? prev : [...prev, url]);
            } }
        ],
        'plain-text'
    );
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const isValid = () => {
    const selectedItems = itemsState.filter((i) => i.selected && i.returnQty > 0);
    if (selectedItems.length === 0) return false;
    if (!reason || reason.trim().length === 0) return false;
    return true;
  };

  const handleSubmit = async () => {
    try {
      if (!isValid()) {
        showMessage('Please select items, quantities and enter a reason', true);
        return;
      }

      const confirm = await new Promise((resolve) => {
        Alert.alert(
            'Confirm Submission',
            `Submit ${type === 'replacement' ? 'replacement' : 'return'} request?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Submit', onPress: () => resolve(true) },
            ]
        );
      });
      if (!confirm) return;

      setSubmitting(true);
      const selectedItems = itemsState.filter((i) => i.selected && i.returnQty > 0)
          .map((i) => ({ productId: i.productId, quantity: i.returnQty }));
      const base = { orderId: String(orderId), items: selectedItems, reason: reason.trim() };

      let res;
      if (type === 'return') {
        res = await requestReturn({ ...base, resolution: 'refund' });
      } else {
        res = await requestReplacement({ ...base, images });
      }

      if (res?.success) {
        showMessage('Request submitted successfully.');
        router.replace('/screens/MyOrderScreen');
      } else {
        const msg = res?.error || res?.message || 'Failed to submit request';
        showMessage(msg, true);
      }
    } catch (error) {
      console.error('Request submission error:', error);
      const msg = error?.response?.data?.message || error?.message || 'Failed to submit request';
      showMessage(msg, true);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Date not available";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return `$${Number(amount || 0).toFixed(2)}`;
  };

  const totalAmount = orderDetails?.totals?.grandTotal || orderDetails?.priceBreakdown?.grandTotal || orderDetails?.totalPrice || 0;
  const placedAt = orderDetails?.placedAt || '';
  const status = orderDetails?.status || 'delivered';
  const orderNumber = orderDetails?.orderNumber;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/screens/MyOrderScreen');
    }
  };

  return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Image
                source={require("../../assets/icons/back_icon.png")}
                style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {type === 'replacement' ? 'Request Replacement' : 'Request Return'}
          </Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Order Summary */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Order Number</Text>
                <Text style={styles.summaryValue}>#{orderNumber}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Order Date</Text>
                <Text style={styles.summaryValue}>{formatDate(placedAt)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Amount</Text>
                <Text style={[styles.summaryValue, styles.amountText]}>{formatCurrency(totalAmount)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: status === 'delivered' ? '#4CAD73' : '#FFA500' }]}>
                  <Text style={styles.statusText}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Items Selection */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Select Items to {type === 'replacement' ? 'Replace' : 'Return'}</Text>
            <Text style={styles.sectionSubtitle}>Choose the items you want to {type === 'replacement' ? 'replace' : 'return'}</Text>

            {itemsState.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No items found in this order.</Text>
                </View>
            ) : (
                itemsState.map((item, idx) => (
                    <View key={item.productId || idx} style={[
                      styles.itemCard,
                      item.selected && styles.itemCardSelected
                    ]}>
                      <TouchableOpacity
                          style={[styles.checkbox, item.selected && styles.checkboxChecked]}
                          onPress={() => toggleItem(idx)}
                      />

                      <Image
                          source={item.image ? { uri: item.image } : require("../../assets/icons/order.png")}
                          style={styles.productImage}
                          defaultSource={require("../../assets/icons/order.png")}
                      />

                      <View style={styles.itemDetails}>
                        <Text style={styles.productName}>{item.productName}</Text>

                        {item.brand && (
                            <Text style={styles.productBrand}>{item.brand}</Text>
                        )}

                        {item.variantAttributes && (
                            <Text style={styles.variantText}>{item.variantAttributes}</Text>
                        )}

                        <View style={styles.priceRow}>
                          <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
                          <Text style={styles.quantityText}>× {item.quantity}</Text>
                        </View>

                        {/* Quantity Selector */}
                        {item.selected && (
                            <View style={styles.quantitySection}>
                              <Text style={styles.quantityLabel}>
                                {type === 'replacement' ? 'Replace' : 'Return'} Quantity:
                              </Text>
                              <View style={styles.quantityControls}>
                                <TouchableOpacity
                                    style={styles.quantityButton}
                                    onPress={() => adjustQty(idx, -1)}
                                    disabled={item.returnQty <= 0}
                                >
                                  <Text style={[
                                    styles.quantityButtonText,
                                    item.returnQty <= 0 && styles.quantityButtonDisabled
                                  ]}>-</Text>
                                </TouchableOpacity>

                                <TextInput
                                    style={styles.quantityInput}
                                    keyboardType="number-pad"
                                    value={String(item.returnQty || 0)}
                                    onChangeText={(v) => setQty(idx, v)}
                                    maxLength={3}
                                />

                                <TouchableOpacity
                                    style={styles.quantityButton}
                                    onPress={() => adjustQty(idx, 1)}
                                    disabled={item.returnQty >= item.quantity}
                                >
                                  <Text style={[
                                    styles.quantityButtonText,
                                    item.returnQty >= item.quantity && styles.quantityButtonDisabled
                                  ]}>+</Text>
                                </TouchableOpacity>
                              </View>
                              <Text style={styles.quantityHelp}>
                                Max: {item.quantity} {item.quantity === 1 ? 'item' : 'items'}
                              </Text>
                            </View>
                        )}
                      </View>
                    </View>
                ))
            )}
          </View>

          {/* Reason */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Reason for {type === 'replacement' ? 'Replacement' : 'Return'}
            </Text>
            <Text style={styles.sectionSubtitle}>
              Please describe why you want to {type === 'replacement' ? 'replace' : 'return'} the selected items
            </Text>
            <TextInput
                style={styles.reasonInput}
                placeholder="Example: Product arrived damaged, wrong size received, missing parts, quality issues, etc."
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
            />
          </View>

          {/* Images - Only for Replacement */}
          {type === 'replacement' && (
              <View style={styles.card}>
                <View style={styles.imagesHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Supporting Images</Text>
                    <Text style={styles.sectionSubtitle}>Add images to help us understand the issue (optional)</Text>
                  </View>
                  <Text style={styles.imageCounter}>{images.length}/3</Text>
                </View>

                <View style={styles.imagesContainer}>
                  {images.map((url, idx) => (
                      <View key={url + idx} style={styles.imageThumbnail}>
                        <Image source={{ uri: url }} style={styles.thumbnailImage} />
                        <TouchableOpacity
                            style={styles.removeImageButton}
                            onPress={() => removeImage(idx)}
                        >
                          <Text style={styles.removeImageText}>×</Text>
                        </TouchableOpacity>
                      </View>
                  ))}

                  {images.length < 3 && (
                      <TouchableOpacity style={styles.addImageButton} onPress={addImageUrl}>
                        <Text style={styles.addImageIcon}>+</Text>
                        <Text style={styles.addImageText}>Add Image URL</Text>
                      </TouchableOpacity>
                  )}
                </View>
              </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
              style={[styles.submitButton, (!isValid() || submitting) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!isValid() || submitting}
          >
            {submitting ? (
                <Text style={styles.submitButtonText}>Submitting...</Text>
            ) : (
                <Text style={styles.submitButtonText}>
                  Submit {type === 'replacement' ? 'Replacement' : 'Return'} Request
                </Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerSpace} />
        </ScrollView>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 4,
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1B1B1B',
  },
  headerPlaceholder: {
    width: 24,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B1B1B',
    marginBottom: 4
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#868889',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryItem: {
    width: '48%',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#868889',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1B1B1B',
  },
  amountText: {
    color: '#4CAD73',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  itemCardSelected: {
    borderColor: '#4CAD73',
    backgroundColor: '#F8FFFA',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D0D5DD',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#4CAD73',
    borderColor: '#4CAD73'
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F6F6F6',
    marginHorizontal: 12
  },
  itemDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B1B1B',
    marginBottom: 2,
  },
  productBrand: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 2,
  },
  variantText: {
    fontSize: 11,
    color: '#868889',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAD73',
  },
  quantityText: {
    fontSize: 12,
    color: '#868889',
  },
  quantitySection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  quantityLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1B1B1B',
    marginBottom: 6,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#EDF8E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: {
    color: '#4CAD73',
    fontSize: 16,
    fontWeight: '600',
  },
  quantityButtonDisabled: {
    color: '#C0C0C0',
  },
  quantityInput: {
    width: 50,
    height: 36,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  quantityHelp: {
    fontSize: 10,
    color: '#868889',
    marginTop: 4,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1B1B1B',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  imagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  imageCounter: {
    fontSize: 12,
    color: '#868889',
    fontWeight: '500',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageThumbnail: {
    position: 'relative',
  },
  thumbnailImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F6F6F6',
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF4444',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderWidth: 1,
    borderColor: '#DADADA',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addImageIcon: {
    fontSize: 18,
    color: '#4CAD73',
    fontWeight: '600',
  },
  addImageText: {
    fontSize: 10,
    color: '#4CAD73',
    fontWeight: '500',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#4CAD73',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#C0C0C0',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#868889',
    textAlign: 'center',
  },
  footerSpace: {
    height: 20,
  },
});
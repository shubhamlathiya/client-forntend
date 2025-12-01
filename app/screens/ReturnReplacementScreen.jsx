import {useLocalSearchParams, useRouter} from 'expo-router';
import React, {useEffect, useMemo, useState} from 'react';
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
    StatusBar,
    Dimensions,
    KeyboardAvoidingView,
    TouchableWithoutFeedback,
    Keyboard,
    ActivityIndicator
} from 'react-native';
import {requestReturn, requestReplacement} from '../../api/ordersApi';
import {API_BASE_URL} from '../../config/apiConfig';

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

// Check if device has notch (iPhone X and above)
const hasNotch = Platform.OS === 'ios' && (screenHeight >= 812 || screenWidth >= 812);

// Safe area insets for different devices
const getSafeAreaInsets = () => {
    if (Platform.OS === 'ios') {
        if (hasNotch) {
            return {
                top: 44, // Status bar + notch area
                bottom: 34 // Home indicator area
            };
        }
        return {
            top: 20, // Regular status bar
            bottom: 0
        };
    }
    // Android
    return {
        top: StatusBar.currentHeight || 25,
        bottom: 0
    };
};

const safeAreaInsets = getSafeAreaInsets();

// Responsive size calculator
const RF = (size) => {
    const scale = screenWidth / 375; // 375 is standard iPhone width
    const normalizedSize = size * Math.min(scale, 1.5); // Max 1.5x scaling for tablets
    return Math.round(normalizedSize);
};

// Check if device is tablet
const isTablet = screenWidth >= 768;

export default function ReturnReplacementScreen() {
    const router = useRouter();
    const {orderId, type, orderDetails: orderDetailsParam} = useLocalSearchParams();
    const orderDetails = useMemo(() => {
        try {
            return JSON.parse(orderDetailsParam);
        } catch {
            return {};
        }
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
        setItemsState((prev) => prev.map((it, i) => i === idx ? {
            ...it,
            selected: !it.selected,
            returnQty: !it.selected ? Math.min(1, it.quantity) : 0
        } : it));
    };

    const adjustQty = (idx, delta) => {
        setItemsState((prev) => prev.map((it, i) => {
            if (i !== idx) return it;
            let next = Math.max(0, Math.min(it.quantity, (it.returnQty || 0) + delta));
            return {...it, returnQty: next, selected: next > 0};
        }));
    };

    const setQty = (idx, value) => {
        const parsed = parseInt(String(value).replace(/[^0-9]/g, ''), 10);
        const safe = isNaN(parsed) ? 0 : parsed;
        setItemsState((prev) => prev.map((it, i) => {
            if (i !== idx) return it;
            const next = Math.max(0, Math.min(it.quantity, safe));
            return {...it, returnQty: next, selected: next > 0};
        }));
    };

    const addImageUrl = () => {
        Alert.prompt(
            'Add Image URL',
            'Paste the URL of your image',
            [
                {text: 'Cancel', style: 'cancel'},
                {
                    text: 'Add', onPress: (text) => {
                        const url = String(text || '').trim();
                        if (!url) return;
                        setImages((prev) => prev.length >= 3 ? prev : [...prev, url]);
                    }
                }
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
                        {text: 'Cancel', style: 'cancel', onPress: () => resolve(false)},
                        {text: 'Submit', onPress: () => resolve(true)},
                    ]
                );
            });
            if (!confirm) return;

            setSubmitting(true);
            const selectedItems = itemsState.filter((i) => i.selected && i.returnQty > 0)
                .map((i) => ({productId: i.productId, quantity: i.returnQty}));
            const base = {orderId: String(orderId), items: selectedItems, reason: reason.trim()};

            let res;
            if (type === 'return') {
                res = await requestReturn({...base, resolution: 'refund'});
            } else {
                res = await requestReplacement({...base, images});
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
        return `₹${Number(amount || 0).toFixed(2)}`;
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
        <View style={styles.safeContainer}>
            <StatusBar backgroundColor="#4CAD73" barStyle="light-content"/>

            {/* Header */}
            <View style={[
                styles.header,
                {
                    height: RF(60) + safeAreaInsets.top,
                    paddingTop: safeAreaInsets.top,
                }
            ]}>
                <TouchableOpacity
                    onPress={handleBack}
                    style={styles.backButton}
                    hitSlop={{top: RF(10), bottom: RF(10), left: RF(10), right: RF(10)}}
                >
                    <Image
                        source={require("../../assets/icons/back_icon.png")}
                        style={[
                            styles.backIcon,
                            {
                                width: RF(24),
                                height: RF(24),
                            }
                        ]}
                    />
                </TouchableOpacity>

                <Text style={[
                    styles.headerTitle,
                    {
                        fontSize: RF(18),
                    }
                ]}>
                    {type === 'replacement' ? 'Request Replacement' : 'Request Return'}
                </Text>

                <View style={[styles.headerPlaceholder, {width: RF(40)}]}/>
            </View>

            {/* Keyboard Avoiding View */}
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? RF(60) + safeAreaInsets.top : 0}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={[
                            styles.contentContainer,
                            {
                                paddingBottom: safeAreaInsets.bottom + RF(100),
                            }
                        ]}
                    >
                        {/* Order Summary */}
                        <View style={styles.card}>
                            <Text style={[
                                styles.sectionTitle,
                                {fontSize: RF(16)}
                            ]}>Order Summary</Text>
                            <View style={styles.summaryGrid}>
                                <View style={styles.summaryItem}>
                                    <Text style={[styles.summaryLabel, {fontSize: RF(12)}]}>Order Date</Text>
                                    <Text style={[styles.summaryValue, {fontSize: RF(14)}]}>{formatDate(placedAt)}</Text>
                                </View>
                                <View style={styles.summaryItem}>
                                    <Text style={[styles.summaryLabel, {fontSize: RF(12)}]}>Total Amount</Text>
                                    <Text style={[
                                        styles.summaryValue,
                                        styles.amountText,
                                        {fontSize: RF(14)}
                                    ]}>{formatCurrency(totalAmount)}</Text>
                                </View>
                                <View style={styles.summaryItem}>
                                    <Text style={[styles.summaryLabel, {fontSize: RF(12)}]}>Status</Text>
                                    <View
                                        style={[styles.statusBadge, {backgroundColor: status === 'delivered' ? '#4CAD73' : '#FFA500'}]}>
                                        <Text style={[styles.statusText, {fontSize: RF(10)}]}>
                                            {status.charAt(0).toUpperCase() + status.slice(1)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Items Selection */}
                        <View style={styles.card}>
                            <Text style={[
                                styles.sectionTitle,
                                {fontSize: RF(16)}
                            ]}>
                                Select Items to {type === 'replacement' ? 'Replace' : 'Return'}
                            </Text>
                            <Text style={[
                                styles.sectionSubtitle,
                                {fontSize: RF(12)}
                            ]}>
                                Choose the items you want to {type === 'replacement' ? 'replace' : 'return'}
                            </Text>

                            {itemsState.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Text style={[styles.emptyText, {fontSize: RF(14)}]}>No items found in this order.</Text>
                                </View>
                            ) : (
                                itemsState.map((item, idx) => (
                                    <View key={item.productId || idx} style={[
                                        styles.itemCard,
                                        item.selected && styles.itemCardSelected
                                    ]}>
                                        <TouchableOpacity
                                            style={styles.checkboxContainer}
                                            onPress={() => toggleItem(idx)}
                                        >
                                            <View style={[styles.checkbox, item.selected && styles.checkboxChecked]}>
                                                {item.selected && (
                                                    <Image
                                                        source={require("../../assets/icons/check.png")}
                                                        style={[
                                                            styles.checkIcon,
                                                            {
                                                                width: RF(12),
                                                                height: RF(12),
                                                            }
                                                        ]}
                                                    />
                                                )}
                                            </View>
                                        </TouchableOpacity>

                                        <Image
                                            source={item.image ? {uri: item.image} : require("../../assets/icons/order.png")}
                                            style={[
                                                styles.productImage,
                                                {
                                                    width: RF(60),
                                                    height: RF(60),
                                                }
                                            ]}
                                            defaultSource={require("../../assets/icons/order.png")}
                                        />

                                        <View style={styles.itemDetails}>
                                            <Text style={[styles.productName, {fontSize: RF(14)}]}>
                                                {item.productName}
                                            </Text>

                                            {item.brand && (
                                                <Text style={[styles.productBrand, {fontSize: RF(12)}]}>
                                                    {item.brand}
                                                </Text>
                                            )}

                                            {item.variantAttributes && (
                                                <Text style={[styles.variantText, {fontSize: RF(11)}]}>
                                                    {item.variantAttributes}
                                                </Text>
                                            )}

                                            <View style={styles.priceRow}>
                                                <Text style={[styles.productPrice, {fontSize: RF(14)}]}>
                                                    {formatCurrency(item.price)}
                                                </Text>
                                                <Text style={[styles.quantityText, {fontSize: RF(12)}]}>
                                                    × {item.quantity}
                                                </Text>
                                            </View>

                                            {/* Return Quantity Summary */}
                                            {item.selected && item.returnQty > 0 && (
                                                <View style={styles.returnQtySummary}>
                                                    <Text style={[styles.returnQtyText, {fontSize: RF(12)}]}>
                                                        {type === 'replacement' ? 'Replacing' : 'Returning'}:
                                                        <Text style={styles.returnQtyNumber}> {item.returnQty}</Text>
                                                        of {item.quantity}
                                                    </Text>
                                                </View>
                                            )}

                                            {/* Quantity Selector */}
                                            {item.selected && (
                                                <View style={styles.quantitySection}>
                                                    <Text style={[
                                                        styles.quantityLabel,
                                                        {fontSize: RF(12)}
                                                    ]}>
                                                        {type === 'replacement' ? 'Replace' : 'Return'} Quantity:
                                                    </Text>
                                                    <View style={styles.quantityControls}>
                                                        <TouchableOpacity
                                                            style={[
                                                                styles.quantityButton,
                                                                {width: RF(32), height: RF(32)}
                                                            ]}
                                                            onPress={() => adjustQty(idx, -1)}
                                                            disabled={item.returnQty <= 0}
                                                        >
                                                            <Text style={[
                                                                styles.quantityButtonText,
                                                                item.returnQty <= 0 && styles.quantityButtonDisabled,
                                                                {fontSize: RF(16)}
                                                            ]}>
                                                                -
                                                            </Text>
                                                        </TouchableOpacity>

                                                        <TextInput
                                                            style={[
                                                                styles.quantityInput,
                                                            ]}
                                                            keyboardType="number-pad"
                                                            value={String(item.returnQty || 0)}
                                                            onChangeText={(v) => setQty(idx, v)}
                                                            maxLength={3}
                                                        />

                                                        <TouchableOpacity
                                                            style={[
                                                                styles.quantityButton,
                                                                {width: RF(32), height: RF(32)}
                                                            ]}
                                                            onPress={() => adjustQty(idx, 1)}
                                                            disabled={item.returnQty >= item.quantity}
                                                        >
                                                            <Text style={[
                                                                styles.quantityButtonText,
                                                                item.returnQty >= item.quantity && styles.quantityButtonDisabled,
                                                                {fontSize: RF(16)}
                                                            ]}>
                                                                +
                                                            </Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <Text style={[
                                                        styles.quantityHelp,
                                                        {fontSize: RF(10)}
                                                    ]}>
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
                            <Text style={[
                                styles.sectionTitle,
                                {fontSize: RF(16)}
                            ]}>
                                Reason for {type === 'replacement' ? 'Replacement' : 'Return'}
                            </Text>
                            <Text style={[
                                styles.sectionSubtitle,
                                {fontSize: RF(12)}
                            ]}>
                                Please describe why you want to {type === 'replacement' ? 'replace' : 'return'} the selected items
                            </Text>
                            <TextInput
                                style={[
                                    styles.reasonInput,
                                    {
                                        fontSize: RF(14),
                                        minHeight: RF(100),
                                    }
                                ]}
                                placeholder="Example: Product arrived damaged, wrong size received, missing parts, quality issues, etc."
                                placeholderTextColor="#868889"
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
                                        <Text style={[
                                            styles.sectionTitle,
                                            {fontSize: RF(16)}
                                        ]}>
                                            Supporting Images
                                        </Text>
                                        <Text style={[
                                            styles.sectionSubtitle,
                                            {fontSize: RF(12)}
                                        ]}>
                                            Add images to help us understand the issue (optional)
                                        </Text>
                                    </View>
                                    <Text style={[styles.imageCounter, {fontSize: RF(12)}]}>{images.length}/3</Text>
                                </View>

                                <View style={styles.imagesContainer}>
                                    {images.map((url, idx) => (
                                        <View key={url + idx} style={styles.imageThumbnail}>
                                            <Image
                                                source={{uri: url}}
                                                style={[
                                                    styles.thumbnailImage,
                                                    {
                                                        width: RF(80),
                                                        height: RF(80),
                                                    }
                                                ]}
                                            />
                                            <TouchableOpacity
                                                style={[
                                                    styles.removeImageButton,
                                                    {
                                                        width: RF(20),
                                                        height: RF(20),
                                                    }
                                                ]}
                                                onPress={() => removeImage(idx)}
                                            >
                                                <Text style={[
                                                    styles.removeImageText,
                                                    {fontSize: RF(12)}
                                                ]}>
                                                    ×
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}

                                    {images.length < 3 && (
                                        <TouchableOpacity
                                            style={[
                                                styles.addImageButton,
                                                {
                                                    width: RF(80),
                                                    height: RF(80),
                                                }
                                            ]}
                                            onPress={addImageUrl}
                                        >
                                            <Text style={[
                                                styles.addImageIcon,
                                                {fontSize: RF(18)}
                                            ]}>
                                                +
                                            </Text>
                                            <Text style={[
                                                styles.addImageText,
                                                {fontSize: RF(10)}
                                            ]}>
                                                Add Image URL
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Footer Spacer */}
                        <View style={{height: RF(80)}} />
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>

            {/* Fixed Footer */}
            <View style={[
                styles.footer,
                {
                    paddingBottom: safeAreaInsets.bottom,
                }
            ]}>
                <TouchableOpacity
                    style={[
                        styles.submitButton,
                        (!isValid() || submitting) && styles.submitButtonDisabled
                    ]}
                    onPress={handleSubmit}
                    disabled={!isValid() || submitting}
                >
                    {submitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text style={[
                            styles.submitButtonText,
                            {fontSize: RF(16)}
                        ]}>
                            Submit {type === 'replacement' ? 'Replacement' : 'Return'} Request
                        </Text>
                    )}
                </TouchableOpacity>

                <Text style={[styles.footerText, {fontSize: RF(12)}]}>
                    By submitting, you agree to our return/replacement policy
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: '#4CAD73',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#4CAD73',
        paddingHorizontal: RF(16),
    },
    backButton: {
        padding: RF(8),
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        tintColor: '#FFFFFF'
    },
    headerTitle: {
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
        flex: 1,
    },
    headerPlaceholder: {
        opacity: 0,
    },
    keyboardAvoidingView: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: RF(16),
        flexGrow: 1,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: RF(12),
        padding: RF(16),
        marginBottom: RF(16),
        shadowColor: '#000',
        shadowOffset: {width: 0, height: RF(1)},
        shadowOpacity: 0.05,
        shadowRadius: RF(3),
        elevation: 2,
    },
    sectionTitle: {
        fontWeight: '600',
        color: '#1B1B1B',
        marginBottom: RF(4),
        fontFamily: 'Poppins-SemiBold',
    },
    sectionSubtitle: {
        color: '#868889',
        marginBottom: RF(12),
        fontFamily: 'Poppins-Regular',
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    summaryItem: {
        width: '48%',
        marginBottom: RF(8),
    },
    summaryLabel: {
        color: '#868889',
        marginBottom: RF(2),
        fontFamily: 'Poppins-Regular',
    },
    summaryValue: {
        fontWeight: '500',
        color: '#1B1B1B',
        fontFamily: 'Poppins-Medium',
    },
    amountText: {
        color: '#4CAD73',
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    statusBadge: {
        paddingHorizontal: RF(8),
        paddingVertical: RF(4),
        borderRadius: RF(12),
        alignSelf: 'flex-start',
    },
    statusText: {
        fontWeight: '600',
        color: '#FFFFFF',
        fontFamily: 'Poppins-SemiBold',
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: RF(12),
        borderWidth: 1,
        borderColor: '#F0F0F0',
        borderRadius: RF(8),
        marginBottom: RF(8),
        backgroundColor: '#FFFFFF',
    },
    itemCardSelected: {
        borderColor: '#4CAD73',
        backgroundColor: '#F8FFFA',
    },
    checkboxContainer: {
        padding: RF(4),
    },
    checkbox: {
        width: RF(20),
        height: RF(20),
        borderRadius: RF(4),
        borderWidth: RF(2),
        borderColor: '#D0D5DD',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#4CAD73',
        borderColor: '#4CAD73'
    },
    checkIcon: {
        tintColor: '#FFFFFF'
    },
    productImage: {
        borderRadius: RF(8),
        backgroundColor: '#F6F6F6',
        marginHorizontal: RF(12)
    },
    itemDetails: {
        flex: 1,
    },
    productName: {
        fontWeight: '600',
        color: '#1B1B1B',
        marginBottom: RF(2),
        fontFamily: 'Poppins-SemiBold',
    },
    productBrand: {
        color: '#666666',
        marginBottom: RF(2),
        fontFamily: 'Poppins-Regular',
    },
    variantText: {
        color: '#868889',
        fontStyle: 'italic',
        marginBottom: RF(4),
        fontFamily: 'Poppins-Italic',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: RF(8),
        marginBottom: RF(8),
    },
    productPrice: {
        fontWeight: '600',
        color: '#4CAD73',
        fontFamily: 'Poppins-SemiBold',
    },
    quantityText: {
        color: '#868889',
        fontFamily: 'Poppins-Regular',
    },
    returnQtySummary: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: RF(8),
        paddingVertical: RF(4),
        borderRadius: RF(4),
        alignSelf: 'flex-start',
        marginTop: RF(4),
    },
    returnQtyText: {
        color: '#1B1B1B',
        fontFamily: 'Poppins-Medium',
    },
    returnQtyNumber: {
        color: '#4CAD73',
        fontWeight: '700',
        fontFamily: 'Poppins-Bold',
    },
    quantitySection: {
        marginTop: RF(8),
        paddingTop: RF(8),
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    quantityLabel: {
        fontWeight: '500',
        color: '#1B1B1B',
        marginBottom: RF(6),
        fontFamily: 'Poppins-Medium',
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: RF(8),
    },
    quantityButton: {
        borderRadius: RF(6),
        backgroundColor: '#EDF8E7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityButtonText: {
        color: '#4CAD73',
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    quantityButtonDisabled: {
        color: '#C0C0C0',
    },
    quantityInput: {
        borderColor: '#E0E0E0',
        borderRadius: RF(6),
        textAlign: 'center',
        fontWeight: '500',
        fontFamily: 'Poppins-Medium',
        color: '#1B1B1B',
    },
    quantityHelp: {
        color: '#868889',
        marginTop: RF(4),
        fontFamily: 'Poppins-Regular',
    },
    reasonInput: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: RF(8),
        padding: RF(12),
        color: '#1B1B1B',
        textAlignVertical: 'top',
        fontFamily: 'Poppins-Regular',
    },
    imagesHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: RF(12),
    },
    imageCounter: {
        color: '#868889',
        fontWeight: '500',
        fontFamily: 'Poppins-Medium',
    },
    imagesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: RF(12),
    },
    imageThumbnail: {
        position: 'relative',
    },
    thumbnailImage: {
        borderRadius: RF(8),
        backgroundColor: '#F6F6F6',
    },
    removeImageButton: {
        position: 'absolute',
        top: RF(-6),
        right: RF(-6),
        backgroundColor: '#FF4444',
        borderRadius: RF(10),
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeImageText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    addImageButton: {
        borderWidth: 1,
        borderColor: '#DADADA',
        borderStyle: 'dashed',
        borderRadius: RF(8),
        alignItems: 'center',
        justifyContent: 'center',
        gap: RF(4),
    },
    addImageIcon: {
        color: '#4CAD73',
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    addImageText: {
        color: '#4CAD73',
        fontWeight: '500',
        textAlign: 'center',
        fontFamily: 'Poppins-Medium',
    },
    footer: {
        paddingHorizontal: RF(16),
        paddingVertical: RF(12),
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    submitButton: {
        backgroundColor: '#4CAD73',
        width: '100%',
        paddingVertical: RF(14),
        borderRadius: RF(8),
        alignItems: 'center',

    },
    submitButtonDisabled: {
        backgroundColor: '#C0C0C0',
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    footerText: {
        color: '#868889',
        textAlign: 'center',
        fontFamily: 'Poppins-Regular',
        marginBottom: RF(22),
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: RF(20),
    },
    emptyText: {
        color: '#868889',
        textAlign: 'center',
        fontFamily: 'Poppins-Regular',
    },
});
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useRouter} from 'expo-router';
import React, {useEffect, useState} from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    ToastAndroid,
    TouchableOpacity,
    View,
    Image,
    Platform,
    ActivityIndicator,
    RefreshControl,
    StatusBar
} from 'react-native';
import {getAddresses, deleteAddress, setDefaultAddress} from '../../api/addressApi';

export default function AddressListScreen() {
    const router = useRouter();
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedAddressId, setSelectedAddressId] = useState(null);

    const loadAddresses = async () => {
        try {
            const res = await getAddresses();
            const data = res?.data ?? res?.addresses ?? res ?? [];
            const list = Array.isArray(data) ? data : (data?.data || []);
            setAddresses(list);
        } catch (error) {
            console.error('Addresses fetch error:', error);
            showMessage('Failed to load addresses', true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadAddresses();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadAddresses();
    };

    const showMessage = (message, isError = false) => {
        if (Platform.OS === 'android') {
            ToastAndroid.show(message, isError ? ToastAndroid.LONG : ToastAndroid.SHORT);
        } else {
            Alert.alert(isError ? 'Error' : 'Success', message);
        }
    };

    const handleSelectAddress = async (address) => {
        try {
            setSelectedAddressId(address._id || address.id);

            // Store the selected address
            await AsyncStorage.setItem('selectedAddress', JSON.stringify(address));
            console.log(address._id || address.id)
            // Always go back to previous screen
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/Home');
            }
        } catch (error) {
            console.error('Select address error:', error);
            showMessage('Failed to select address', true);
        } finally {
            setSelectedAddressId(null);
        }
    };

    const handleSetDefault = async (id) => {
        try {
            await setDefaultAddress(String(id));
            showMessage('Default address updated');
            await loadAddresses();
        } catch (error) {
            console.error('Set default error:', error);
            showMessage('Failed to set default address', true);
        }
    };

    const handleDelete = async (id) => {
        Alert.alert(
            'Delete Address',
            'Are you sure you want to delete this address?',
            [
                {text: 'Cancel', style: 'cancel'},
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteAddress(String(id));
                            showMessage('Address deleted successfully');
                            await loadAddresses();
                        } catch (error) {
                            console.error('Delete address error:', error);
                            showMessage('Failed to delete address', true);
                        }
                    }
                }
            ]
        );
    };

    const handleEdit = (addr) => {
        router.push({
            pathname: '/screens/AddAddressScreen',
            params: {id: String(addr?._id || addr?.id)}
        });
    };

    const handleAddNew = () => {
        router.push('/screens/AddAddressScreen');
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/Home');
        }
    };

    const getAddressTypeIcon = (type) => {
        switch (type) {
            case 'home':
                return require('../../assets/icons/home.png');
            // case 'office':
            //     return require('../../assets/icons/business.png');
            // default:
            //     return require('../../assets/icons/location.png');
        }
    };

    const getAddressTypeLabel = (type) => {
        switch (type) {
            case 'home':
                return 'Home';
            case 'office':
                return 'Work';
            default:
                return 'Other';
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <StatusBar backgroundColor="#EC0505" barStyle="light-content"/>
                <ActivityIndicator size="large" color="#EC0505"/>
                <Text style={styles.loadingText}>Loading addresses...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#EC0505" barStyle="light-content"/>

            {/* Header - Blinkit Style */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Image
                            source={require("../../assets/icons/back_icon.png")}
                            style={styles.backIcon}
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Select Delivery Address</Text>
                    <View style={styles.headerPlaceholder}/>
                </View>

                <View style={styles.deliveryInfo}>
                    <Text style={styles.deliveryTime}>Delivery in 16 minutes</Text>
                    <Text style={styles.changeText}>Change</Text>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={["#FFE59A", "#FFD56C"]}
                        tintColor="#EC0505"
                    />
                }
            >
                {/* Current Location Option */}
                <TouchableOpacity style={styles.currentLocationCard}>
                    <View style={styles.locationIconContainer}>
                        {/*<Image*/}
                        {/*    source={require('../../assets/icons/gps.png')}*/}
                        {/*    style={styles.locationIcon}*/}
                        {/*/>*/}
                    </View>
                    <View style={styles.locationInfo}>
                        <Text style={styles.locationTitle}>Use current location</Text>
                        <Text style={styles.locationSubtitle}>Deliver to my current location</Text>
                    </View>
                    <Image
                        source={require('../../assets/icons/right-arrow.png')}
                        style={styles.arrowIcon}
                    />
                </TouchableOpacity>

                {/* Saved Addresses Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SAVED ADDRESSES</Text>

                    {addresses.length === 0 ? (
                        <View style={styles.emptyState}>
                            {/*<Image*/}
                            {/*    source={require('../../assets/icons/location-pin.png')}*/}
                            {/*    style={styles.emptyIcon}*/}
                            {/*/>*/}
                            <Text style={styles.emptyTitle}>No Saved Addresses</Text>
                            <Text style={styles.emptySubtitle}>
                                Add your delivery address for faster checkout
                            </Text>
                        </View>
                    ) : (
                        addresses.map((addr) => {
                            const id = addr?._id || addr?.id;
                            const isDefault = !!addr?.isDefault;

                            return (
                                <TouchableOpacity
                                    key={String(id)}
                                    style={[
                                        styles.addressCard,
                                        isDefault && styles.defaultAddressCard
                                    ]}
                                    onPress={() => handleSelectAddress(addr)}
                                    disabled={selectedAddressId === id}
                                >
                                    {/* Address Type Badge */}
                                    <View style={styles.addressHeader}>
                                        <View style={styles.addressTypeBadge}>
                                            <Image
                                                source={getAddressTypeIcon(addr?.type)}
                                                style={styles.typeIcon}
                                            />
                                            <Text style={styles.typeLabel}>
                                                {getAddressTypeLabel(addr?.type)}
                                            </Text>
                                        </View>
                                        {isDefault && (
                                            <View style={styles.defaultBadge}>
                                                <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Address Details */}
                                    <View style={styles.addressDetails}>
                                        <Text style={styles.contactInfo}>
                                            {addr?.name} • {addr?.phone}
                                        </Text>
                                        <Text style={styles.addressText}>
                                            {addr?.address}
                                        </Text>
                                        <Text style={styles.areaText}>
                                            {[addr?.landmark, addr?.city, addr?.state, addr?.pincode]
                                                .filter(Boolean)
                                                .join(', ')}
                                        </Text>
                                    </View>

                                    {/* Action Buttons */}
                                    <View style={styles.actionRow}>
                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={() => handleEdit(addr)}
                                        >
                                            <Image
                                                source={require('../../assets/icons/edit.png')}
                                                style={styles.actionIcon}
                                            />
                                            <Text style={styles.actionText}>Edit</Text>
                                        </TouchableOpacity>

                                        {!isDefault && (
                                            <TouchableOpacity
                                                style={styles.actionButton}
                                                onPress={() => handleSetDefault(id)}
                                            >
                                                <Text style={styles.actionText}>Set Default</Text>
                                            </TouchableOpacity>
                                        )}

                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={() => handleDelete(id)}
                                        >
                                            <Image
                                                source={require('../../assets/icons/deleteIcon.png')}
                                                style={[styles.actionIcon, styles.deleteIcon]}
                                            />
                                            <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Selection Overlay */}
                                    {selectedAddressId === id && (
                                        <View style={styles.selectingOverlay}>
                                            <ActivityIndicator size="small" color="#EC0505"/>
                                            <Text style={styles.selectingText}>Selecting...</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>

                {/* Add Space at Bottom */}
                <View style={styles.bottomSpacer}/>
            </ScrollView>

            {/* Fixed Add Address Button - Blinkit Style */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddNew}
                >
                    {/*<Image*/}
                    {/*    source={require('../../assets/icons/plus-white.png')}*/}
                    {/*    style={styles.plusIcon}*/}
                    {/*/>*/}
                    <Text style={styles.addButtonText}>ADD NEW ADDRESS</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    // Header Styles
    header: {
        backgroundColor: '#4CAD73',
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    backButton: {
        padding: 8,
    },
    backIcon: {
        width: 24,
        height: 24,
        tintColor: '#FFFFFF',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Poppins-Bold',
    },
    headerPlaceholder: {
        width: 40,
    },
    deliveryInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    deliveryTime: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        fontFamily: 'Poppins-SemiBold',
    },
    changeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        textDecorationLine: 'underline',
        fontFamily: 'Poppins-SemiBold',
    },
    // Scroll View
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 100,
    },
    // Current Location Card
    currentLocationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    locationIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFE8E8',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    locationIcon: {
        width: 20,
        height: 20,
        tintColor: '#4CAD73',
    },
    locationInfo: {
        flex: 1,
    },
    locationTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1B1B1B',
        fontFamily: 'Poppins-SemiBold',
        marginBottom: 2,
    },
    locationSubtitle: {
        fontSize: 12,
        color: '#666',
        fontFamily: 'Poppins-Regular',
    },
    arrowIcon: {
        width: 16,
        height: 16,
        tintColor: '#666',
    },
    // Section Styles
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#666',
        marginBottom: 12,
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.5,
    },
    // Address Card Styles
    addressCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        position: 'relative',
    },
    defaultAddressCard: {
        borderColor: '#4CAD73',
        borderWidth: 2,
    },
    addressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    addressTypeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    typeIcon: {
        width: 14,
        height: 14,
        marginRight: 6,
        tintColor: '#666',
    },
    typeLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
        fontFamily: 'Poppins-SemiBold',
        textTransform: 'uppercase',
    },
    defaultBadge: {
        backgroundColor: '#4CAD73',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    defaultBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Poppins-Bold',
    },
    addressDetails: {
        marginBottom: 12,
    },
    contactInfo: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1B1B1B',
        fontFamily: 'Poppins-SemiBold',
        marginBottom: 6,
    },
    addressText: {
        fontSize: 14,
        color: '#333',
        fontFamily: 'Poppins-Regular',
        lineHeight: 18,
        marginBottom: 4,
    },
    areaText: {
        fontSize: 13,
        color: '#666',
        fontFamily: 'Poppins-Regular',
        lineHeight: 16,
    },
    // Action Row
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingTop: 12,
        gap: 20,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },
    actionIcon: {
        width: 14,
        height: 14,
        marginRight: 6,
        tintColor: '#4CAD73',
    },
    deleteIcon: {
        tintColor: '#4CAD73',
    },
    actionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4CAD73',
        fontFamily: 'Poppins-SemiBold',
    },
    deleteText: {
        color: '#4CAD73',
    },
    // Selecting Overlay
    selectingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    selectingText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4CAD73',
        fontFamily: 'Poppins-SemiBold',
    },
    // Empty State
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        marginBottom: 16,
        opacity: 0.5,
        tintColor: '#666',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1B1B1B',
        fontFamily: 'Poppins-SemiBold',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
        fontFamily: 'Poppins-Regular',
    },
    // Loading State
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
        fontFamily: 'Poppins-Regular',
    },
    // Footer
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        shadowColor: '#000',
        shadowOffset: {width: 0, height: -2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 8,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4CAD73',
        paddingVertical: 16,
        borderRadius: 12,
        shadowColor: '#4CAD73',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    plusIcon: {
        width: 18,
        height: 18,
        marginRight: 8,
        tintColor: '#FFFFFF',
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'Poppins-Bold',
    },
    bottomSpacer: {
        height: 20,
    },
});
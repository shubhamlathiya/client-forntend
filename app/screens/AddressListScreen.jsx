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
    RefreshControl
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

            // showMessage('Address selected successfully');

            // Always go back to previous screen regardless of where user came from
            if (router.canGoBack()) {
                router.back();
            } else {
                // Fallback if no back history
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
            'Are you sure you want to delete this address? This action cannot be undone.',
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
                return 'Office';
            default:
                return 'Other';
        }
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/Home');
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAD73"/>
                <Text style={styles.loadingText}>Loading addresses...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={handleBack}>
                    <Image
                        source={require("../../assets/icons/back_icon.png")}
                        style={styles.iconBox}
                    />
                </TouchableOpacity>
                <Text style={styles.heading}>My Addresses</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#4CAD73']}
                        tintColor="#4CAD73"
                    />
                }
            >
                {/* Empty State */}
                {addresses.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>No Addresses Yet</Text>
                        <Text style={styles.emptySubtitle}>
                            Add your first address to get started with faster checkout
                        </Text>
                        <TouchableOpacity style={styles.emptyCta} onPress={handleAddNew}>
                            <Text style={styles.emptyCtaText}>Add Your First Address</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.addressList}>
                        <Text style={styles.sectionTitle}>Saved Addresses ({addresses.length})</Text>

                        {addresses.map((addr) => {
                            const id = addr?._id || addr?.id;
                            const isDefault = !!addr?.isDefault;

                            return (
                                <View key={String(id)} style={[
                                    styles.addressCard,
                                    isDefault && styles.addressCardDefault
                                ]}>
                                    {/* Card Header */}
                                    <TouchableOpacity
                                        onPress={() => handleSelectAddress(addr)}
                                        disabled={selectedAddressId === id}
                                    >
                                        <View style={styles.cardHeader}>
                                            <View style={styles.addressType}>
                                                <Image
                                                    source={getAddressTypeIcon(addr?.type)}
                                                    style={styles.typeIcon}
                                                />
                                                <Text style={styles.typeLabel}>
                                                    {getAddressTypeLabel(addr?.type)}
                                                </Text>
                                            </View>

                                            <View style={styles.headerBadges}>
                                                {isDefault && (
                                                    <View style={styles.defaultBadge}>
                                                        <Text style={styles.defaultBadgeText}>Default</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>

                                        {/* Address Details */}
                                        <View style={styles.addressDetails}>
                                            <Text style={styles.contactName}>{addr?.name}</Text>
                                            <Text style={styles.contactPhone}>{addr?.phone}</Text>

                                            <Text style={styles.addressText}>
                                                {addr?.address}
                                            </Text>

                                            <Text style={styles.addressArea}>
                                                {[addr?.city, addr?.state, addr?.pincode]
                                                    .filter(Boolean)
                                                    .join(', ')}
                                            </Text>

                                            {addr?.country && (
                                                <Text style={styles.addressCountry}>{addr?.country}</Text>
                                            )}
                                        </View>

                                        {/* Select Button */}
                                        <View style={styles.selectButtonContainer}>
                                            <TouchableOpacity
                                                style={styles.selectButton}
                                                onPress={() => handleSelectAddress(addr)}
                                                disabled={selectedAddressId === id}
                                            >
                                                <Text style={styles.selectButtonText}>
                                                    {selectedAddressId === id ? 'Selecting...' : 'Select This Address'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </TouchableOpacity>

                                    {/* Action Buttons */}
                                    <View style={styles.actionButtons}>
                                        <View style={styles.secondaryActions}>
                                            <TouchableOpacity
                                                style={styles.iconButton}
                                                onPress={() => handleEdit(addr)}
                                            >
                                                <Image
                                                    source={require('../../assets/icons/edit.png')}
                                                    style={styles.icon}
                                                />
                                                <Text style={styles.iconButtonText}>Edit</Text>
                                            </TouchableOpacity>

                                            {!isDefault && (
                                                <TouchableOpacity
                                                    style={styles.iconButton}
                                                    onPress={() => handleSetDefault(id)}
                                                >
                                                    <Text style={styles.iconButtonText}>Set Default</Text>
                                                </TouchableOpacity>
                                            )}

                                            <TouchableOpacity
                                                style={styles.iconButton}
                                                onPress={() => handleDelete(id)}
                                            >
                                                <Image
                                                    source={require('../../assets/icons/deleteIcon.png')}
                                                    style={[styles.icon, styles.deleteIcon]}
                                                />
                                                <Text style={[styles.iconButtonText, styles.deleteText]}>
                                                    Delete
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* Fixed Footer Actions */}
            {addresses.length > 0 && (
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={handleAddNew}
                    >
                        <Text style={styles.addButtonText}>Add New Address</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    topBar: {
        padding: 20,
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    heading: {
        fontSize: 24,
        fontWeight: '500',
        color: '#1B1B1B',
        alignItems: 'center',
        marginLeft: 20
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1B1B1B',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 20,
    },
    emptyCta: {
        backgroundColor: '#4CAD73',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 16,
        shadowColor: '#4CAD73',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    emptyCtaText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    addressList: {
        paddingTop: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1B1B1B',
        marginBottom: 16,
    },
    addressCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    addressCardDefault: {
        borderWidth: 2,
        borderColor: '#4CAD73',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    addressType: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    typeIcon: {
        width: 16,
        height: 16,
        marginRight: 8,
        tintColor: '#666',
    },
    typeLabel: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
        textTransform: 'capitalize',
    },
    headerBadges: {
        flexDirection: 'row',
    },
    defaultBadge: {
        backgroundColor: 'rgba(76, 173, 115, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    defaultBadgeText: {
        color: '#4CAD73',
        fontSize: 12,
        fontWeight: '600',
    },
    addressDetails: {
        marginBottom: 16,
    },
    contactName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1B1B1B',
        marginBottom: 4,
    },
    contactPhone: {
        fontSize: 14,
        color: '#666',
        marginBottom: 12,
    },
    addressText: {
        fontSize: 14,
        color: '#333',
        lineHeight: 20,
        marginBottom: 4,
    },
    addressArea: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        marginBottom: 4,
    },
    addressCountry: {
        fontSize: 14,
        color: '#666',
    },
    selectButtonContainer: {
        marginBottom: 16,
    },
    selectButton: {
        backgroundColor: '#4CAD73',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    actionButtons: {
        gap: 12,
    },
    secondaryActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    iconButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    icon: {
        width: 16,
        height: 16,
        marginRight: 6,
        tintColor: '#4CAD73',
    },
    deleteIcon: {
        tintColor: '#FF3B30',
    },
    iconButtonText: {
        fontSize: 14,
        color: '#4CAD73',
        fontWeight: '500',
    },
    deleteText: {
        color: '#FF3B30',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4CAD73',
        paddingVertical: 16,
        borderRadius: 16,
        shadowColor: '#4CAD73',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
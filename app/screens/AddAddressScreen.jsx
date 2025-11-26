import AsyncStorage from '@react-native-async-storage/async-storage';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useEffect, useState} from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    ToastAndroid,
    TouchableOpacity,
    View,
    Platform,
    Image,
    KeyboardAvoidingView,
    ActivityIndicator
} from 'react-native';
import {addAddress, getAddresses, updateAddress, setDefaultAddress} from '../../api/addressApi';

const initialForm = {
    name: '',
    phone: '',
    address: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    type: 'home',
    isDefault: false,
    latitude: '',
    longitude: ''
};

const AddressType = {
    HOME: 'home',
    OFFICE: 'office',
    OTHER: 'other'
};

export default function AddAddressScreen() {
    const router = useRouter();
    const {id, currentLocation} = useLocalSearchParams();
    const isEdit = !!id;
    const [form, setForm] = useState(initialForm);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(isEdit);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/Home');
        }
    };

    useEffect(() => {
        loadAddressData();
    }, [id]);

    useEffect(() => {
        if (currentLocation) {
            try {
                const currentLocationData = JSON.parse(currentLocation);
                console.log('Current location data received:', currentLocationData);

                // Pre-fill the form with current location data
                setForm(prev => ({
                    ...prev,
                    name: currentLocationData.name || 'Current Location',
                    address: currentLocationData.address || '',
                    landmark: currentLocationData.landmark || '',
                    city: currentLocationData.city || '',
                    state: currentLocationData.state || '',
                    pincode: currentLocationData.pincode || '',
                    latitude: currentLocationData.latitude || '',
                    longitude: currentLocationData.longitude || '',
                }));

                showMessage('Current location data loaded! Please complete the address details.');
            } catch (error) {
                console.error('Error parsing current location data:', error);
                showMessage('Failed to load location data', true);
            }
        }
    }, [currentLocation]);

    const loadAddressData = async () => {
        if (!isEdit) return;

        try {
            setLoading(true);
            const res = await getAddresses();
            const data = res?.data ?? res?.addresses ?? res ?? [];
            const list = Array.isArray(data) ? data : (data?.data || []);
            const addr = list.find(a => String(a?._id || a?.id) === String(id));

            if (addr) {
                setForm({
                    name: addr?.name || '',
                    phone: addr?.phone || '',
                    address: addr?.address || '',
                    landmark: addr?.landmark || '',
                    city: addr?.city || '',
                    state: addr?.state || '',
                    pincode: addr?.pincode || addr?.postalCode || '',
                    country: addr?.country || 'India',
                    type: addr?.type || AddressType.HOME,
                    isDefault: !!addr?.isDefault,
                    latitude: addr?.latitude || '',
                    longitude: addr?.longitude || ''
                });
            }
        } catch (error) {
            console.error('Error loading address:', error);
            showMessage('Failed to load address data', true);
        } finally {
            setLoading(false);
        }
    };

    const onChange = (key, value) => {
        setForm(prev => ({...prev, [key]: value}));
    };

    const validateForm = () => {
        const errors = [];

        if (!form.name.trim()) errors.push('Name is required');

        if (!form.phone.trim()) {
            errors.push('Phone number is required');
        } else if (!/^[0-9]{10}$/.test(form.phone.trim())) {
            errors.push('Please enter a valid 10-digit phone number');
        }

        if (!form.address.trim()) errors.push('Address is required');
        if (!form.city.trim()) errors.push('City is required');
        if (!form.state.trim()) errors.push('State is required');

        if (!form.pincode.trim()) {
            errors.push('Pincode is required');
        } else if (!/^[0-9]{6}$/.test(form.pincode.trim())) {
            errors.push('Please enter a valid 6-digit pincode');
        }

        if (!form.country.trim()) errors.push('Country is required');

        if (!Object.values(AddressType).includes(form.type)) {
            errors.push('Please select a valid address type');
        }

        return errors;
    };

    const showMessage = (message, isError = false) => {
        if (Platform.OS === 'android') {
            ToastAndroid.show(message, isError ? ToastAndroid.LONG : ToastAndroid.SHORT);
        } else {
            Alert.alert(isError ? 'Error' : 'Success', message);
        }
    };

    const handleSubmit = async () => {
        const errors = validateForm();
        if (errors.length > 0) {
            showMessage(errors.join('\n'), true);
            return;
        }

        setSaving(true);
        try {
            const addressData = {
                name: form.name.trim(),
                phone: form.phone.trim(),
                address: form.address.trim(),
                landmark: form.landmark.trim(),
                city: form.city.trim(),
                state: form.state.trim(),
                pincode: form.pincode.trim(),
                country: form.country.trim(),
                type: form.type,
                isDefault: !!form.isDefault,
                ...(form.latitude && { latitude: form.latitude }),
                ...(form.longitude && { longitude: form.longitude })
            };

            console.log('Submitting address data:', addressData);

            let result;
            if (isEdit) {
                result = await updateAddress(String(id), addressData);
            } else {
                result = await addAddress(addressData);
            }

            const savedAddress = result?.data || result;
            const addressId = String(savedAddress?._id || savedAddress?.id || id);

            // Set as default if requested
            if (form.isDefault && addressId) {
                try {
                    await setDefaultAddress(addressId);
                } catch (error) {
                    console.warn('Failed to set default address:', error);
                }
            }

            showMessage(`Address ${isEdit ? 'updated' : 'added'} successfully`);

            // Navigate back to address list
            router.push('/screens/AddressListScreen');
        } catch (error) {
            console.error('Save address error:', error);
            showMessage(`Failed to ${isEdit ? 'update' : 'add'} address`, true);
        } finally {
            setSaving(false);
        }
    };

    const getAddressTypeIcon = (type) => {
        switch (type) {
            case AddressType.HOME:
                return require('../../assets/icons/home.png');
            case AddressType.OFFICE:
                return require('../../assets/icons/business.png');
            case AddressType.OTHER:
                return require('../../assets/icons/location.png');
            default:
                return require('../../assets/icons/home.png');
        }
    };

    // --- Sanitizers ---
    const onlyText = (v) => v.replace(/[^a-zA-Z ]/g, '');
    const onlyNumbers = (v, limit = null) => {
        let cleaned = v.replace(/[^0-9]/g, '');
        return limit ? cleaned.slice(0, limit) : cleaned;
    };
    const safeAddress = (v) =>
        v.replace(/[^a-zA-Z0-9 ,./-]/g, '');

    const getAddressTypeLabel = (type) => {
        switch (type) {
            case AddressType.HOME:
                return 'Home';
            case AddressType.OFFICE:
                return 'Work';
            case AddressType.OTHER:
                return 'Other';
            default:
                return 'Home';
        }
    };

    // Function to use current location again
    const handleUseCurrentLocation = () => {
        router.push('/screens/AddressListScreen');
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAD73"/>
                <Text style={styles.loadingText}>Loading address...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleBack}
                        disabled={saving}
                    >
                        <Image
                            source={require("../../assets/icons/back_icon.png")}
                            style={styles.backIcon}
                        />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>
                        {isEdit ? 'Edit Address' : 'Add New Address'}
                    </Text>

                    <View style={styles.headerPlaceholder}/>
                </View>

                {/* Current Location Banner */}
                {(currentLocation && !isEdit) && (
                    <View style={styles.locationBanner}>
                        <View style={styles.locationBannerContent}>
                            <Image
                                source={require('../../assets/icons/location.png')}
                                style={styles.locationBannerIcon}
                            />
                            <View style={styles.locationBannerText}>
                                <Text style={styles.locationBannerTitle}>
                                    Current Location Detected
                                </Text>
                                <Text style={styles.locationBannerSubtitle}>
                                    Address has been pre-filled with your current location
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.refreshLocationButton}
                            onPress={handleUseCurrentLocation}
                            disabled={saving}
                        >
                            <Image
                                source={require('../../assets/icons/refresh.png')}
                                style={styles.refreshIcon}
                            />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Contact Info */}
                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Contact Information</Text>

                    <InputField
                        label="Full Name"
                        value={form.name}
                        placeholder="Enter your full name"
                        onChangeText={(v) => onChange('name', onlyText(v))}
                        editable={!saving}
                    />

                    <InputField
                        label="Phone Number"
                        value={form.phone}
                        onChangeText={(v) => onChange('phone', onlyNumbers(v, 10))}
                        placeholder="Enter your 10-digit phone number"
                        keyboardType="phone-pad"
                        maxLength={10}
                        editable={!saving}
                    />
                </View>

                {/* Address Details */}
                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Address Details</Text>

                    <InputField
                        label="Street Address"
                        value={form.address}
                        onChangeText={(v) => onChange('address', safeAddress(v))}
                        placeholder="House no., Building, Street, Area"
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        editable={!saving}
                    />

                    <InputField
                        label="Landmark (Optional)"
                        value={form.landmark}
                        onChangeText={(v) => onChange('landmark', safeAddress(v))}
                        placeholder="Nearby landmark, if any"
                        editable={!saving}
                    />

                    <View style={styles.row}>
                        <View style={styles.flex}>
                            <InputField
                                label="City"
                                value={form.city}
                                onChangeText={(v) => onChange('city', onlyText(v))}
                                placeholder="City"
                                autoCapitalize="words"
                                editable={!saving}
                            />
                        </View>

                        <View style={styles.spacer}/>

                        <View style={styles.flex}>
                            <InputField
                                label="State"
                                value={form.state}
                                onChangeText={(v) => onChange('state', onlyText(v))}
                                placeholder="State"
                                autoCapitalize="words"
                                editable={!saving}
                            />
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={styles.flex}>
                            <InputField
                                label="Pincode"
                                value={form.pincode}
                                onChangeText={(v) => onChange('pincode', onlyNumbers(v, 6))}
                                placeholder="6-digit pincode"
                                keyboardType="numeric"
                                maxLength={6}
                                editable={!saving}
                            />
                        </View>

                        <View style={styles.spacer}/>

                        <View style={styles.flex}>
                            <InputField
                                label="Country"
                                value={form.country}
                                onChangeText={(v) => onChange('country', onlyText(v))}
                                placeholder="Country"
                                autoCapitalize="words"
                                editable={!saving}
                            />
                        </View>
                    </View>

                    {/* Coordinates (Read-only) */}
                    {(form.latitude && form.longitude) && (
                        <View style={styles.coordinatesContainer}>
                            <Text style={styles.coordinatesLabel}>Location Coordinates</Text>
                            <Text style={styles.coordinatesText}>
                                Lat: {form.latitude}, Lng: {form.longitude}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Address Type */}
                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Address Type</Text>

                    <View style={styles.typeContainer}>
                        {Object.values(AddressType).map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    styles.typeOption,
                                    form.type === type && styles.typeOptionSelected,
                                    saving && styles.disabled
                                ]}
                                onPress={() => !saving && onChange('type', type)}
                                disabled={saving}
                            >
                                <Image
                                    source={getAddressTypeIcon(type)}
                                    style={[
                                        styles.typeIcon,
                                        form.type === type && styles.typeIconSelected
                                    ]}
                                />

                                <Text
                                    style={[
                                        styles.typeLabel,
                                        form.type === type && styles.typeLabelSelected
                                    ]}
                                >
                                    {getAddressTypeLabel(type)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Default Toggle */}
                <View style={styles.defaultContainer}>
                    <TouchableOpacity
                        onPress={() => !saving && onChange('isDefault', !form.isDefault)}
                        disabled={saving}
                        style={{ flexDirection: "row", alignItems: "center" }}
                    >
                        <Image
                            source={
                                form.isDefault
                                    ? require('../../assets/icons/check.png')   // checked image
                                    : require('../../assets/icons/uncheck.png') // unchecked image
                            }
                            style={{ width: 24, height: 24 }}
                        />

                        <View style={{ marginLeft: 12 }}>
                            <Text>Set as default address</Text>
                            <Text>This address will be used as your primary shipping address</Text>
                        </View>
                    </TouchableOpacity>

                </View>
            </ScrollView>

            {/* Submit */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.submitButton,
                        saving && styles.submitButtonDisabled
                    ]}
                    onPress={handleSubmit}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#FFFFFF" size="small"/>
                    ) : (
                        <Text style={styles.submitButtonText}>
                            {isEdit ? 'Update Address' : 'Save Address'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

function InputField({label, ...props}) {
    return (
        <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{label}</Text>
            <TextInput
                style={styles.input}
                placeholderTextColor="#A0A0A0"
                {...props}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: 100,
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
        fontFamily: 'Poppins-Regular',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        marginTop: Platform.OS === 'ios' ? 40 : 20,
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
        fontFamily: 'Poppins-SemiBold',
    },
    headerPlaceholder: {
        width: 32,
    },
    // Location Banner
    locationBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#E8F5E8',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#4CAD73',
    },
    locationBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    locationBannerIcon: {
        width: 24,
        height: 24,
        tintColor: '#4CAD73',
        marginRight: 12,
    },
    locationBannerText: {
        flex: 1,
    },
    locationBannerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1B1B1B',
        fontFamily: 'Poppins-SemiBold',
        marginBottom: 2,
    },
    locationBannerSubtitle: {
        fontSize: 12,
        color: '#666',
        fontFamily: 'Poppins-Regular',
    },
    refreshLocationButton: {
        padding: 8,
    },
    refreshIcon: {
        width: 20,
        height: 20,
        tintColor: '#4CAD73',
    },
    // Coordinates
    coordinatesContainer: {
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
    },
    coordinatesLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#666',
        fontFamily: 'Poppins-Medium',
        marginBottom: 4,
    },
    coordinatesText: {
        fontSize: 11,
        color: '#888',
        fontFamily: 'Poppins-Regular',
    },
    formSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1B1B1B',
        marginBottom: 16,
        fontFamily: 'Poppins-SemiBold',
    },
    inputContainer: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333333',
        marginBottom: 8,
        fontFamily: 'Poppins-Medium',
    },
    input: {
        height: 52,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Poppins-Regular',
        color: '#1B1B1B',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    flex: {
        flex: 1,
    },
    spacer: {
        width: 12,
    },
    typeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    typeOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 4,
    },
    typeOptionSelected: {
        borderColor: '#4CAD73',
        backgroundColor: 'rgba(76, 173, 115, 0.1)',
    },
    typeIcon: {
        width: 20,
        height: 20,
        marginRight: 8,
        tintColor: '#666',
    },
    typeIconSelected: {
        tintColor: '#4CAD73',
    },
    typeLabel: {
        fontSize: 14,
        color: '#666',
        fontFamily: 'Poppins-Medium',
    },
    typeLabelSelected: {
        color: '#4CAD73',
    },
    defaultContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    defaultRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#E8E8E8',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    checkboxChecked: {
        borderColor: '#4CAD73',
        backgroundColor: '#4CAD73',
    },
    checkIcon: {
        width: 12,
        height: 12,
        tintColor: '#FFFFFF',
    },
    defaultTextContainer: {
        flex: 1,
        marginLeft: 12,
    },
    defaultLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1B1B1B',
        fontFamily: 'Poppins-Medium',
        marginBottom: 4,
    },
    defaultSubtitle: {
        fontSize: 14,
        color: '#666',
        fontFamily: 'Poppins-Regular',
        lineHeight: 18,
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
    submitButton: {
        height: 56,
        borderRadius: 16,
        backgroundColor: '#4CAD73',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#4CAD73',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        fontFamily: 'Poppins-SemiBold',
    },
    disabled: {
        opacity: 0.5,
    },
});
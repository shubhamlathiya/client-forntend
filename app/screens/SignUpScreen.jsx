import {useRouter} from 'expo-router';
import {useState} from 'react';
import {Alert, Image, StyleSheet, Text, TextInput, Pressable, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors} from '../../constants/colors';
import {fonts} from '../../constants/fonts';
import {globalStyles} from '../../constants/globalStyles';

import {registerUser} from '../../api/authApi';
import {googleLogin} from "../../utils/googleLoginHelper";

export default function SignUpScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    async function handleSignUp() {
        if (loading) return;

        // Basic pre-checks
        if (!email || !password) {
            Alert.alert('Error', 'Email and password are required');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        // Local validation (same as backend)
        const errors = [];

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Must be a valid email address');
        }

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        } else {
            if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
            if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
            if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
            if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Password must contain at least one special character');
        }

        if (errors.length > 0) {
            Alert.alert('Error', errors.join(', '));
            return;
        }

        setLoading(true);

        try {
            const name = email.split('@')[0];

            const data = await registerUser({
                name,
                email,
                phone: undefined,
                password
            });

            // Backend success response
            Alert.alert('Success', data?.message || 'User registered successfully.');

            router.push({
                pathname: '/screens/VerifyOtpScreen',
                params: { email }
            });

        } catch (error) {
            console.log("❌ Registration error:", error.message);
            Alert.alert('Error', error.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    }



    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/screens/AuthScreen');
        }
    };


    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const toggleConfirmPasswordVisibility = () => {
        setShowConfirmPassword(!showConfirmPassword);
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Back Icon and Title */}
            <View style={globalStyles.header}>
                <Pressable style={globalStyles.backButton} onPress={handleBack}>
                    <Image source={require("../../assets/icons/back_icon.png")} style={globalStyles.backIcon}/>
                </Pressable>
                <Text style={globalStyles.title}>Sign Up</Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        placeholder="Type your email"
                        placeholderTextColor="#838383"
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Password</Text>
                    <View style={styles.passwordContainer}>
                        <TextInput
                            placeholder="Type your password"
                            placeholderTextColor="#838383"
                            secureTextEntry={!showPassword}
                            style={styles.passwordInput}
                            value={password}
                            onChangeText={setPassword}
                            autoCapitalize="none"
                        />
                        <Pressable
                            style={styles.eyeButton}
                            onPress={togglePasswordVisibility}
                        >
                            <Image
                                source={
                                    showPassword
                                        ? require("../../assets/icons/eye_open.png")
                                        : require("../../assets/icons/eye_closed.png")
                                }
                                style={styles.eyeIcon}
                            />
                        </Pressable>
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirm Password</Text>
                    <View style={styles.passwordContainer}>
                        <TextInput
                            placeholder="Confirm your password"
                            placeholderTextColor="#838383"
                            secureTextEntry={!showConfirmPassword}
                            style={styles.passwordInput}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            autoCapitalize="none"
                        />
                        <Pressable
                            style={styles.eyeButton}
                            onPress={toggleConfirmPasswordVisibility}
                        >
                            <Image
                                source={
                                    showConfirmPassword
                                        ? require("../../assets/icons/eye_open.png")
                                        : require("../../assets/icons/eye_closed.png")
                                }
                                style={styles.eyeIcon}
                            />
                        </Pressable>
                    </View>
                </View>

                <Pressable style={styles.signupBtn} onPress={handleSignUp} disabled={loading}>
                    <Text style={styles.signupBtnText}>{loading ? 'Loading...' : 'Sign Up'}</Text>
                </Pressable>

                <View style={styles.divider}>
                    <View style={globalStyles.line}/>
                    <Text style={styles.orText}>Or</Text>
                    <View style={globalStyles.line}/>
                </View>

                {/* Google Button */}
                <Pressable style={globalStyles.socialBtn} onPress={() => googleLogin(router, setGoogleLoading)}
                           disabled={googleLoading}>
                    <Image
                        source={require("../../assets/google_logo.png")}
                        style={globalStyles.socialIcon}
                    />
                    <Text style={globalStyles.socialText}>Continue with Google</Text>
                </Pressable>

                {/* Facebook Button */}
                <Pressable style={globalStyles.socialBtn}>
                    <Image
                        source={require("../../assets/facebook.png")}
                        style={globalStyles.socialIcon}
                    />
                    <Text style={globalStyles.socialText}>Continue with Facebook</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 40,
        paddingHorizontal: 20,
    },
    header: {
        width: '100%',
        marginTop: 40,
        marginBottom: 20,
        alignItems: 'center',
    },
    backButton: {
        position: 'absolute',
        left: 20,
        top: 0,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backArrow: {
        width: 20,
        height: 2,
        backgroundColor: colors.primaryGreen,
        transform: [{rotate: '135deg'}],
    },
    title: {
        fontFamily: fonts.medium,
        fontSize: 24,
        color: '#000',
    },
    formContainer: {
        marginTop: 40,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        color: "#1B1B1B",
        fontFamily: "Poppins",
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: "#E6E6E6",
        borderRadius: 12,
        padding: 13,
        fontSize: 14,
        color: "#1B1B1B",
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: "#E6E6E6",
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
    },
    passwordInput: {
        flex: 1,
        padding: 13,
        fontSize: 14,
        color: "#1B1B1B",
    },
    eyeButton: {
        padding: 10,
        marginRight: 5,
    },
    eyeIcon: {
        width: 20,
        height: 20,
        tintColor: '#838383',
    },
    signupBtn: {
        backgroundColor: "#4CAD73",
        borderRadius: 12,
        alignItems: "center",
        paddingVertical: 14,
        marginTop: 20,
    },
    divider: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginVertical: 20,
    },
    orText: {
        fontFamily: fonts.regular,
        fontSize: 16,
        color: '#838383',
    },
    signupBtnText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "500",
    },
});
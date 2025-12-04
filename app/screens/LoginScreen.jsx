import AsyncStorage from "@react-native-async-storage/async-storage";
import CheckBox from "expo-checkbox";
import {useRouter} from "expo-router";
import * as SecureStore from 'expo-secure-store';
import {useState} from "react";
import {
    Alert,
    Image, StatusBar,
    StyleSheet,
    Text, TextInput, Pressable,
    View
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {loginUser} from '../../api/authApi';
import {mergeGuestCart} from '../../api/cartApi';
import {globalStyles} from '../../constants/globalStyles';
import {facebookLogin, googleLogin} from "../../utils/googleLoginHelper";


export default function LoginScreen() {
    const router = useRouter();
    const [isChecked, setChecked] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [facebookLoading, setFacebookLoading] = useState(false);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/screens/AuthScreen');
        }
    };

    function handleSignUp() {
        router.replace("/screens/SignUpScreen");
    }

    async function handleLogin() {
        if (loading) return;
        setLoading(true);
        try {
            const data = await loginUser({email, password});
            // Persist tokens if provided
            const accessToken = data?.accessToken || data?.token || data?.tokens?.accessToken;
            const refreshToken = data?.refreshToken || data?.tokens?.refreshToken;
            const user = data?.user || data?.data?.user || null;
            if (accessToken) {
                await SecureStore.setItemAsync('accessToken', String(accessToken));
            }
            if (refreshToken) {
                await SecureStore.setItemAsync('refreshToken', String(refreshToken));
            }
            // Also persist session in AsyncStorage for AccountScreen
            if (user) {
                await AsyncStorage.setItem('userData', JSON.stringify(user));
            }
            if (accessToken) {
                await AsyncStorage.setItem('token', String(accessToken));
            }
            // Merge guest cart into user account after successful login
            try {
                await mergeGuestCart();
            } catch (_) {
            }
            // After login, go to login type selection
            router.replace("/screens/LoginTypeSelectionScreen");
        } catch (error) {
            const message = error?.response?.data?.message || 'Login failed. Please check your credentials.';
            Alert.alert('Error', message);
        } finally {
            setLoading(false);
        }
    }


    function handleForgotPassword() {
        router.replace("/screens/ForgotPasswordScreen");
    }

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF"/>

            <View style={{flexDirection: "row", alignItems: "center", marginTop: 10}}>
                <Pressable onPress={handleBack}>
                    <Image
                        source={require("../../assets/icons/back_icon.png")}
                        style={globalStyles.backIcon}
                    />
                </Pressable>

                <View style={{flex: 1, alignItems: "center", position: "absolute", width: "100%"}}>
                    <Text style={globalStyles.title}>Log In</Text>
                </View>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
                {/* Email */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Type your email"
                        placeholderTextColor="#838383"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Password</Text>
                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            placeholder="Type your password"
                            placeholderTextColor="#838383"
                            secureTextEntry={!showPassword}
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

                {/* Remember + Forgot */}
                <View style={styles.rememberRow}>
                    <View style={styles.rememberLeft}>
                        <View
                            style={{
                                width: 20,
                                height: 20,
                                borderRadius: 4,
                                overflow: 'hidden',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            <CheckBox
                                value={isChecked}
                                onValueChange={setChecked}
                                color="#09CA67"
                                style={{
                                    width: 17,
                                    height: 17,
                                }}
                            />
                        </View>

                        <Text style={styles.rememberText}>Remember me</Text>
                    </View>
                    <Text style={styles.forgotText} onPress={handleForgotPassword}>Forgot password?</Text>
                </View>

                {/* Log In Button */}
                <Pressable style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
                    <Text style={styles.loginBtnText}>{loading ? 'Logging in...' : 'Log In'}</Text>
                </Pressable>

                {/* Divider */}
                <View style={styles.divider}>
                    <View style={styles.line}/>
                    <Text style={styles.orText}>Or</Text>
                    <View style={styles.line}/>
                </View>

                {/* Google Button */}
                <Pressable style={globalStyles.socialBtn} onPress={() => googleLogin(router, setGoogleLoading)} disabled={googleLoading}>
                    <Image
                        source={require("../../assets/google_logo.png")}
                        style={globalStyles.socialIcon}
                    />
                    <Text style={globalStyles.socialText}>
                        {googleLoading ? 'Connecting...' : 'Continue with Google'}
                    </Text>
                </Pressable>

                {/* Facebook Button */}
                <Pressable style={globalStyles.socialBtn} onPress={() => facebookLogin(router, setFacebookLoading)} disabled={googleLoading}>
                    <Image
                        source={require("../../assets/facebook.png")}
                        style={globalStyles.socialIcon}
                    />
                    <Text style={globalStyles.socialText}>Continue with Facebook</Text>
                </Pressable>

                {/* Register Text */}
                <Text style={styles.registerText}>
                    Don't have an account?
                    <Text onPress={handleSignUp}
                          style={{color: "#007DFC"}}> Register</Text>
                </Text>
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
        paddingVertical: 16,
        alignItems: "center",
    },
    headerTitle: {
        fontSize: 24,
        fontFamily: "Poppins",
        fontWeight: "500",
        color: "#1B1B1B",
        lineHeight: 36,
        textAlign: "center",
    },
    formContainer: {
        marginTop: 40,
    },
    inputGroup: {
        marginBottom: 18,
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
    rememberRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    rememberLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    rememberText: {
        fontSize: 12,
        color: "#1B1B1B",
    },
    forgotText: {
        fontSize: 12,
        color: "#838383",
    },
    loginBtn: {
        backgroundColor: "#4CAD73",
        borderRadius: 12,
        alignItems: "center",
        paddingVertical: 14,
        marginTop: 20,
    },
    loginBtnText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "500",
    },
    divider: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginVertical: 20,
    },
    line: {
        height: 1,
        flex: 1,
        backgroundColor: "#D9D9D9",
    },
    orText: {
        color: "#838383",
        fontSize: 16,
    },
    registerText: {
        textAlign: "center",
        color: "#838383",
        fontSize: 14,
    },
});
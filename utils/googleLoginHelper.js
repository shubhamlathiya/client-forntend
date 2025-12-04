import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {Alert} from "react-native";
import {API_BASE_URL} from "../config/apiConfig";
import {mergeGuestCart} from "../api/cartApi";
import {setAccessToken} from "./apiClient";
import * as SecureStore from "expo-secure-store"; // if you have it

WebBrowser.maybeCompleteAuthSession();

const APP_REDIRECT = "exp://192.168.0.119:8081/--/auth/callback";
// const APP_REDIRECT = "exp://10.244.170.75:8081/--/auth/callback";
// const APP_REDIRECT = "clientforntend://auth/callback";
//
// ---------------------------
// Google Login
// ---------------------------
export async function googleLogin(router, setGoogleLoading) {
    try {
        setGoogleLoading(true);

        const authUrl = `${API_BASE_URL}/api/auth/social/google?redirect_uri=${encodeURIComponent(APP_REDIRECT)}&source=mobile-app`;

        console.log("AUTH URL →", authUrl);

        const result = await WebBrowser.openAuthSessionAsync(authUrl, APP_REDIRECT);

        if (result.type !== "success" || !result.url) {
            Alert.alert("Error", "Google login was not completed");
            return false;
        }

        const query = result.url.split("?")[1] || "";
        const params = new URLSearchParams(query);

        const accessToken = params.get("accessToken");
        const refreshToken = params.get("refreshToken");
        const userParam = params.get("user");

        if (!accessToken || !refreshToken || !userParam) {
            Alert.alert("Error", "Missing login response");
            return false;
        }

        // ---------------------------
        // Clear old tokens first (fix mismatch)
        // ---------------------------
        await SecureStore.deleteItemAsync("accessToken");
        await SecureStore.deleteItemAsync("refreshToken");
        await AsyncStorage.removeItem("userData");

        // ---------------------------
        // Save new tokens
        // ---------------------------
        await SecureStore.setItemAsync("accessToken", accessToken);
        await SecureStore.setItemAsync("refreshToken", refreshToken);

        setAccessToken(accessToken);

        // Decode and store user
        try {
            const decoded = decodeURIComponent(userParam);

            await AsyncStorage.setItem("userData", decoded);
        } catch (err) {
            console.log("User decode failed:", err);
        }

        Alert.alert("Success", "Logged in with Google");

        // ---------------------------
        // Merge cart if needed
        // ---------------------------
        try {
            await mergeGuestCart();
        } catch (_) {
            console.log("No merge cart needed");
        }

        router.replace("/screens/LoginTypeSelectionScreen");
        return true;
    } catch (error) {
        console.log("Google login error:", error);
        Alert.alert("Login Failed", error?.message || "Unknown error");
        return false;
    } finally {
        setGoogleLoading(false);
    }
}


export async function facebookLogin(router, setFacebookLoading) {
    try {
        setFacebookLoading(true);

        // Construct the Facebook auth URL
        const authUrl = `${API_BASE_URL}/api/auth/social/facebook?redirect_uri=${encodeURIComponent(APP_REDIRECT)}&source=mobile-app`;

        console.log("Facebook AUTH URL →", authUrl);

        // Open Facebook auth session
        const result = await WebBrowser.openAuthSessionAsync(authUrl, APP_REDIRECT);

        // Check if auth was successful
        if (result.type !== "success" || !result.url) {
            Alert.alert("Error", "Facebook login was not completed");
            return false;
        }

        console.log("Facebook callback URL →", result.url);

        // Parse the callback URL
        const query = result.url.split("?")[1] || "";
        const params = new URLSearchParams(query);

        // Check for different possible response formats
        const accessToken = params.get("accessToken");
        const refreshToken = params.get("refreshToken");
        const userParam = params.get("user");

        // Also check for error parameters
        const error = params.get("error");
        const errorMessage = params.get("message");

        // Handle errors from Facebook
        if (error || errorMessage) {
            const errorMsg = errorMessage || error || "Facebook login failed";
            Alert.alert("Error", decodeURIComponent(errorMsg));
            return false;
        }

        // Check if we need email update
        const requiresEmailUpdate = params.get("requiresEmailUpdate") === "true";
        const hasRealEmail = params.get("hasRealEmail") === "true";

        if (requiresEmailUpdate || !hasRealEmail) {
            // Facebook didn't provide email, redirect to email input screen
            Alert.alert("Complete Registration", "Please provide your email to continue", [{
                text: "OK", onPress: () => {
                    // Navigate to email update screen with access token
                    router.push({
                        pathname: "/screens/UpdateEmailScreen", params: {
                            accessToken: accessToken, socialProvider: "facebook", requiresEmailUpdate: true
                        }
                    });
                }
            }]);
            return true; // Return true because auth was successful, just needs email
        }

        if (!accessToken) {
            Alert.alert("Error", "Missing access token in response");
            return false;
        }

        // ---------------------------
        // Clear old tokens first
        // ---------------------------
        await SecureStore.deleteItemAsync("accessToken");
        await SecureStore.deleteItemAsync("refreshToken");
        await AsyncStorage.removeItem("userData");

        // ---------------------------
        // Save new tokens
        // ---------------------------
        await SecureStore.setItemAsync("accessToken", accessToken);

        // Save refresh token if provided (might be in cookie for Facebook)
        if (refreshToken) {
            await SecureStore.setItemAsync("refreshToken", refreshToken);
        }

        setAccessToken(accessToken);

        // Decode and store user if provided
        if (userParam) {
            try {
                const decoded = decodeURIComponent(userParam);
                await AsyncStorage.setItem("userData", decoded);
            } catch (err) {
                console.log("User decode failed:", err);
            }
        } else {
            // If user data not in URL, fetch it using the access token
            try {
                const userResponse = await axios.get(`${API_BASE_URL}/api/auth/me`, {
                    headers: {Authorization: `Bearer ${accessToken}`}
                });
                if (userResponse.data.success) {
                    await AsyncStorage.setItem("userData", JSON.stringify(userResponse.data.user));
                }
            } catch (fetchErr) {
                console.log("Failed to fetch user data:", fetchErr);
            }
        }

        Alert.alert("Success", "Logged in with Facebook");

        // ---------------------------
        // Merge cart if needed
        // ---------------------------
        try {
            await mergeGuestCart();
        } catch (_) {
            console.log("No merge cart needed");
        }

        // Navigate to main screen
        router.replace("/screens/LoginTypeSelectionScreen");
        return true;

    } catch (error) {
        console.log("Facebook login error:", error);
        Alert.alert("Login Failed", error?.message || "Unknown error");
        return false;
    } finally {
        setFacebookLoading(false);
    }
}
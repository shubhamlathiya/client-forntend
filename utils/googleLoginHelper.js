import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { API_BASE_URL } from "../config/apiConfig";
import { mergeGuestCart } from "../api/cartApi";
import {setAccessToken} from "./apiClient";
import * as SecureStore from "expo-secure-store"; // if you have it

WebBrowser.maybeCompleteAuthSession();

// const APP_REDIRECT = "exp://192.168.1.15:8081/--/auth/callback";
// const APP_REDIRECT = "exp://10.244.170.75:8081/--/auth/callback";
const APP_REDIRECT = "clientforntend://auth/callback";

// ---------------------------
// Google Login
// ---------------------------
export async function googleLogin(router, setGoogleLoading) {
    try {
        setGoogleLoading(true);

        const authUrl = `${API_BASE_URL}/api/auth/social/google?redirect_uri=${encodeURIComponent(
            APP_REDIRECT
        )}&source=mobile-app`;

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

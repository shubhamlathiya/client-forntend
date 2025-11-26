import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { API_BASE_URL } from "../config/apiConfig";
import { mergeGuestCart } from "../api/cartApi";
import {setAccessToken} from "./apiClient"; // if you have it

WebBrowser.maybeCompleteAuthSession();

// const APP_REDIRECT = "exp://192.168.1.15:8081/--/auth/callback";
// const APP_REDIRECT = "exp://10.244.170.75:8081/--/auth/callback";
const APP_REDIRECT = "clientforntend://auth/callback";

export async function googleLogin(router, setGoogleLoading) {
    try {
        setGoogleLoading(true);

        const authUrl = `${API_BASE_URL}/api/auth/social/google?redirect_uri=${encodeURIComponent(
            APP_REDIRECT
        )}&source=mobile-app`;

        console.log("AUTH URL →", authUrl);

        const result = await WebBrowser.openAuthSessionAsync(authUrl, APP_REDIRECT);
        console.log("Google Auth Result →", result);

        if (result.type !== "success" || !result.url) {
            Alert.alert(
                result.type === "cancel" ? "Cancelled" : "Error",
                result.type === "cancel"
                    ? "Google login was cancelled"
                    : "Google login did not complete"
            );
            return false;
        }

        // Parse query parameters
        const query = result.url.split("?")[1] || "";
        const params = new URLSearchParams(query);

        const accessToken = params.get("accessToken");
        const refreshToken = params.get("refreshToken");
        const userParam = params.get("user");

        if (!accessToken || !refreshToken || !userParam) {
            Alert.alert("Error", "Missing login credentials from Google");
            return false;
        }

        // Store tokens
        await AsyncStorage.setItem("accessToken", accessToken);
        await AsyncStorage.setItem("refreshToken", refreshToken);
        setAccessToken(accessToken); // in-memory token for immediate use

        // Decode and store user data
        try {
            const decoded = decodeURIComponent(userParam);
            const userObject = JSON.parse(decoded);
            await AsyncStorage.setItem("userData", JSON.stringify(userObject));
            console.log("User stored:", userObject);
        } catch (err) {
            console.error("Failed to decode user param:", err);
        }

        Alert.alert("Success", "Logged in with Google");

        // Optional: merge guest cart if any
        try {
            await mergeGuestCart();
        } catch (_) {
            console.log("Merge Cart Skipped: no access token");
        }

        // Redirect to next screen
        router.replace("/screens/LoginTypeSelectionScreen");
        return true;
    } catch (error) {
        console.error("Google login error:", error);
        Alert.alert("Error", error?.message || "Failed to login with Google");
        return false;
    } finally {
        setGoogleLoading(false);
    }
}

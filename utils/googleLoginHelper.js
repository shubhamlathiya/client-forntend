import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { API_BASE_URL } from "../config/apiConfig";
import { mergeGuestCart } from "../api/cartApi"; // if you have it

WebBrowser.maybeCompleteAuthSession();

// const APP_REDIRECT = "exp://192.168.1.15:8081/--/auth/callback";
const APP_REDIRECT = "clientforntend://auth/callback";

export async function googleLogin(router, setGoogleLoading) {
    try {
        setGoogleLoading(true);

        const authUrl = `${API_BASE_URL}/api/auth/social/google?redirect_uri=${encodeURIComponent(
            APP_REDIRECT
        )}&source=mobile-app`;

        console.log("AUTH URL →", authUrl);
        console.log("APP REDIRECT →", APP_REDIRECT);

        const result = await WebBrowser.openAuthSessionAsync(authUrl, APP_REDIRECT);

        console.log("Google Auth Result →", result);

        if (result.type !== "success" || !result.url) {
            if (result.type === "cancel") {
                Alert.alert("Cancelled", "Google login was cancelled");
            } else {
                Alert.alert("Error", "Google login did not complete");
            }
            return false;
        }

        // Extract values
        const query = result.url.split("?")[1] || "";
        const params = new URLSearchParams(query);

        const accessToken = params.get("accessToken");
        const refreshToken = params.get("refreshToken");
        const userParam = params.get("user");

        if (accessToken) {
            await AsyncStorage.setItem("accessToken", accessToken);
        }

        if (refreshToken) {
            await AsyncStorage.setItem("refreshToken", refreshToken);
        }

        if (userParam) {
            try {
                const decoded = decodeURIComponent(userParam);
                const userObject = JSON.parse(decoded);
                await AsyncStorage.setItem("userData", JSON.stringify(userObject));
            } catch (err) {
                console.log("User decode error:", err);
            }
        }

        Alert.alert("Success", "Logged in with Google");

        // Optional cart merge
        try {
            await mergeGuestCart();
        } catch (_) {}

        router.replace("/screens/LoginTypeSelectionScreen");

        return true;

    } catch (error) {
        const message = error?.message || "Failed to login with Google";
        Alert.alert("Error", message);
        return false;

    } finally {
        setGoogleLoading(false);
    }
}

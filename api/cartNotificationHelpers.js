import AsyncStorage from "@react-native-async-storage/async-storage";
import {getCurrentSessionId, getOrCreateSessionId, getUserType, setCurrentSessionId} from "./sessionManager";
import {getCart} from "./cartApi";

let lastLoadNotificationTime = 0;
const NOTIFICATION_LOAD_THROTTLE = 3000;

// export const printAllAsyncStorage = async () => {
//     try {
//         const keys = await AsyncStorage.getAllKeys();
//         const stores = await AsyncStorage.multiGet(keys);
//
//         // console.log("\n================ ASYNC STORAGE DUMP ================");
//         stores
//             .sort(([a], [b]) => a.localeCompare(b))
//             .forEach(([key, value]) => {
//                 console.log(`${key}:`, value);
//             });
//         // console.log("====================================================\n");
//
//     } catch (error) {
//         console.error("Error printing AsyncStorage:", error);
//     }
// };

// NEW: Load specific cart by cartId (for notifications)
export const loadNotificationCartById = async (cartId, sessionId, negotiationId = null) => {
    try {
        // console.log("=== LOADING NOTIFICATION CART BY ID ===");
        // console.log("Cart ID:", cartId);
        // console.log("Session ID:", sessionId);
        // console.log("Negotiation ID:", negotiationId);

        if (!cartId || !sessionId) {
            throw new Error("Cart ID and Session ID are required");
        }

        // First, get the current session to save as original
        const originalSessionId = await getCurrentSessionId();

        // Store all notification context
        await AsyncStorage.multiSet([
            ["original_session_id", originalSessionId || ""],
            ["original_login_type", await getUserType() || ""],
            ["notification_session_id", sessionId],
            ["notification_cart_id", String(cartId)],
            ["is_notification_cart", "true"]
        ]);

        if (negotiationId) {
            await AsyncStorage.setItem("current_negotiation_id", String(negotiationId));
        }

        // Switch to notification session
        await setCurrentSessionId(sessionId);

        // Now load the cart using the notification session
        const response = await getCart(true);
        const cartData = response?.data || response;

        // console.log("Notification cart loaded:", {
        //     success: true,
        //     itemCount: Array.isArray(cartData?.items) ? cartData.items.length : 0,
        //     cartId: cartData?._id || cartData?.id
        // });

        return {
            success: true,
            cart: cartData,
            originalSessionId,
            notificationSessionId: sessionId
        };

    } catch (error) {
        console.error("Error loading notification cart by ID:", error);
        throw error;
    }
};

export const loadCartFromNotification = async (cartId, notificationSessionId, negotiationId = null) => {
    try {
        const now = Date.now();
        if (now - lastLoadNotificationTime < NOTIFICATION_LOAD_THROTTLE) {
            console.log("⏭️ Skipping duplicate notification load");
            return {
                success: true,
                cart: null,
                skip: true
            };
        }

        lastLoadNotificationTime = now;
        //
        // console.log("=== STARTING NOTIFICATION CART LOAD ===");
        // await printAllAsyncStorage();

        // Load the specific cart using cartId and sessionId
        const result = await loadNotificationCartById(cartId, notificationSessionId, negotiationId);

        // console.log("=== AFTER loading notification cart ===");
        // await printAllAsyncStorage();

        return result;

    } catch (error) {
        console.error("Error in loadCartFromNotification:", error);

        // Try to restore original session
        await restoreOriginalSession();

        // console.log("=== AFTER restoreOriginalSession (error) ===");
        // await printAllAsyncStorage();

        return {
            success: false,
            error: error.message,
            cart: null
        };
    }
};

export const restoreOriginalSession = async () => {
    try {
        console.log("=== RESTORING ORIGINAL SESSION ===");

        const originalSessionId = await AsyncStorage.getItem("original_session_id");
        const originalLoginType = await AsyncStorage.getItem("original_login_type");

        console.log("Original session ID:", originalSessionId);
        console.log("Original login type:", originalLoginType);

        if (originalSessionId && originalSessionId !== "") {
            // Restore original session
            await AsyncStorage.setItem("sessionId", originalSessionId);

            // Also restore to type-specific key if we have login type
            if (originalLoginType && originalLoginType !== "") {
                const sessionKey = `sessionId_${originalLoginType}`;
                await AsyncStorage.setItem(sessionKey, originalSessionId);

                // Update login type if changed
                await AsyncStorage.setItem("loginType", originalLoginType);
            }
        } else {
            console.log("⚠️ No valid original_session_id found. Creating new session.");
            // Create new session if no original found
            await getOrCreateSessionId(null, true);
        }

        // Clear notification context
        await AsyncStorage.multiRemove([
            "original_session_id",
            "original_login_type",
            "notification_session_id",
            "notification_cart_id",
            "is_notification_cart",
            "current_negotiation_id"
        ]);

        // console.log("=== AFTER session restore ===");
        // await printAllAsyncStorage();

    } catch (error) {
        console.error("Error restoring session:", error);
    }
};

export const isNotificationCart = async () => {
    try {
        const flag = await AsyncStorage.getItem("is_notification_cart");
        return flag === "true";
    } catch {
        return false;
    }
};


export const getNotificationContext = async () => {
    try {
        const cartId = await AsyncStorage.getItem("notification_cart_id");
        const sessionId = await AsyncStorage.getItem("notification_session_id");
        const negotiationId = await AsyncStorage.getItem("current_negotiation_id");
        const isNotificationCart = await AsyncStorage.getItem("is_notification_cart") === "true";

        return {
            cartId,
            sessionId,
            negotiationId,
            isNotificationCart
        };
    } catch {
        return { isNotificationCart: false };
    }
};

export const clearNotificationContext = async () => {
    try {
        await AsyncStorage.multiRemove([
            "original_session_id",
            "original_login_type",
            "notification_session_id",
            "notification_cart_id",
            "is_notification_cart",
            "current_negotiation_id"
        ]);
    } catch (error) {
        console.error("Error clearing notification context:", error);
    }
};

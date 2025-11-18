import {Stack} from 'expo-router';
import 'react-native-reanimated';
import { LoginTypeProvider } from '../contexts/LoginTypeContext';
import ReturnReplacementScreen from "./screens/ReturnReplacementScreen";


export default function RootLayout() {
    return (

        <LoginTypeProvider>
        <Stack>
            <Stack.Screen name="index" options={{headerShown: false}}/>

            <Stack.Screen name="(tabs)" options={{headerShown: false}}/>
            <Stack.Screen name="screens/SplashScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/AuthScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/HomeScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/LoginScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/SignUpScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/ForgotPasswordScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/VerifyOtpScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/CategoriesScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/SearchScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/ProductDetailScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/CartScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/CheckoutScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/MyOrderScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/NotificationScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/ResetPasswordScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/LoginTypeSelectionScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/AddAddressScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/AddressListScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/SummaryScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/OrderConfirmationScreen" options={{headerShown: false}}/>
            <Stack.Screen name="screens/ReturnReplacementScreen" options={{headerShown: false}}/>

        </Stack>
        </LoginTypeProvider>

    );
}

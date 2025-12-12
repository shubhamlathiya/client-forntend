import {Dimensions, Platform, StatusBar} from "react-native";

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

// Check if device has notch (iPhone X and above)
const hasNotch = Platform.OS === 'ios' && (screenHeight >= 812 || screenWidth >= 812);

// Safe area insets for different devices
const getSafeAreaInsets = () => {
    if (Platform.OS === 'ios') {
        if (hasNotch) {
            return {
                top: 44, // Status bar + notch area
                bottom: 34 // Home indicator area
            };
        }
        return {
            top: 20, // Regular status bar
            bottom: 0
        };
    }
    // Android
    return {
        top: StatusBar.currentHeight || 25,
        bottom: 0
    };
};

const safeAreaInsets = getSafeAreaInsets();

// Responsive size calculator with constraints
const RF = (size) => {
    const scale = screenWidth / 375; // 375 is standard iPhone width
    const normalizedSize = size * Math.min(scale, 1.5); // Max 1.5x scaling for tablets
    return Math.round(normalizedSize);
};

const RH = (size) => {
    const scale = screenHeight / 812; // 812 is standard iPhone height
    return Math.round(size * Math.min(scale, 1.5));
};

// Check if device is tablet
const isTablet = screenWidth >= 768;
const isLargeTablet = screenWidth >= 1024;
const isSmallPhone = screenWidth <= 320;

// Responsive width percentage
const responsiveWidth = (percentage) => {
    return Math.round((screenWidth * percentage) / 100);
};

// Responsive height percentage (excluding safe areas)
const responsiveHeight = (percentage) => {
    const availableHeight = screenHeight - safeAreaInsets.top - safeAreaInsets.bottom;
    return Math.round((availableHeight * percentage) / 100);
};

export {
    RF,
    RH,
    safeAreaInsets,
    responsiveWidth,
    responsiveHeight,
    isTablet,
    isLargeTablet,
    isSmallPhone
};

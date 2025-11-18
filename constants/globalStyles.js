import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { fonts } from './fonts';

export const globalStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 40,
        paddingHorizontal: 20,
    },
    button: {
        backgroundColor: "#4CAD73",
        borderRadius: 12,
        alignItems: "center",
        paddingVertical: 14,
        marginTop: 20,
    },
    buttonText: {
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
    socialBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#EDEDED",
        borderRadius: 12,
        paddingVertical: 12,
        marginBottom: 16,
    },
    socialIcon: {
        width: 24,
        height: 24,
        marginRight: 8,
    },
    socialText: {
        fontSize: 16,
        fontWeight: "500",
        color: "#1E1E1E",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginTop:10,
        marginBottom: 20,
    },
    backIcon: {
        padding: 8,
        width: 32,
        height: 32,
        borderRadius: 6,
        marginRight: 16,
    },
    title: {
        fontSize: 24,
        alignItems: "center",
        fontWeight: "bold",
        color: "#000000",
    },
});

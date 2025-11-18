import React, { useState } from "react";
import {View, TextInput, StyleSheet, Image, TouchableOpacity} from "react-native";

export default function SearchBar({ onSearch }) {
    const [query, setQuery] = useState('');

    const handleSearch = (text) => {
        setQuery(text);
        if (onSearch) {
            onSearch(text);
        }
    };

    const clearSearch = () => {
        setQuery('');
        if (onSearch) {
            onSearch('');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.innerContainer}>
                <Image
                    source={require("../../assets/icons/search.png")}
                    style={styles.icon}
                    resizeMode="contain"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Search products..."
                    value={query}
                    onChangeText={handleSearch}
                    placeholderTextColor="#838383"
                    clearButtonMode="while-editing"
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                        <Image
                            source={require("../../assets/icons/deleteIcon.png")}
                            style={styles.clearIcon}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        top: 10,
        marginLeft: 20,
        width: "100%",
        height: 50,
        backgroundColor: "#F5F5F5",
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        justifyContent: "center",
    },
    innerContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    icon: {
        width: 20,
        height: 20,
        tintColor: "#838383",
    },
    input: {
        fontFamily: "Poppins",
        fontSize: 12,
        lineHeight: 18,
        color: "#838383",
        flex: 1,
    },
    clearButton: {
        padding: 4,
    },
    clearIcon: {
        width: 16,
        height: 16,
        tintColor: "#838383",
    },
});
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TextInput,
    TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function SearchScreen() {
    const router = useRouter();
    const { searchQuery } = useLocalSearchParams();

    const [query, setQuery] = useState(searchQuery || '');

    const snacks = [
        { id: 1, name: 'Snack Eggs', price: '$7.8/1 pcs' },
        { id: 2, name: 'Snack Red Apple', price: '$7.8/1 pcs' },
        { id: 3, name: 'Snack YiPeee', price: '$7.8/1 pcs' },
        { id: 4, name: 'Snack Pingo', price: '$7.8/1 pcs' },
    ];

    // Filter results dynamically
    const filtered = snacks.filter((s) =>
        s.name.toLowerCase().includes(query.toLowerCase())
    );

    return (
        <View style={styles.container}>
            {/* Top Bar with Back and Search */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Image
                        source={require('../../assets/icons/back_icon.png')}
                        style={styles.backIcon}
                    />
                </TouchableOpacity>

                <View style={styles.searchBox}>
                    <Image
                        source={require('../../assets/icons/search.png')}
                        style={styles.searchIcon}
                        resizeMode="contain"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Search here"
                        placeholderTextColor="#838383"
                        value={query}
                        onChangeText={setQuery}
                    />
                </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>
                {query ? `Results for "${query}"` : 'Search Results'}
            </Text>

            {/* Card List */}
            <ScrollView
                contentContainerStyle={styles.cardsContainer}
                showsVerticalScrollIndicator={false}
            >
                {filtered.length > 0 ? (
                    filtered.map((item) => (
                        <View key={item.id} style={styles.card}>
                            <View style={styles.imageCircle} />
                            <View style={styles.textContainer}>
                                <Text style={styles.snackName}>{item.name}</Text>
                                <Text style={styles.snackPrice}>{item.price}</Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noResultText}>No snacks found</Text>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingTop: 40,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    backIcon: {
        width: 32,
        height: 32,
        tintColor: '#000',
        marginRight: 12,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
    },
    searchIcon: {
        width: 20,
        height: 20,
        tintColor: '#838383',
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontFamily: 'Poppins',
        fontSize: 12,
        color: '#000',
    },
    title: {
        fontFamily: 'Poppins',
        fontSize: 18,
        fontWeight: '600',
        color: '#000',
        marginBottom: 16,
    },
    cardsContainer: {
        paddingBottom: 60,
        gap: 16,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F5F5F5',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 2,
    },
    imageCircle: {
        width: 48,
        height: 48,
        backgroundColor: '#C4C4C4',
        borderRadius: 24,
        marginRight: 12,
    },
    textContainer: {
        flexDirection: 'column',
        justifyContent: 'center',
    },
    snackName: {
        fontFamily: 'Poppins',
        fontSize: 14,
        fontWeight: '500',
        color: '#000000',
    },
    snackPrice: {
        fontFamily: 'Poppins',
        fontSize: 14,
        fontWeight: '500',
        color: '#4CAD73',
    },
    noResultText: {
        textAlign: 'center',
        color: '#838383',
        fontSize: 14,
        marginTop: 40,
    },
});

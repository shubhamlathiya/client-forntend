import React from 'react';
import { View, TouchableOpacity, Image, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function AppHeader({ title = '' }) {
  const navigation = useNavigation();
  const canGoBack = navigation?.canGoBack?.() || false;

  return (
    <View style={styles.container}>
      {canGoBack ? (
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={require('../../assets/icons/back_icon.png')} style={styles.backIcon} />
        </TouchableOpacity>
      ) : (
        <View style={styles.backButtonPlaceholder} />
      )}
      {!!title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
      <View style={styles.rightPlaceholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginTop:20,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: 32,
    height: 32,
  },
  backButtonPlaceholder: {
    width: 32,
    height: 32,
  },
  title: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#1B1B1B',
  },
  rightPlaceholder: {
    width: 32,
    height: 32,
  },
});

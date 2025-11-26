import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

export default function OrderActionMenu({ visible, onClose, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Order Actions</Text>
          <View style={styles.options}>
            <TouchableOpacity style={styles.option} onPress={() => onSelect('return')}>
              <Text style={styles.optionText}>Return Order</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.option} onPress={() => onSelect('replacement')}>
              <Text style={styles.optionText}>Replacement Request</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.option} onPress={() => onSelect('details')}>
              <Text style={styles.optionText}>View Details</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    elevation: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#DADADA',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 16, fontWeight: '600', color: '#1B1B1B', marginBottom: 8 },
  options: { },
  option: { paddingVertical: 12 },
  optionText: { fontSize: 15, color: '#1B1B1B' },
  cancelButton: { marginTop: 8, alignSelf: 'flex-end' },
  cancelText: { color: '#4CAD73', fontSize: 14, fontWeight: '500' },
});


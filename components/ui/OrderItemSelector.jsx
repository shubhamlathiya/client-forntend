import React, { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Image, ScrollView } from 'react-native';

export default function OrderItemSelector({ visible, items = [], initialSelected = [], onClose, onConfirm }) {
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    const init = new Set((initialSelected || []).map((i) => i.productId));
    setSelected(init);
  }, [visible]);

  const toggleItem = (productId) => {
    const next = new Set(selected);
    if (next.has(productId)) next.delete(productId); else next.add(productId);
    setSelected(next);
  };

  const confirm = () => {
    const selectedItems = items.filter((i) => selected.has(i.productId)).map((i) => ({
      productId: i.productId,
      quantity: i.quantity || 1,
      productName: i.productName,
      image: i.image,
      price: i.price,
    }));
    onConfirm(selectedItems);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Select Items</Text>
          <ScrollView style={styles.list}>
            {items.map((item, idx) => {
              const checked = selected.has(item.productId);
              return (
                <Pressable key={item.productId || idx} style={styles.row} onPress={() => toggleItem(item.productId)}>
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]} />
                  <Image source={{ uri: item.image }} style={styles.image} />
                  <View style={styles.info}>
                    <Text style={styles.name}>{item.productName}</Text>
                    <Text style={styles.meta}>Qty: {item.quantity} • ₹{Number(item.price || 0).toFixed(2)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={confirm}>
              <Text style={styles.primaryText}>Next</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  modal: { width: '92%', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16 },
  title: { fontSize: 16, fontWeight: '600', color: '#1B1B1B', marginBottom: 8 },
  list: { maxHeight: 320 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: '#DADADA', marginRight: 12 },
  checkboxChecked: { backgroundColor: '#4CAD73', borderColor: '#4CAD73' },
  image: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F6F6F6', marginRight: 12 },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '500', color: '#000' },
  meta: { fontSize: 12, color: '#868889', marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
  secondaryButton: { paddingVertical: 10, paddingHorizontal: 16 },
  secondaryText: { color: '#1B1B1B', fontSize: 14 },
  primaryButton: { backgroundColor: '#4CAD73', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});


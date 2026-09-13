import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, Modal, SafeAreaView, ActivityIndicator, Alert
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StockItem } from '../../types/stock.types';
import { Colors } from '../../theme';
import { formatCurrency } from '../../utils/calculations';

interface CartItem extends StockItem {
  cartQty: number;
}

interface SelectItemsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (cart: CartItem[]) => void;
  initialCart: CartItem[];
  stockItems: StockItem[];
}

export const SelectItemsModal: React.FC<SelectItemsModalProps> = ({
  visible, onClose, onSave, initialCart, stockItems
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (visible) {
      setCart([...initialCart]);
      const cats = Array.from(new Set(stockItems.map(i => i.category).filter(Boolean)));
      setCategories(['All', ...cats]);
    }
  }, [visible, initialCart, stockItems]);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setShowScanner(false);
    const item = stockItems.find(i => i.barcode === data);
    if (item) {
      updateCartQty(item, 1);
    } else {
      Alert.alert('No product matches this barcode.');
    }
  };

  const updateCartQty = (item: StockItem, delta: number) => {
    setCart(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        const newQty = Math.max(0, exists.cartQty + delta);
        if (newQty === 0) return prev.filter(i => i.id !== item.id);
        return prev.map(i => i.id === item.id ? { ...i, cartQty: newQty } : i);
      }
      if (delta > 0) {
        return [...prev, { ...item, cartQty: delta }];
      }
      return prev;
    });
  };

  const filteredItems = stockItems.filter(i => {
    const matchesCat = selectedCategory === 'All' || i.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || i.name_en.toLowerCase().includes(q) || (i.barcode && i.barcode.includes(q));
    return matchesCat && matchesSearch;
  });

  const totalAmount = cart.reduce((sum, item) => sum + (item.sale_price * item.cartQty), 0);

  if (showScanner) {
    if (!permission?.granted) {
      return (
        <Modal visible={visible} animationType="slide">
          <SafeAreaView style={styles.safe}>
            <View style={styles.scannerFallback}>
              <Text style={{ color: Colors.textWhite, fontSize: 16 }}>No access to camera</Text>
              <TouchableOpacity style={styles.btnGreen} onPress={requestPermission}><Text style={styles.btnText}>Request Permission</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnGray} onPress={() => setShowScanner(false)}><Text style={styles.btnTextBlack}>Go Back</Text></TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      );
    }
    return (
      <Modal visible={visible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: Colors.bgPrimary }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.scannerOverlay}>
            <TouchableOpacity style={styles.btnGray} onPress={() => setShowScanner(false)}>
              <Text style={styles.btnTextBlack}>Cancel Scan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: Colors.textWhite }}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Items</Text>
          <TouchableOpacity onPress={() => setCart([])} style={{ padding: 8 }}>
            <Text style={{ color: Colors.error, fontWeight: 'bold' }}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search products or scan..."
            placeholderTextColor={Colors.textGray}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.scanBtn} onPress={() => setShowScanner(true)}>
            <Text style={{ fontSize: 22 }}>📷</Text>
          </TouchableOpacity>
        </View>

        <View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories}
            keyExtractor={c => c}
            contentContainerStyle={styles.catScroll}
            renderItem={({ item: c }) => (
              <TouchableOpacity 
                style={[styles.catChip, selectedCategory === c && styles.catChipActive]}
                onPress={() => setSelectedCategory(c)}
              >
                <Text style={[styles.catText, selectedCategory === c && styles.catTextActive]}>{c}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        <FlatList
          data={filteredItems}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          renderItem={({ item }) => {
            const cartItem = cart.find(i => i.id === item.id);
            const qty = cartItem ? cartItem.cartQty : 0;
            return (
              <View style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name_en}</Text>
                  <Text style={styles.itemPrice}>{formatCurrency(item.sale_price)}</Text>
                  <Text style={styles.itemStock}>Stock: {item.quantity}</Text>
                </View>
                
                {qty === 0 ? (
                  <TouchableOpacity style={styles.addBtn} onPress={() => updateCartQty(item, 1)}>
                    <Text style={styles.addBtnText}>ADD</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.qtyControls}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCartQty(item, -1)}>
                      <Text style={styles.qtyBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{qty}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCartQty(item, 1)}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />

        <View style={styles.bottomBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bottomTotalItems}>{cart.reduce((s, i) => s + i.cartQty, 0)} Items Selected</Text>
            <Text style={styles.bottomTotalAmount}>{formatCurrency(totalAmount)}</Text>
          </View>
          <TouchableOpacity style={styles.doneBtn} onPress={() => onSave(cart)}>
            <Text style={styles.doneBtnText}>DONE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, height: 56, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bgCard
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },
  
  searchRow: { flexDirection: 'row', padding: 12, gap: 10, alignItems: 'center', backgroundColor: Colors.bgPrimary },
  searchInput: {
    flex: 1, backgroundColor: Colors.bgInput, height: 48, borderRadius: 10,
    paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border, fontSize: 15, color: Colors.textWhite
  },
  scanBtn: {
    width: 48, height: 48, backgroundColor: Colors.bgInput, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center'
  },
  
  catScroll: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, backgroundColor: Colors.bgPrimary },
  catChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catText: { fontWeight: '600', color: Colors.textGray, fontSize: 13 },
  catTextActive: { color: Colors.textWhite, fontWeight: '700' },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, padding: 14, marginBottom: 8, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border
  },
  itemName: { fontSize: 15, fontWeight: '600', color: Colors.textWhite },
  itemPrice: { fontSize: 15, fontWeight: '700', color: Colors.primaryLight, marginTop: 4 },
  itemStock: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  
  addBtn: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.bgInput
  },
  addBtnText: { color: Colors.primaryLight, fontWeight: '700' },
  
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgInput, borderRadius: 8, paddingHorizontal: 4, borderWidth: 1, borderColor: Colors.border },
  qtyBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 18, fontWeight: 'bold', color: Colors.textWhite },
  qtyText: { width: 36, textAlign: 'center', fontWeight: 'bold', fontSize: 15, color: Colors.textWhite },

  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.bgCard, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border,
    paddingBottom: 28,
  },
  bottomTotalItems: { fontSize: 13, color: Colors.textGray },
  bottomTotalAmount: { fontSize: 18, fontWeight: '800', color: Colors.textWhite, marginTop: 2 },
  doneBtn: { backgroundColor: Colors.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  doneBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  scannerOverlay: { position: 'absolute', bottom: 40, left: 20, right: 20 },
  scannerFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  btnGray: { backgroundColor: Colors.bgInput, height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  btnGreen: { backgroundColor: Colors.primary, height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  btnTextBlack: { color: Colors.textWhite, fontSize: 16, fontWeight: 'bold' },
});

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useActivityStore } from '../../store/useActivityStore';
import { useStockStore } from '../../store/useStockStore';
import { TranslateToUrdu } from '../../components/TranslateToUrdu';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Colors } from '../../theme';
import { rupeesToPaisa } from '../../utils/calculations';

const PREDEFINED_CATEGORIES = ['Electronics', 'Clothing', 'Groceries', 'Books', 'Hardware', 'Other'];
const PREDEFINED_UNITS = ['kg', 'liter', 'piece', 'dozen', 'meter', 'box', 'carton', 'pack'];

export const AddItemModal = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const { addItem } = useStockStore();
  const { logActivity } = useActivityStore();

  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [nameEn, setNameEn] = useState('');
  const [nameUr, setNameUr] = useState('');
  
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [barcode, setBarcode] = useState('');
  const [lowStockLimit, setLowStockLimit] = useState('5');

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!nameEn.trim()) e.nameEn = 'Item name required';
    else if (nameEn.length > 100) e.nameEn = 'Max 100 characters';

    if (!category.trim()) e.category = 'Category required';
    if (!unit.trim()) e.unit = 'Unit required';
    else if (unit.length > 20) e.unit = 'Max 20 characters';

    if (salePrice.trim()) {
      const sp = parseFloat(salePrice);
      if (isNaN(sp) || sp < 0) e.salePrice = 'Invalid sale price';
    }

    if (purchasePrice.trim()) {
      const pp = parseFloat(purchasePrice);
      if (isNaN(pp) || pp < 0) e.purchasePrice = 'Invalid purchase price';
    }

    if (salePrice.trim() && purchasePrice.trim()) {
      const sp = parseFloat(salePrice);
      const pp = parseFloat(purchasePrice);
      if (!isNaN(sp) && !isNaN(pp) && sp < pp) {
        e.salePrice = 'Sale price must be ≥ purchase price';
      }
    }

    if (barcode && barcode.length > 50) e.barcode = 'Max 50 characters';

    const lsl = parseInt(lowStockLimit, 10);
    if (!lowStockLimit.trim() || isNaN(lsl) || lsl < 0) e.lowStockLimit = 'Invalid low stock limit';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].uri) {
      setPictureUrl(result.assets[0].uri);
    }
  };

  const handleScanBarcode = () => {
    if (!permission?.granted) {
      requestPermission();
    }
    setShowScanner(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setBarcode(data);
    setShowScanner(false);
  };

  const handleSubmit = async () => {
    if (!validate() || !user) {
      return;
    }

    setLoading(true);
    try {
      await addItem({
        user_id: user.id,
        name_en: nameEn.trim(),
        name_ur: nameUr.trim() || undefined,
        category: category.trim(),
        unit: unit.trim(),
        sale_price: salePrice.trim() ? (rupeesToPaisa(salePrice) ?? 0) : 0,
        purchase_price: purchasePrice.trim() ? (rupeesToPaisa(purchasePrice) ?? 0) : 0,
        barcode: barcode.trim() || undefined,
        picture_url: pictureUrl || undefined,
        location: 'Not Set',
        low_stock_threshold: parseInt(lowStockLimit, 10),
      });

      // Log Activity
      await logActivity({
        user_id: user.id,
        user_name: user.name || 'User',
        action: 'create',
        entity_type: 'stock',
        description: `added new stock item ${nameEn.trim()}`,
      });
      
      Alert.alert('Success', 'Item added successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      if (__DEV__) console.error(err);
      Alert.alert('Error', 'Failed to save item.');
    } finally {
      setLoading(false);
    }
  };

  if (showScanner) {
    if (!permission?.granted) {
      return (
        <SafeAreaView style={styles.safe}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={{ fontSize: 16, marginBottom: 20, color: Colors.textWhite }}>No access to camera</Text>
            <TouchableOpacity style={[styles.submitBtn, { width: '100%', marginBottom: 16 }]} onPress={requestPermission}>
              <Text style={styles.submitText}>Request Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, { width: '100%', backgroundColor: Colors.textGray }]} onPress={() => setShowScanner(false)}>
              <Text style={styles.submitText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bgPrimary }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          onBarcodeScanned={handleBarcodeScanned}
        />
        <View style={{ position: 'absolute', bottom: 40, left: 20, right: 20 }}>
          <TouchableOpacity style={[styles.submitBtn, { backgroundColor: Colors.error }]} onPress={() => setShowScanner(false)}>
            <Text style={styles.submitText}>Cancel Scan</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Item</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScreenContainer scrollable={true} hasTabBar={true} contentContainerStyle={styles.form}>
        {/* Picture Section */}
        <View style={styles.pictureContainer}>
          <TouchableOpacity style={styles.pictureBox} onPress={handlePickImage}>
            {pictureUrl ? (
              <Image source={{ uri: pictureUrl }} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
            ) : (
              <Text style={{ fontSize: 40 }}>📦</Text>
            )}
            <View style={styles.cameraIconBtn}>
              <Text style={{ fontSize: 20, color: '#fff' }}>📷</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Item Name EN */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Item Name (English) *</Text>
          <TextInput
            style={[styles.input, errors.nameEn ? styles.inputError : null]}
            placeholder="e.g. Rice 5kg"
            placeholderTextColor={Colors.textGray}
            value={nameEn}
            onChangeText={t => { setNameEn(t); setErrors(p => ({ ...p, nameEn: '' })); }}
            autoFocus
          />
          {!!errors.nameEn && <Text style={styles.errText}>{errors.nameEn}</Text>}
        </View>

        {/* Item Name UR */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Item Name (Urdu - Optional)</Text>
          <TranslateToUrdu
            value={nameUr}
            onChangeText={setNameUr}
            placeholder="مثلاً چاول 5 کلو"
            sourceText={nameEn}
          />
        </View>

        {/* Category */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Category *</Text>
          <TextInput
            style={[styles.input, errors.category ? styles.inputError : null, { marginBottom: 8 }]}
            placeholder="e.g. Groceries"
            placeholderTextColor={Colors.textGray}
            value={category}
            onChangeText={t => { setCategory(t); setErrors(p => ({ ...p, category: '' })); }}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {PREDEFINED_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => { setCategory(cat); setErrors(p => ({ ...p, category: '' })); }}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {!!errors.category && <Text style={styles.errText}>{errors.category}</Text>}
        </View>

        {/* Unit */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Unit of Measurement *</Text>
          <TextInput
            style={[styles.input, errors.unit ? styles.inputError : null, { marginBottom: 8 }]}
            placeholder="e.g. kg, piece, box"
            placeholderTextColor={Colors.textGray}
            value={unit}
            onChangeText={t => { setUnit(t); setErrors(p => ({ ...p, unit: '' })); }}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {PREDEFINED_UNITS.map(u => (
              <TouchableOpacity
                key={u}
                style={[styles.chip, unit === u && styles.chipActive]}
                onPress={() => { setUnit(u); setErrors(p => ({ ...p, unit: '' })); }}
              >
                <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {!!errors.unit && <Text style={styles.errText}>{errors.unit}</Text>}
        </View>

        {/* Purchase Price */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Purchase Price (Rs.) (Optional)</Text>
          <TextInput
            style={[styles.input, errors.purchasePrice ? styles.inputError : null]}
            placeholder="0.00"
            placeholderTextColor={Colors.textGray}
            value={purchasePrice}
            onChangeText={t => { setPurchasePrice(t); setErrors(p => ({ ...p, purchasePrice: '' })); }}
            keyboardType="decimal-pad"
          />
          {!!errors.purchasePrice && <Text style={styles.errText}>{errors.purchasePrice}</Text>}
        </View>

        {/* Sale Price */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Sale Price (Rs.) (Optional)</Text>
          <TextInput
            style={[styles.input, errors.salePrice ? styles.inputError : null]}
            placeholder="0.00"
            placeholderTextColor={Colors.textGray}
            value={salePrice}
            onChangeText={t => { setSalePrice(t); setErrors(p => ({ ...p, salePrice: '' })); }}
            keyboardType="decimal-pad"
          />
          {!!errors.salePrice && <Text style={styles.errText}>{errors.salePrice}</Text>}
        </View>

        {/* Barcode */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Barcode / SKU (Optional)</Text>
          <View style={styles.barcodeRow}>
            <TextInput
              style={[styles.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
              placeholder="Scan or enter barcode"
              placeholderTextColor={Colors.textGray}
              value={barcode}
              onChangeText={setBarcode}
            />
            <TouchableOpacity style={styles.scannerBtn} onPress={handleScanBarcode}>
              <Text style={{ fontSize: 18, color: '#fff' }}>📷 Scan</Text>
            </TouchableOpacity>
          </View>
          {!!errors.barcode && <Text style={styles.errText}>{errors.barcode}</Text>}
        </View>

        {/* Low Stock Limit */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Low Stock Limit *</Text>
          <TextInput
            style={[styles.input, errors.lowStockLimit ? styles.inputError : null]}
            placeholder="5"
            placeholderTextColor={Colors.textGray}
            value={lowStockLimit}
            onChangeText={t => { setLowStockLimit(t); setErrors(p => ({ ...p, lowStockLimit: '' })); }}
            keyboardType="number-pad"
          />
          {!!errors.lowStockLimit && <Text style={styles.errText}>{errors.lowStockLimit}</Text>}
        </View>

        {/* Submit Button inside ScreenContainer */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.65 }, { marginTop: 12, marginBottom: 24 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>SAVE ITEM</Text>
          }
        </TouchableOpacity>
      </ScreenContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.textWhite, fontWeight: '400' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },

  form: { padding: 16, paddingBottom: 40 },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textWhite, marginBottom: 6 },

  input: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 14, color: Colors.textWhite,
  },
  inputError: { borderColor: Colors.error },
  errText: { fontSize: 12, color: Colors.error, marginTop: 4 },

  chip: {
    backgroundColor: Colors.bgInput, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 18, marginRight: 8, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, color: Colors.textGray, fontWeight: '500' },
  chipTextActive: { color: Colors.textWhite, fontWeight: '700' },

  pictureContainer: { alignSelf: 'center', marginVertical: 16, position: 'relative' },
  pictureBox: {
    width: 120, height: 120, backgroundColor: Colors.bgInput,
    borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  cameraIconBtn: {
    position: 'absolute', bottom: -6, right: -6,
    backgroundColor: Colors.primary, width: 40, height: 40,
    borderRadius: 20, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.bgCard
  },

  barcodeRow: { flexDirection: 'row', alignItems: 'center' },
  scannerBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 14,
    borderTopRightRadius: 10, borderBottomRightRadius: 10,
    height: 45, justifyContent: 'center'
  },

  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, height: 50,
    justifyContent: 'center', alignItems: 'center',
  },
  submitText: { fontSize: 16, fontWeight: '700', color: Colors.textWhite },
});

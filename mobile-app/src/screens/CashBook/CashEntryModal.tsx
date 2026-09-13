import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useTransactionStore } from '../../store/transactionStore';
import { useActivityStore } from '../../store/useActivityStore';
import { createCashEntry, updateCashEntry } from '../../services/database/cashbookDb';
import { CashEntry } from '../../types';
import { rupeesToPaisa, paisaToRupeesString } from '../../utils/calculations';
import { getStockItemsByUserId } from '../../services/database/stockDb';
import { Colors } from '../../theme';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { DateField } from '../../components/ui/DateField';
import { todayDate } from '../../utils/dates';

const GREEN = '#22C55E';
const DARK_RED = '#8B0000';
const RED_LIGHT = '#DC2626';

const IN_CATEGORIES = ['Sales', 'Commission', 'Loan Received', 'Recovery', 'Investment', 'Other'];
const OUT_CATEGORIES = ['Purchase', 'Rent', 'Salary', 'Utilities', 'Transport', 'Food', 'Other'];

interface Props {
  navigation: any;
  // `entry` is passed by the EditCashEntryModal route (from CashEntryDetail).
  route?: { params?: { mode?: 'in' | 'out'; entry?: CashEntry } };
}

/**
 * Unified Cash In / Cash Out entry modal.
 */
export const CashEntryModal = ({ navigation, route }: Props) => {
  const existingEntry = route?.params?.entry;
  const mode: 'in' | 'out' = existingEntry ? existingEntry.direction : (route?.params?.mode ?? 'in');
  const isIn = mode === 'in';
  const ACCENT = isIn ? GREEN : DARK_RED;
  const CATEGORIES = isIn ? IN_CATEGORIES : OUT_CATEGORIES;

  const { user } = useAuthStore();
  const { loadCashBook } = useTransactionStore();
  const { logActivity } = useActivityStore();

  const [amount, setAmount] = useState(
    existingEntry ? paisaToRupeesString(existingEntry.amount_paisa) : ''
  );
  // description / category / note are real columns now — no " — " packing.
  const [description, setDescription] = useState(
    existingEntry ? existingEntry.description : ''
  );
  const [category, setCategory] = useState(
    existingEntry?.category || CATEGORIES[0]
  );
  const [date, setDate] = useState(
    existingEntry ? existingEntry.date : todayDate()
  );
  const [note, setNote] = useState(
    existingEntry?.note ?? ''
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [showItemModal, setShowItemModal] = useState(false);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(
    existingEntry?.attachment_url || null
  );

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.5,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setAttachmentUrl(result.assets[0].uri);
    }
  };

  const handlePickFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Gallery permission is required to choose photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setAttachmentUrl(result.assets[0].uri);
    }
  };

  const handleSelectPhoto = () => {
    Alert.alert(
      'Attach Photo',
      'Choose an option to add a photo attachment',
      [
        {
          text: 'Camera',
          onPress: handleTakePhoto,
        },
        {
          text: 'Gallery',
          onPress: handlePickFromGallery,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  useEffect(() => {
    if (user?.id) {
      const fetchStock = async () => {
        try {
          const items = await getStockItemsByUserId(user.id);
          setStockItems(items || []);
        } catch (err) {
          if (__DEV__) console.error('Failed to load stock items:', err);
        }
      };
      fetchStock();
    }
  }, [user?.id]);

  const filteredStockItems = stockItems.filter(item => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const nameEn = (item.name_en || '').toLowerCase();
    const nameUr = (item.name_ur || '').toLowerCase();
    const categoryName = (item.category || '').toLowerCase();
    return nameEn.includes(query) || nameUr.includes(query) || categoryName.includes(query);
  });

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    const paisa = rupeesToPaisa(amount);
    if (!amount.trim()) e.amount = 'Amount is required';
    else if (paisa === null) e.amount = 'Enter a valid positive amount';
    if (!description.trim()) e.description = 'Description / Item is required';
    if (!category) e.category = 'Please select a category';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) e.date = 'Date must be YYYY-MM-DD';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !user) return;
    const paisa = rupeesToPaisa(amount)!;
    setLoading(true);
    try {
      const cleanDescription = description.trim();
      const cleanNote = note.trim() || null;

      if (existingEntry) {
        await updateCashEntry(existingEntry.id, user.id, {
          description: cleanDescription,
          amount_paisa: paisa,
          direction: mode,
          date: date,
          category: category,
          note: cleanNote,
          attachment_url: attachmentUrl || null,
        });

        await logActivity({
          user_id: user.id,
          user_name: user.name || 'User',
          action: 'update',
          entity_type: 'cash',
          entity_id: existingEntry.id,
          description: `Updated ${isIn ? 'Cash In' : 'Cash Out'}: ${cleanDescription}`,
          amount: paisa,
        });
      } else {
        const entry = await createCashEntry(
          user.id, cleanDescription, paisa, mode, date,
          attachmentUrl || null, category, cleanNote
        );

        await logActivity({
          user_id: user.id,
          user_name: user.name || 'User',
          action: 'create',
          entity_type: 'cash',
          entity_id: entry.id,
          description: `${isIn ? 'Cash In' : 'Cash Out'}: ${cleanDescription}`,
          amount: paisa,
        });
      }

      await loadCashBook(user.id);
      navigation.goBack();
    } catch (err: any) {
      if (__DEV__) console.error('[CashEntry] Failed to save:', err);
      Alert.alert('Error', err?.message || 'Failed to save entry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{existingEntry ? 'Edit Entry' : (isIn ? 'Cash In' : 'Cash Out')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScreenContainer scrollable={true} hasTabBar={true} contentContainerStyle={styles.form}>

        {/* Amount Stepper & Presets */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Amount (Rs.) *</Text>
          <View style={[styles.stepperBox, errors.amount ? styles.inputError : null]}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => {
                const num = parseFloat(amount) || 0;
                if (num >= 50) setAmount((num - 50).toString());
              }}
            >
              <Text style={styles.stepperIcon}>-</Text>
            </TouchableOpacity>

            <View style={styles.stepperCenter}>
              <Text style={[styles.rsPrefix, { color: isIn ? GREEN : RED_LIGHT }]}>Rs.</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={Colors.textGray}
                value={amount}
                onChangeText={t => { setAmount(t); setErrors(p => ({ ...p, amount: '' })); }}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => {
                const num = parseFloat(amount) || 0;
                setAmount((num + 50).toString());
              }}
            >
              <Text style={styles.stepperIcon}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Amount Preset Pills */}
          <View style={styles.presetPillRow}>
            {['50', '100', '200', '500', '1000'].map(val => (
              <TouchableOpacity
                key={val}
                style={[styles.presetPill, amount === val && styles.presetPillActive]}
                onPress={() => { setAmount(val); setErrors(p => ({ ...p, amount: '' })); }}
              >
                <Text style={[styles.presetPillText, amount === val && styles.presetPillTextActive]}>
                  Rs {val}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!!errors.amount && <Text style={styles.errText}>{errors.amount}</Text>}
        </View>

        {/* Description / Item */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Description / Item *</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1 }, errors.description ? styles.inputError : null]}
              placeholder="e.g. Shop Rent, Sales"
              placeholderTextColor={Colors.textGray}
              value={description}
              onChangeText={t => { setDescription(t); setErrors(p => ({ ...p, description: '' })); }}
            />
            {stockItems.length > 0 && (
              <TouchableOpacity
                style={styles.selectStockBtn}
                onPress={() => setShowItemModal(true)}
              >
                <Text style={styles.selectStockBtnText}>📦 Stock</Text>
              </TouchableOpacity>
            )}
          </View>
          {!!errors.description && <Text style={styles.errText}>{errors.description}</Text>}
        </View>

        {/* Category */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Category *</Text>
          <View style={styles.chips}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && { backgroundColor: ACCENT, borderColor: ACCENT }]}
                onPress={() => { setCategory(cat); setErrors(p => ({ ...p, category: '' })); }}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!!errors.category && <Text style={styles.errText}>{errors.category}</Text>}
        </View>

        {/* Date */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Date *</Text>
          <DateField
            style={[styles.input, errors.date ? styles.inputError : null]}
            value={date}
            onChange={(txt) => {
              setDate(txt);
              if (errors.date) setErrors((p) => ({ ...p, date: '' }));
            }}
          />
          {!!errors.date && <Text style={styles.errText}>{errors.date}</Text>}
        </View>

        {/* Note / Details */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Note / Details (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add notes, invoice number, party name..."
            placeholderTextColor={Colors.textGray}
            multiline
            numberOfLines={3}
            value={note}
            onChangeText={setNote}
          />
        </View>

        {/* Photo / Bill Attachment */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Photo / Bill Attachment (Optional)</Text>
          {attachmentUrl ? (
            <View style={styles.attachmentContainer}>
              <Image source={{ uri: attachmentUrl }} style={styles.attachmentPreview} />
              <View style={styles.attachmentInfo}>
                <Text style={styles.attachmentTitle}>Photo Attached</Text>
                <TouchableOpacity onPress={handleSelectPhoto}>
                  <Text style={styles.attachmentChangeText}>Change Photo</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.attachmentRemoveBtn} onPress={() => setAttachmentUrl(null)}>
                <Text style={styles.attachmentRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.attachmentButton} onPress={handleSelectPhoto}>
              <Text style={styles.attachmentButtonIcon}>📷</Text>
              <Text style={styles.attachmentButtonText}>Add Receipt or Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} disabled={loading}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: ACCENT, shadowColor: ACCENT }, loading && { opacity: 0.65 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{isIn ? '+ CASH IN' : '- CASH OUT'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScreenContainer>

      {/* Stock Item Picker Modal */}
      <Modal
        visible={showItemModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowItemModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Stock Item</Text>
              <TouchableOpacity onPress={() => { setShowItemModal(false); setSearchQuery(''); }}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search Box */}
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search items by name or category..."
              placeholderTextColor={Colors.textGray}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {/* Item List */}
            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {filteredStockItems.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {stockItems.length === 0 
                      ? "No items saved in stock.\nGo to 'Stock Book' to add items."
                      : "No matching items found."}
                  </Text>
                </View>
              ) : (
                filteredStockItems.map((item) => {
                  const isLowStock = item.quantity <= item.low_stock_threshold;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.itemRow}
                      onPress={() => {
                        setDescription(item.name_en + (item.name_ur ? ` (${item.name_ur})` : ''));
                        const price = isIn ? item.sale_price : item.purchase_price;
                        setAmount(price.toString());
                        const targetCategories = isIn ? IN_CATEGORIES : OUT_CATEGORIES;
                        const defaultCategory = isIn ? 'Sales' : 'Purchase';
                        const matchedCat = targetCategories.find(c => c.toLowerCase() === item.category.toLowerCase());
                        setCategory(matchedCat || defaultCategory);
                        setErrors(p => ({ ...p, description: '', amount: '', category: '' }));
                        setShowItemModal(false);
                        setSearchQuery('');
                      }}
                    >
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemNameEn}>{item.name_en}</Text>
                        {!!item.name_ur && <Text style={styles.itemNameUr}>{item.name_ur}</Text>}
                        <Text style={styles.itemCategory}>{item.category}</Text>
                      </View>
                      <View style={styles.itemMeta}>
                        <Text style={styles.itemPrice}>Rs. {isIn ? item.sale_price : item.purchase_price}</Text>
                        <Text style={[styles.itemQty, isLowStock ? styles.lowStock : styles.normalStock]}>
                          Qty: {item.quantity} {item.unit}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 56, backgroundColor: Colors.bgCard,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtnText: { fontSize: 18, color: Colors.textGray, fontWeight: '700' },
  backBtn: { width: 36, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.textWhite, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },

  form: { padding: 20, paddingBottom: 40 },
  fieldWrap: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textWhite, marginBottom: 8 },

  input: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: Colors.textWhite, minHeight: 48,
  },
  textArea: { minHeight: 85, textAlignVertical: 'top' },
  inputError: { borderColor: Colors.error },
  errText: { fontSize: 12, color: Colors.error, marginTop: 4 },

  selectStockBtn: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.primary,
    borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', height: 48,
  },
  selectStockBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primaryLight },

  stepperBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgInput,
    borderRadius: 16, paddingHorizontal: 12, height: 56,
    borderWidth: 1, borderColor: Colors.border,
  },
  stepperBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  stepperIcon: { fontSize: 22, fontWeight: '700', color: Colors.textWhite },
  stepperCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  rsPrefix: { fontSize: 18, fontWeight: '700', marginRight: 4, color: Colors.textGray },
  amountInput: { fontSize: 24, fontWeight: '900', color: Colors.textWhite, minWidth: 100, textAlign: 'center' },

  presetPillRow: { flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'space-between' },
  presetPill: {
    flex: 1, backgroundColor: Colors.bgInput,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, paddingVertical: 10, alignItems: 'center',
  },
  presetPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  presetPillText: { fontSize: 12, fontWeight: '700', color: Colors.textGray },
  presetPillTextActive: { fontSize: 12, fontWeight: '900', color: Colors.textWhite },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textGray },
  chipTextActive: { color: Colors.textWhite, fontWeight: '700' },

  attachmentButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgInput, borderWidth: 1.5, borderColor: Colors.border,
    borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14, gap: 8, minHeight: 48,
  },
  attachmentButtonIcon: { fontSize: 18 },
  attachmentButtonText: { fontSize: 14, color: Colors.textGray, fontWeight: '600' },

  attachmentContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, padding: 10,
  },
  attachmentPreview: { width: 48, height: 48, borderRadius: 8, backgroundColor: Colors.bgCard },
  attachmentInfo: { flex: 1, marginLeft: 12 },
  attachmentTitle: { fontSize: 14, fontWeight: '700', color: Colors.textWhite },
  attachmentChangeText: { fontSize: 13, color: Colors.primaryLight, fontWeight: '600', marginTop: 2 },
  attachmentRemoveBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center',
  },
  attachmentRemoveText: { fontSize: 14, fontWeight: '700', color: Colors.textGray },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelBtn: {
    flex: 1, backgroundColor: Colors.bgInput, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, minHeight: 48,
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: Colors.textGray },

  submitBtn: {
    flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    minHeight: 48, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '80%', borderWidth: 1, borderColor: Colors.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.textWhite },
  modalSearchInput: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: Colors.textWhite, marginBottom: 12,
  },
  modalList: { maxHeight: 350 },
  emptyContainer: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.textGray, textAlign: 'center', lineHeight: 20 },

  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  itemInfo: { flex: 1, paddingRight: 8 },
  itemNameEn: { fontSize: 15, fontWeight: '600', color: Colors.textWhite },
  itemNameUr: { fontSize: 13, color: Colors.textGray, marginTop: 2 },
  itemCategory: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  itemMeta: { alignItems: 'flex-end' },
  itemPrice: { fontSize: 15, fontWeight: '700', color: Colors.primaryLight },
  itemQty: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  normalStock: { color: Colors.textGray },
  lowStock: { color: Colors.error },
});

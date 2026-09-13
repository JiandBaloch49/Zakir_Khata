import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Colors } from '../../theme';

export const StaffDetail = ({ route, navigation }: any) => {
  const staff = route.params?.staff;

  if (!staff) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Staff Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Text style={{ color: Colors.textGray }}>Staff member not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Staff Profile</Text>
        <TouchableOpacity style={{ padding: 8 }} onPress={() => Alert.alert('Edit Staff', 'Staff editing is coming soon.')}>
          <Text style={{ fontSize: 20, color: Colors.primaryLight }}>✎</Text>
        </TouchableOpacity>
      </View>

      <ScreenContainer scrollable={true} hasTabBar={false} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.avatar}>
              <Text style={{ fontSize: 40 }}>👤</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.nameEn}>{staff.name_en}</Text>
              {staff.name_ur ? <Text style={styles.nameUr}>{staff.name_ur}</Text> : null}
              <Text style={styles.role}>{staff.role}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Details Grid */}
          <View style={styles.detailsList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone:</Text>
              <Text style={styles.detailValue}>{staff.phone}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Joining Date:</Text>
              <Text style={styles.detailValue}>{new Date(staff.joining_date).toLocaleDateString()}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status:</Text>
              <Text style={[styles.detailValue, { color: staff.status === 'active' ? Colors.success : Colors.error }]}>
                {staff.status === 'active' ? 'Active' : 'Inactive'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Area:</Text>
              <Text style={styles.detailValue}>{staff.area}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Business Type:</Text>
              <Text style={styles.detailValue}>{staff.business_type}</Text>
            </View>
            {staff.email ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email:</Text>
                <Text style={styles.detailValue}>{staff.email}</Text>
              </View>
            ) : null}
            {staff.address ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address:</Text>
                <Text style={styles.detailValue}>{staff.address}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Salary Details Card / Action Button */}
        <TouchableOpacity
          style={{
            backgroundColor: Colors.primary,
            padding: 16,
            borderRadius: 14,
            marginTop: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
          onPress={() => navigation.navigate('StaffSalaryDetail', { staff })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 24, marginRight: 12 }}>💵</Text>
            <View>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Salary & Cash Ledger</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Manage Salary, Cash Out & Cash In</Text>
            </View>
          </View>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>›</Text>
        </TouchableOpacity>

        {/* Documents */}
        {staff.document_urls && staff.document_urls.length > 0 && (
          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={styles.cardHeader}>Documents</Text>
            <View style={styles.divider} />
            {staff.document_urls.map((doc: string, idx: number) => (
              <View key={idx} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                <Text style={{ color: Colors.textWhite, fontSize: 14 }}>📎 {doc}</Text>
              </View>
            ))}
          </View>
        )}

      </ScreenContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.textWhite, fontWeight: '400' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },

  card: {
    backgroundColor: Colors.bgCard, borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', paddingBottom: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.bgInput, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  nameEn: { fontSize: 20, fontWeight: '700', color: Colors.textWhite },
  nameUr: { fontSize: 14, color: Colors.textGray, marginTop: 2, textAlign: 'right' },
  role: { fontSize: 14, color: Colors.primaryLight, marginTop: 4, fontWeight: '600' },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },

  detailsList: { paddingTop: 4 },
  detailRow: { flexDirection: 'row', paddingVertical: 8 },
  detailLabel: { width: 110, fontSize: 13, color: Colors.textGray, fontWeight: '500' },
  detailValue: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textWhite },

  cardHeader: { fontSize: 16, fontWeight: '700', color: Colors.textWhite, paddingBottom: 4 }
});

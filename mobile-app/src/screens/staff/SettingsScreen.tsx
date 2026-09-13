import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Alert, ScrollView,
  Image, ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useSyncStore } from '../../store/useSyncStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { IS_FIREBASE_CONFIGURED } from '../../services/firebase/firebaseConfig';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../theme';
import { ScreenContainer } from '../../components/ui/ScreenContainer';

const RadioDot = ({ active }: { active: boolean }) => (
  <View
    style={[
      styles.radioDot,
      active && { borderColor: Colors.primary },
    ]}
  >
    {active && <View style={styles.radioDotInner} />}
  </View>
);

export const SettingsScreen = () => {
  const navigation = useNavigation<any>();
  const { user, logout, updateProfilePicture } = useAuthStore();
  const { nameDisplayMode, setNameDisplayMode } = useSettingsStore();
  const { isOnline, pendingCount, isSyncing, processSyncQueue } = useSyncStore();
  const { language, setLanguage, t } = useLanguageStore();
  const [uploadingPic, setUploadingPic] = useState(false);

  const handlePickProfilePic = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library in Settings to change your profile picture.',
        [{ text: 'OK' }],
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });

    if (result.canceled || !result.assets?.length) return;

    const uri = result.assets[0].uri;
    if (!user?.id) return;

    setUploadingPic(true);
    try {
      await updateProfilePicture(user.id, uri);
    } finally {
      setUploadingPic(false);
    }
  };

  const handleSync = async () => {
    if (!IS_FIREBASE_CONFIGURED) {
      Alert.alert('Sync Unavailable', 'Firebase is not configured. Data is stored locally only.');
      return;
    }
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot sync while offline.');
      return;
    }
    await processSyncQueue();
    Alert.alert('Sync Triggered', 'Sync process completed.');
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScreenContainer scrollable={true} hasTabBar={true} contentContainerStyle={styles.scrollContent}>

        {/* ── Account Section ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.profileRow}>
            {/* Profile picture */}
            <TouchableOpacity
              onPress={handlePickProfilePic}
              disabled={uploadingPic}
              style={styles.avatarWrap}
            >
              {uploadingPic ? (
                <View style={[styles.avatarCircle, { justifyContent: 'center', alignItems: 'center' }]}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : user?.pictureUrl ? (
                <Image
                  source={{ uri: user.pictureUrl }}
                  style={styles.avatarCircle}
                />
              ) : (
                <View style={[styles.avatarCircle, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>
                    {user?.name?.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {/* Camera badge */}
              <View style={styles.cameraBadge}>
                <Text style={{ fontSize: 10 }}>📷</Text>
              </View>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user?.name}</Text>
              <Text style={styles.userPhone}>{user?.phone}</Text>
              {user?.businessName && (
                <Text style={styles.userBiz}>{user.businessName}</Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.changePasswordBtn}
            onPress={() => navigation.navigate('ChangePassword')}
          >
            <Text style={styles.changePasswordText}>Change Password</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.changePasswordBtn, { marginTop: 10 }]}
            onPress={() => navigation.navigate('SubStaff')}
          >
            <Text style={styles.changePasswordText}>Manage Sub-Staff</Text>
          </TouchableOpacity>
        </View>

        {/* ── UI Language ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('languageLabel')}</Text>
          <Text style={styles.sectionSubtitle}>{t('languageHelp')}</Text>
          <View style={styles.langRow}>
            <TouchableOpacity
              style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
              onPress={() => setLanguage('en')}
            >
              <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>
                English
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langBtn, language === 'ur' && styles.langBtnActive]}
              onPress={() => setLanguage('ur')}
            >
              <Text style={[styles.langBtnText, language === 'ur' && styles.langBtnTextActive]}>
                اردو
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Display Language ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('nameDisplayLabel')}</Text>
          <Text style={styles.sectionSubtitle}>{t('nameDisplayHelp')}</Text>

          <TouchableOpacity
            style={styles.radioRow}
            onPress={() => setNameDisplayMode(user!.id, 'en')}
          >
            <RadioDot active={nameDisplayMode === 'en'} />
            <Text style={styles.radioLabel}>{t('english')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.radioRow}
            onPress={() => setNameDisplayMode(user!.id, 'ur')}
          >
            <RadioDot active={nameDisplayMode === 'ur'} />
            <Text style={styles.radioLabel}>{t('urduFallback')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.radioRow}
            onPress={() => setNameDisplayMode(user!.id, 'both')}
          >
            <RadioDot active={nameDisplayMode === 'both'} />
            <Text style={styles.radioLabel}>{t('bothNames')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Sync Status ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SYNC STATUS</Text>
          <View style={styles.syncRow}>
            <Text style={{ fontSize: 20, marginRight: 10 }}>
              {pendingCount === 0 ? '✅' : '🔄'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.syncStatusText}>
                {pendingCount === 0 ? 'All changes synced' : `${pendingCount} changes pending sync`}
              </Text>
              <Text style={styles.syncStatusSub}>
                {pendingCount === 0 ? 'Up to date' : 'Will sync when online'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.syncBtn,
              (!isOnline || isSyncing) && styles.syncBtnDisabled,
            ]}
            onPress={handleSync}
            disabled={!isOnline || isSyncing}
          >
            <Text style={[styles.syncBtnText, (!isOnline || isSyncing) && styles.syncBtnTextDisabled]}>
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

      </ScreenContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },

  header: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textWhite,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // ── Section ──
  section: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textGray,
    marginBottom: 12,
  },

  // ── Profile ──
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarWrap: {
    marginRight: 16,
    position: 'relative',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: Colors.primary,
    fontSize: 24,
    fontWeight: '800',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bgCard,
  },
  userName: {
    color: Colors.textWhite,
    fontSize: 17,
    fontWeight: '700',
  },
  userPhone: {
    color: Colors.textGray,
    fontSize: 13,
    marginTop: 2,
  },
  userBiz: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  changePasswordBtn: {
    backgroundColor: Colors.bgInput,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changePasswordText: {
    color: Colors.primaryLight,
    fontWeight: '700',
    fontSize: 14,
  },

  // ── Language ──
  langRow: {
    flexDirection: 'row',
    gap: 10,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgInput,
  },
  langBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  langBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textGray,
  },
  langBtnTextActive: {
    color: Colors.textWhite,
  },

  // ── Radio ──
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  radioLabel: {
    color: Colors.textGray,
    fontSize: 14,
    fontWeight: '500',
  },

  // ── Sync ──
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  syncStatusText: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '600',
  },
  syncStatusSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  syncBtn: {
    backgroundColor: Colors.bgInput,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryGlow,
  },
  syncBtnDisabled: {
    borderColor: Colors.border,
    opacity: 0.5,
  },
  syncBtnText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  syncBtnTextDisabled: {
    color: Colors.textMuted,
  },

  // ── Logout ──
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: Colors.error,
    fontWeight: '700',
    fontSize: 15,
  },
});

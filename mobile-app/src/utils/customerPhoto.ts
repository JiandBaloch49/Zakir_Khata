import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

/**
 * Customer photos — durability first.
 *
 * ImagePicker hands back a file:// URI in the app CACHE directory. Android reclaims
 * that directory under storage pressure, so a photo stored as that URI can vanish
 * on the same phone with no sync involved. persistCustomerPhoto() copies the picked
 * file into documentDirectory, which the OS treats as app data, and returns THAT
 * path for the photo_local_path column.
 *
 * Compression matches the receipt pickers (allowsEditing crop + quality 0.5).
 * Resizing to ~512px would need expo-image-manipulator, which is not installed;
 * the square crop keeps the stored file small in practice.
 */

const PHOTO_DIR = () => `${FileSystem.documentDirectory}customer_photos/`;

const PICK_OPTIONS = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  aspect: [1, 1] as [number, number],
  quality: 0.5,
};

/** Camera-or-gallery chooser, same flow as CashEntryModal. Resolves to a picker URI or null. */
export const pickCustomerPhoto = (): Promise<string | null> =>
  new Promise(resolve => {
    const fromCamera = async () => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission Denied', 'Camera permission is required to take photos.'); return resolve(null); }
      const result = await ImagePicker.launchCameraAsync(PICK_OPTIONS);
      resolve(!result.canceled && result.assets?.[0]?.uri ? result.assets[0].uri : null);
    };
    const fromGallery = async () => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission Denied', 'Gallery permission is required to choose photos.'); return resolve(null); }
      const result = await ImagePicker.launchImageLibraryAsync(PICK_OPTIONS);
      resolve(!result.canceled && result.assets?.[0]?.uri ? result.assets[0].uri : null);
    };
    Alert.alert('Customer Photo', 'Choose an option', [
      { text: 'Camera', onPress: fromCamera },
      { text: 'Gallery', onPress: fromGallery },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });

/** True when the path is already our durable copy (so re-saving does not re-copy). */
export const isPersistedCustomerPhoto = (uri?: string | null): boolean =>
  !!uri && !!FileSystem.documentDirectory && uri.startsWith(PHOTO_DIR());

/**
 * Copies a picked image into documentDirectory/customer_photos/<customerId>.jpg
 * and returns the durable path. A path that is already ours is returned as-is.
 */
export const persistCustomerPhoto = async (pickedUri: string, customerId: string): Promise<string> => {
  if (isPersistedCustomerPhoto(pickedUri)) return pickedUri;
  const dir = PHOTO_DIR();
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const target = `${dir}${customerId}_${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: pickedUri, to: target });
  return target;
};

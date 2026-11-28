import * as ImagePicker from 'expo-image-picker';

export type PickedImage = { uri: string; name: string; bytes: number };

/**
 * Lets the patient choose a photo. Returns null when they cancel, and throws a message
 * that can be shown when the file is too large.
 */
export async function pickImage(maxMegabytes: number): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const bytes = asset.fileSize ?? 0;
  if (bytes > maxMegabytes * 1024 * 1024) {
    throw new Error(`Choose a file smaller than ${maxMegabytes}MB.`);
  }
  return { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', bytes };
}

export const fileSizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

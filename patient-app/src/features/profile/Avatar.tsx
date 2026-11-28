import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';

type Props = {
  photoUri: string | null;
  initials: string;
  size: number;
  /** The dark rounded square used on the profile card. */
  square?: boolean;
};

export function Avatar({ photoUri, initials, size, square }: Props) {
  const borderRadius = square ? size / 4 : size / 2;
  if (photoUri) {
    return (
      <Image
        source={{ uri: photoUri }}
        contentFit="cover"
        style={{ width: size, height: size, borderRadius }}
        accessibilityLabel="Your profile photo"
      />
    );
  }
  return (
    <View
      className={cn(
        'items-center justify-center border border-line/40',
        square ? 'bg-ink' : 'bg-sky-150',
      )}
      style={{ width: size, height: size, borderRadius }}>
      <Text
        className={cn('font-pj-bd', square ? 'text-white' : 'text-ink')}
        style={{ fontSize: size * 0.34 }}>
        {initials}
      </Text>
    </View>
  );
}

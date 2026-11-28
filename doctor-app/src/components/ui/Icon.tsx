import { Image } from 'expo-image';

import { icons, type IconName } from '@/theme/icons';

type Props = {
  name: IconName;
  /** Scales the icon so its longer edge matches this size. Defaults to the design size. */
  size?: number;
  color?: string;
};

export function Icon({ name, size, color }: Props) {
  const { source, width, height } = icons[name];
  const scale = size ? size / Math.max(width, height) : 1;
  return (
    <Image
      source={source}
      tintColor={color}
      contentFit="contain"
      style={{ width: width * scale, height: height * scale }}
      accessible={false}
    />
  );
}

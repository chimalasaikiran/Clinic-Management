import { Pressable, TextInput, View } from 'react-native';

import { cn } from '@/lib/cn';
import colors from '@/theme/colors';

import { Icon } from './Icon';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  className?: string;
};

export function SearchField({ value, onChangeText, placeholder, className }: Props) {
  return (
    <View
      className={cn(
        'min-h-[48px] flex-row items-center gap-2.5 rounded-xl border border-edge bg-white px-4',
        className,
      )}>
      <Icon name="search" />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.slate}
        returnKeyType="search"
        autoCorrect={false}
        className="flex-1 py-2.5 font-pj text-[14px] text-ink"
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={10}
          onPress={() => onChangeText('')}>
          <Icon name="cancel-circle" />
        </Pressable>
      ) : null}
    </View>
  );
}

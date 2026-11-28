import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';

const rows = [
  [['1', ''], ['2', 'ABC'], ['3', 'DEF']],
  [['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO']],
  [['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ']],
  [['', ''], ['0', '+'], ['delete', '']],
] as const;

type Props = {
  onDigit: (digit: string) => void;
  onDelete: () => void;
};

/** The numeric keypad drawn in the sign-up design. */
export function Keypad({ onDigit, onDelete }: Props) {
  return (
    <View className="w-full max-w-[360px] gap-2 self-center">
      {rows.map((row) => (
        <View key={row[1][0]} className="flex-row gap-2">
          {row.map(([key, letters], column) =>
            key === '' ? (
              <View key={column} className="h-12 flex-1" />
            ) : (
              <Pressable
                key={column}
                accessibilityRole="button"
                accessibilityLabel={key === 'delete' ? 'Delete digit' : key}
                onPress={() => (key === 'delete' ? onDelete() : onDigit(key))}
                className={cn(
                  'h-12 flex-1 items-center justify-center rounded-xl border border-line/20 active:bg-sky-200',
                  key === 'delete' ? 'bg-sky-150/60' : 'bg-white',
                )}>
                {key === 'delete' ? (
                  <Icon name="backspace" />
                ) : (
                  <>
                    <Text className="font-pj-sb text-[18px] leading-6 text-ink">{key}</Text>
                    {letters ? (
                      <Text className="text-[9px] leading-[10px] tracking-[0.9px] text-muted">
                        {letters}
                      </Text>
                    ) : null}
                  </>
                )}
              </Pressable>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

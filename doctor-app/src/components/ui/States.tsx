import { ActivityIndicator, View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View className="items-center justify-center gap-3 py-16" accessibilityRole="progressbar">
      <ActivityIndicator color="#081e26" />
      <Text className="text-[13px] leading-[18px] text-slate">{label}</Text>
    </View>
  );
}

type MessageProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: MessageProps) {
  return (
    <View className="items-center gap-2 rounded-2xl border border-line/40 bg-sky-50 px-6 py-10">
      <Text className="text-center font-pj-bd text-[16px] leading-6 text-ink">{title}</Text>
      <Text className="text-center text-[13px] leading-[18px] text-slate">{message}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} size="md" className="mt-2" />
      ) : null}
    </View>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  actionLabel = 'Try again',
  onAction,
}: Partial<MessageProps> & { message: string }) {
  return (
    <View
      accessibilityRole="alert"
      className="items-center gap-2 rounded-2xl border border-[#ba1a1a]/30 bg-[#ffdad6]/40 px-6 py-10">
      <Text className="text-center font-pj-bd text-[16px] leading-6 text-[#93000a]">{title}</Text>
      <Text className="text-center text-[13px] leading-[18px] text-body">{message}</Text>
      {onAction ? (
        <Button label={actionLabel} onPress={onAction} size="md" className="mt-2" />
      ) : null}
    </View>
  );
}

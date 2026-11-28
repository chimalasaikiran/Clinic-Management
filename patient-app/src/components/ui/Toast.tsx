import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';

const ToastContext = createContext<(message: string) => void>(() => {});

/** Shows a short confirmation message near the bottom of the screen. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { bottom } = useSafeAreaInsets();

  const show = useCallback((next: string) => {
    clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), 2600);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          className="absolute left-5 right-5 items-center"
          style={{ bottom: bottom + 88 }}>
          <View className="rounded-xl bg-ink px-4 py-3">
            <Text className="text-center font-pj-sb text-[13px] leading-[18px] text-white">
              {message}
            </Text>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

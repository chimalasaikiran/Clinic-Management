import { Text as NativeText, type TextProps } from 'react-native';

import { cn } from '@/lib/cn';

/** Text in the app typeface. Pass a `font-pj-*` class to change the weight. */
export function Text({ className, ...props }: TextProps & { className?: string }) {
  const hasFamily = /(^|\s)font-pj/.test(className ?? '');
  return (
    <NativeText
      maxFontSizeMultiplier={1.3}
      {...props}
      className={cn(!hasFamily && 'font-pj', className)}
    />
  );
}

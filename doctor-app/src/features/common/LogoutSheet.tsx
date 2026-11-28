import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '@/components/staff/ui';
import { Text } from '@/components/ui/Text';
import { useConsultation } from '@/state/ConsultationState';
import { useSession } from '@/state/SessionState';
import { useStaff } from '@/state/StaffState';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Work that would be lost, shown before the user confirms. */
  warning?: string;
};

export function LogoutSheet({ visible, onClose, warning }: Props) {
  const { bottom } = useSafeAreaInsets();
  const { me } = useStaff();
  const consultation = useConsultation();
  const { signOut } = useSession();

  const logOut = () => {
    onClose();
    // Ends the session on the server too; the phone forgets it even when offline.
    signOut();
    consultation.reset();
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss log out" className="absolute inset-0 bg-black/45" onPress={onClose} />
        <View className="max-h-[92%] rounded-t-[32px] bg-white pt-5">
          <ScrollView bounces={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottom + 20 }}>
            <View className="w-full max-w-[440px] items-center gap-3 self-center">
              <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} className="absolute right-0 top-0 size-8 items-center justify-center rounded-full bg-sky-100">
                <Glyph name="close" size={16} />
              </Pressable>
              <View className="size-14 items-center justify-center rounded-2xl border border-danger/20 bg-[#ffdad6]/70">
                <Glyph name="logout" size={24} color="#ba1a1a" />
              </View>
              <Text accessibilityRole="header" className="pt-1 text-center font-pj-bd text-[22px] leading-7 text-ink">
                Log out of Clinic OS?
              </Text>
              <Text className="text-center text-[13px] leading-[18px] text-slate">
                You’ll need to sign in again with your registered phone number (
                <Text className="font-pj-sb text-[13px] text-ink">{me.phone}</Text>) to open clinic records.
              </Text>
              <View className="w-full gap-3 rounded-[20px] border border-[#cfc4c5]/40 bg-sky-50 p-4">
                <View className="flex-row items-center justify-between gap-2 border-b border-[#cfc4c5]/30 pb-3">
                  <View className="flex-1 flex-row items-center gap-2">
                    <Glyph name="smartphone" size={16} />
                    <Text className="shrink font-pj-md text-[13px] leading-[18px] text-ink">This device · {me.name}</Text>
                  </View>
                  <View className="flex-row items-center gap-1 rounded-full bg-sky-150 px-2 py-0.5">
                    <View className="size-1.5 rounded-full bg-teal" />
                    <Text className="font-pj-bd text-[10px] leading-[15px] text-ink">Active</Text>
                  </View>
                </View>
                <View className="flex-row gap-2.5">
                  <View className="size-7 items-center justify-center rounded-lg bg-mint">
                    <Glyph name="verified-user" size={15} color="#00201c" />
                  </View>
                  <Text className="flex-1 text-[13px] leading-[18px] text-slate">
                    {warning ??
                      (consultation.rx.length || consultation.orders.length
                        ? 'A prescription or order draft you have not authorized is only on this phone. Logging out discards it.'
                        : 'Saved records stay in ClinicOS. This phone forgets your sign-in.')}
                  </Text>
                </View>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Log Out" onPress={logOut} className="h-[52px] w-full flex-row items-center justify-center gap-2 rounded-[18px] bg-danger">
                <Glyph name="logout" size={18} color="#ffffff" />
                <Text className="font-pj-bd text-[16px] leading-6 text-white">Log Out</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Stay Signed In" onPress={onClose} className="h-[54px] w-full items-center justify-center rounded-[18px] border border-[#cfc4c5]/50 bg-sky-100">
                <Text className="font-pj-sb text-[16px] leading-6 text-ink">Stay Signed In</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

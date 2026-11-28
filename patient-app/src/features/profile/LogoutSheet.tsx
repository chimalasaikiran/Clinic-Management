import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { useAccount, useSession } from '@/state/SessionState';

type Props = { visible: boolean; onClose: () => void };

/** The log out confirmation from the design. */
export function LogoutSheet({ visible, onClose }: Props) {
  const { signOut } = useSession();
  const mobile = useAccount()?.mobile ?? '';

  const logOut = async () => {
    onClose();
    if (router.canDismiss()) router.dismissAll();
    await signOut();
    router.replace('/');
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
        onPress={onClose}
        className="size-8 items-center justify-center self-end rounded-full bg-sky-150">
        <Icon name="close" />
      </Pressable>
      <View className="items-center gap-2">
        <View className="size-14 items-center justify-center rounded-2xl border border-[#ba1a1a]/20 bg-[#ffdad6]/60">
          <Icon name="logout" color="#ba1a1a" />
        </View>
        <Text
          accessibilityRole="header"
          className="text-center font-pj-bd text-[22px] leading-7 text-ink">
          Log out of Clinic OS?
        </Text>
        <Text className="text-center text-[14px] leading-[22px] text-slate">
          You'll need to sign in again with your registered phone number (+91{' '}
          {mobile.slice(0, 5)} •••••) to access records.
        </Text>
      </View>
      <View className="mt-4 gap-2 rounded-2xl border border-line/40 bg-sky-50 p-3.5">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">
            This device
          </Text>
          <View className="rounded-full bg-teal-100 px-2 py-0.5">
            <Text className="font-pj-bd text-[10px] leading-[15px] text-teal">Active</Text>
          </View>
        </View>
        <Text className="text-[13px] leading-[19px] text-slate">
          Your medical records, e-prescriptions, and appointment tokens{' '}
          <Text className="font-pj-bd text-[13px] text-ink">stay with your clinic</Text> and will not
          be removed.
        </Text>
        <Text className="border-t border-line/30 pt-2 text-[11px] leading-4 text-slate">
          Your sign-in is removed from this phone when you log out
        </Text>
      </View>
      <View className="mt-4 gap-2.5">
        <Button
          label="Log Out"
          iconLeft="logout"
          iconColor="#ffffff"
          variant="danger"
          textClassName="font-pj-bd"
          onPress={logOut}
        />
        <Button label="Stay Signed In" variant="soft" onPress={onClose} />
      </View>
    </Sheet>
  );
}

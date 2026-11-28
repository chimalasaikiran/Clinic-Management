import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useSession } from '@/state/SessionState';

// Signed in, but nothing in this person's roles opens a mobile workspace (for example a finance-only role).
export default function NoWorkspace() {
  const { session, signOut } = useSession();
  if (session.status !== 'signedIn') return <Redirect href="/" />;
  const clinic = session.membership?.organisation.name;
  const roles = session.membership?.roles.map((role) => role.name).join(', ');

  return (
    <Screen className="bg-sky-50" contentClassName="flex-1 justify-center gap-5">
      <View className="items-center gap-3">
        <View className="size-14 items-center justify-center rounded-2xl bg-deep">
          <Icon name="brand-logo" />
        </View>
        <Text accessibilityRole="header" className="text-center font-pj-sb text-[22px] leading-7 text-ink">
          No mobile workspace for your role
        </Text>
        <Text className="text-center text-[14px] leading-5 text-slate">
          {clinic
            ? `You are signed in to ${clinic}${roles ? ` as ${roles}` : ''}. The staff app has workspaces for doctors, nurses and reception. Use the ClinicOS admin panel for your work, or ask your administrator to change your role.`
            : 'Your account is not an active member of a clinic. Ask your clinic administrator to invite you.'}
        </Text>
      </View>
      <Button label="Sign Out" variant="outline" onPress={signOut} />
    </Screen>
  );
}

import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Glyph, type GlyphName } from '@/components/staff/ui';
import { Text } from '@/components/ui/Text';
import { homeOf } from '@/data/staff';
import { useSession, useSignedIn, type Workspace } from '@/state/SessionState';

const LABELS: Record<Workspace, { title: string; icon: GlyphName }> = {
  doctor: { title: 'Doctor workspace', icon: 'medical-services' },
  nurse: { title: 'Nursing workspace', icon: 'monitor-heart' },
  reception: { title: 'Front desk workspace', icon: 'desktop-windows' },
};

/** For people whose role opens more than one workspace, such as a doctor who also books at the desk. */
export function WorkspaceSwitch() {
  const signedIn = useSignedIn();
  const { switchWorkspace } = useSession();
  const others = (signedIn?.workspaces ?? []).filter((workspace) => workspace !== signedIn?.workspace);
  if (!others.length) return null;

  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="px-1 font-pj-bd text-[11px] leading-4 text-slate">
        SWITCH WORKSPACE
      </Text>
      {others.map((workspace) => (
        <Pressable
          key={workspace}
          accessibilityRole="button"
          accessibilityLabel={`Open the ${LABELS[workspace].title}`}
          onPress={() => {
            switchWorkspace(workspace);
            if (router.canDismiss()) router.dismissAll();
            router.replace(homeOf[workspace]);
          }}
          className="flex-row items-center gap-3 rounded-[20px] border border-sky-250/60 bg-white p-3.5">
          <View className="size-9 items-center justify-center rounded-xl bg-sky-150">
            <Glyph name={LABELS[workspace].icon} size={18} />
          </View>
          <Text className="flex-1 font-pj-sb text-[13px] leading-[18px] text-ink">{LABELS[workspace].title}</Text>
          <Glyph name="swap-horiz" size={18} color="#4d626a" />
        </Pressable>
      ))}
    </View>
  );
}

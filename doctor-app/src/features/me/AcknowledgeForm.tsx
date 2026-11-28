import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Glyph } from '@/components/staff/ui';
import { useToast } from '@/components/ui/Toast';
import { rupees, type Advance } from '@/features/me/records';
import { MeButton, Txt } from '@/features/me/ui';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/state/SessionState';

/** The employee's own confirmation that the advance reached them. Recovery from pay starts after it. */
export function AcknowledgeForm({ advance, onDone }: { advance: Advance; onDone: () => void }) {
  const toast = useToast();
  const { call } = useSession();
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const statement = `I confirm that I have received the advance of ${rupees(advance.principal)} (${advance.reference}).`;

  const confirm = async () => {
    setSaving(true);
    try {
      await call(`/v1/me/pay/advances/${advance.id}/acknowledge`, { method: 'POST', body: { version: advance.version } });
      toast('Receipt confirmed.');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setSaving(false);
      // Reload either way, so a change made elsewhere shows.
      onDone();
    }
  };

  return (
    <View className="gap-3">
      <Pressable accessibilityRole="checkbox" accessibilityLabel={statement} accessibilityState={{ checked: agreed }} onPress={() => setAgreed(!agreed)} className="flex-row gap-2.5">
        <Glyph name={agreed ? 'check-box' : 'check-box-outline-blank'} size={20} color="#191c1e" />
        <Txt className="flex-1 text-[13px] leading-[19px]">{statement}</Txt>
      </Pressable>
      <Txt className="text-[#45464d]">Confirm only if the money has reached you. If it has not, speak to your clinic administrator.</Txt>
      <MeButton label={saving ? 'Confirming…' : 'Confirm Receipt'} icon="check" disabled={!agreed || saving} onPress={confirm} />
    </View>
  );
}

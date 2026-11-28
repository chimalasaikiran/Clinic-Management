import { useState } from 'react';
import { View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/state/SessionState';
import type { ClinicLink } from '@/types';

const CODE_LENGTH = 8;

type Props = {
  visible: boolean;
  onClose: () => void;
  onConnected: (links: ClinicLink[]) => void;
};

/** Connects a clinic record with the one-time code the clinic desk hands over. */
export function ConnectClinicSheet({ visible, onClose, onConnected }: Props) {
  const toast = useToast();
  const { call } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const close = () => {
    setCode('');
    setError('');
    onClose();
  };

  const connect = async () => {
    if (code.length !== CODE_LENGTH) {
      setError('Enter the 8-character code from your clinic.');
      return;
    }
    setSending(true);
    try {
      onConnected(await call<ClinicLink[]>('/v1/patient/links/code', { method: 'POST', body: { code } }));
      toast('Clinic connected.');
      close();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={close} title="Connect a clinic">
      <View className="gap-3">
        <Text className="text-[14px] leading-[22px] text-body">
          Ask the clinic reception for a connection code. It works once and expires after 24 hours.
        </Text>
        <TextField
          label="Connection code"
          value={code}
          onChangeText={(value) => {
            setError('');
            setCode(value.replace(/[^a-z0-9]/gi, '').toUpperCase());
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={CODE_LENGTH}
          error={error}
        />
        <Button label="Connect" loading={sending} onPress={connect} />
        <Button label="Cancel" variant="soft" onPress={close} />
      </View>
    </Sheet>
  );
}

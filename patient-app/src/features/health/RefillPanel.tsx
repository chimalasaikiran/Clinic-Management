import { useState } from 'react';
import { View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/Button';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/api';
import { dateTime } from '@/lib/dates';
import { useSession } from '@/state/SessionState';
import type { Prescription, RefillStatus } from '@/types';

import { recordCard, recordMeta, recordTitle } from './RecordKit';

export const REFILL: Record<RefillStatus, { label: string; tone: PillTone }> = {
  requested: { label: 'Refill requested', tone: 'amber' },
  approved: { label: 'Refill approved', tone: 'mint' },
  declined: { label: 'Refill declined', tone: 'red' },
  cancelled: { label: 'Refill request withdrawn', tone: 'sky' },
};

/** Ask the clinic for more of a prescription, and see what it decided. */
export function RefillPanel({ rx, onChanged }: { rx: Prescription; onChanged: () => void }) {
  const toast = useToast();
  const { call } = useSession();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refill = rx.refill;

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      await call(`/v1/patient/prescriptions/${rx.id}/refill-requests`, { method: 'POST', body: { note: note.trim() || null } });
      setAsking(false);
      setNote('');
      toast(`Refill requested from ${rx.clinicName}. You will be told here when they reply.`);
      onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!refill) return;
    setBusy(true);
    try {
      await call(`/v1/patient/refill-requests/${refill.id}/cancel`, { method: 'POST' });
      toast('Refill request withdrawn.');
      onChanged();
    } catch (failure) {
      toast(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  if (!refill && !rx.canRequestRefill) return null;
  return (
    <View className={recordCard}>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className={recordTitle}>Refill</Text>
        {refill ? <Pill label={REFILL[refill.status].label} tone={REFILL[refill.status].tone} /> : null}
      </View>
      {refill ? (
        <View className="gap-1">
          <Text className={recordMeta}>Asked {dateTime(refill.createdAt)}{refill.note ? ` · “${refill.note}”` : ''}</Text>
          {refill.status === 'requested' ? <Text className={recordMeta}>Waiting for {rx.clinicName} to reply.</Text> : null}
          {refill.status === 'approved' ? <Text className="text-[13px] leading-[19px] text-heading">Approved {refill.decidedAt ? dateTime(refill.decidedAt) : ''}. Collect it at the clinic pharmacy.</Text> : null}
          {refill.status === 'declined' ? <Text className="text-[13px] leading-[19px] text-[#93000a]">Declined {refill.decidedAt ? dateTime(refill.decidedAt) : ''}.</Text> : null}
          {refill.decisionNote ? (
            <View className="rounded-xl border border-edge bg-[#f8faf9] p-3">
              <Text className="font-pj-bd text-[12px] leading-[18px] text-heading">From the clinic</Text>
              <Text className="text-[13px] leading-[19px] text-[#566b74]">{refill.decisionNote}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text className={recordMeta}>Running low? Ask {rx.clinicName} for a refill. They will reply in the app.</Text>
      )}
      {refill?.status === 'requested' ? (
        <Button label="Withdraw Request" variant="outline" size="md" loading={busy} onPress={withdraw} />
      ) : rx.canRequestRefill ? (
        <Button label={refill ? 'Request Another Refill' : 'Request Refill'} variant="soft" size="md" className="border-teal-200 bg-teal-100" onPress={() => setAsking(true)} />
      ) : null}

      <Sheet visible={asking} onClose={() => !busy && setAsking(false)} title="Request a refill">
        <View className="gap-3 pb-4">
          <Text className="text-[13px] leading-[19px] text-slate">
            {rx.clinicName} will review the request for prescription #{rx.reference}. If they approve it, collect it at the clinic pharmacy.
          </Text>
          <TextField label="Note for the clinic" optionalLabel placeholder="For example: running out on Friday" value={note} onChangeText={setNote} maxLength={500} multiline inputClassName="min-h-[64px] text-[14px]" />
          {error ? (
            <Text accessibilityRole="alert" className="text-[13px] leading-[18px] text-[#ba1a1a]">
              {error}
            </Text>
          ) : null}
          <Button label="Send Refill Request" loading={busy} onPress={send} />
        </View>
      </Sheet>
    </View>
  );
}

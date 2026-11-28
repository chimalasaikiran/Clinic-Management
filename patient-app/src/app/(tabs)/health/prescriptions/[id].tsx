import { router } from 'expo-router';
import { View } from 'react-native';

import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { RecordDetailScreen } from '@/features/health/RecordDetailScreen';
import { RefillPanel } from '@/features/health/RefillPanel';
import { CardLink, ClinicContext, Field, PatientStrip, recordCard, recordMeta, recordTitle, Row } from '@/features/health/RecordKit';
import { dateTime } from '@/lib/dates';
import { prescriptionState, shortDate, stampText } from '@/lib/records';
import type { Prescription } from '@/types';

const body = 'text-[13px] leading-[19px] text-[#566b74]';

export default function PrescriptionDetails() {
  return (
    <RecordDetailScreen<Prescription>
      title="Prescription Details"
      path="/v1/patient/prescriptions"
      listHref="/health/prescriptions"
      subtitle={(rx) => `Prescription #${rx.reference}`}
      shareMessage={(rx) => `Prescription ${rx.reference} issued ${shortDate(rx.issued.date)} by ${rx.prescriber.name}`}>
      {(rx, reload) => {
        const state = prescriptionState(rx);
        return (
          <>
            <PatientStrip name={rx.patientName} detail={`Patient number ${rx.mrn}`} />
            <ClinicContext clinicName={rx.clinicName} branchName={rx.branch.name} />

            <View className={recordCard}>
              <View className="flex-row items-start justify-between gap-2 border-b border-edge pb-3">
                <View className="flex-1">
                  <Text className={recordTitle}>{rx.prescriber.name}</Text>
                  <Text className={recordMeta}>
                    {[rx.prescriber.department, rx.prescriber.registration && `Reg. ${rx.prescriber.registration}`].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Pill label={state.label} tone={state.tone} />
              </View>
              <Row label="Issued:" value={stampText(rx.issued)} />
              <Row label="For:" value={rx.indication} />
              <Row label="Course ends:" value={shortDate(rx.courseEnds)} />
              <Row label="Clinic pharmacy:" value={rx.dispensedAt ? `Dispensed ${dateTime(rx.dispensedAt)}` : 'Not dispensed'} />
              {rx.consultation ? (
                <CardLink label={`View Consultation #${rx.consultation.reference}`} onPress={() => router.push(`/health/consultations/${rx.consultation!.id}`)} />
              ) : null}
            </View>

            <Text className={`${recordTitle} px-1`}>Prescribed Medicines ({rx.items.length})</Text>
            {rx.items.map((medicine) => (
              <View key={`${medicine.name}-${medicine.strength}`} className={recordCard}>
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <Text className="font-pj-bd text-[18px] leading-6 text-heading">
                    {medicine.name} {medicine.strength}
                  </Text>
                  <Pill label={medicine.frequency} />
                </View>
                <Text className={recordMeta}>
                  {medicine.form} · {medicine.route}
                </Text>
                <View className="flex-row gap-2">
                  <Field label="DOSE & COURSE" value={medicine.dose} note={`${medicine.durationDays} days · ${medicine.quantity} in total`} className="rounded-xl border border-edge p-3" />
                  <Field label="WHEN TO TAKE" value={medicine.food} note={medicine.route} className="rounded-xl border border-edge p-3" />
                </View>
                {medicine.instructions ? (
                  <View className="gap-1 rounded-xl border border-teal-200 bg-teal-50 p-3">
                    <Text className="font-pj-bd text-[12px] leading-[18px] text-teal">Doctor’s instructions</Text>
                    <Text className={body}>{medicine.instructions}</Text>
                  </View>
                ) : null}
                {medicine.refills ? <Text className="text-[11px] leading-4 text-[#566b74]">Refills allowed: {medicine.refills}</Text> : null}
              </View>
            ))}

            {state.key === 'discontinued' ? (
              <View className="rounded-[20px] bg-[#ffdad6]/40 p-4">
                <Text className="text-[13px] leading-[19px] text-[#93000a]">
                  Your clinic has stopped this prescription. Do not continue these medicines unless your doctor tells you to.
                </Text>
              </View>
            ) : null}

            <RefillPanel rx={rx} onChanged={reload} />

            <View className={recordCard}>
              <Text className={body}>
                This prescription is signed by your doctor and cannot be changed in the app. For changes, contact {rx.clinicName}. Home delivery and downloading a copy are not available in the app yet.
              </Text>
            </View>
          </>
        );
      }}
    </RecordDetailScreen>
  );
}

import { router } from 'expo-router';
import { View } from 'react-native';

import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { RecordDetailScreen } from '@/features/health/RecordDetailScreen';
import { CardLink, ClinicContext, Field, PatientStrip, recordCard, recordKicker, recordMeta, recordTitle, Row } from '@/features/health/RecordKit';
import { dateTime } from '@/lib/dates';
import { clinicianLine, ORDER_STATUS, shortDate, stampText } from '@/lib/records';
import { clock } from '@/lib/visit';
import type { ConsultationDetail } from '@/types';

const inset = 'gap-1 rounded-xl border border-edge bg-[#f8faf9] p-3';
const insetTitle = 'font-pj-bd text-[12px] leading-[18px] text-heading';
const body = 'text-[13px] leading-[19px] text-[#566b74]';

function Vitals({ vitals }: { vitals: NonNullable<ConsultationDetail['vitals']> }) {
  const tiles = [
    { label: 'Blood Pressure', value: `${vitals.systolic}/${vitals.diastolic}`, unit: 'mmHg' },
    { label: 'Pulse Rate', value: String(vitals.pulse), unit: 'bpm' },
    { label: 'Temperature', value: vitals.temperatureF.toFixed(1), unit: '°F' },
    { label: 'SpO2 Oxygen', value: `${vitals.spo2}%`, unit: 'Oxygen saturation' },
    { label: 'Weight', value: String(vitals.weightKg), unit: 'kg' },
    { label: 'Height', value: String(vitals.heightCm), unit: 'cm' },
  ];
  return (
    <View className={recordCard}>
      <View className="flex-row items-center justify-between">
        <Text className={recordTitle}>Vitals</Text>
        <Text className={recordMeta}>{dateTime(vitals.recordedAt)}</Text>
      </View>
      <View className="flex-row flex-wrap justify-between gap-y-2">
        {tiles.map((vital) => (
          <View key={vital.label} className="w-[48.5%] rounded-xl border border-edge p-3">
            <Text className="text-[11px] leading-4 text-[#566b74]">{vital.label}</Text>
            <Text className="font-pj-bd text-[20px] leading-7 text-heading">{vital.value}</Text>
            <Text className="text-[11px] leading-4 text-teal">{vital.unit}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ConsultationDetails() {
  return (
    <RecordDetailScreen<ConsultationDetail>
      title="Consultation Details"
      path="/v1/patient/consultations"
      listHref="/health/consultations"
      subtitle={(note) => `Encounter #${note.reference} · ${shortDate(note.started.date)}`}
      shareMessage={(note) => `Consultation ${note.reference}, ${shortDate(note.started.date)}, ${note.clinicName}`}>
      {(note) => (
        <>
          <PatientStrip name={note.patientName} detail={`Patient number ${note.mrn}`} badge="Signed" />
          <ClinicContext clinicName={note.clinicName} branchName={note.branch.name} />

          <View className={recordCard}>
            <View className="flex-row gap-3">
              <Field label="DATE & TIME" value={shortDate(note.started.date)} note={clock(note.started.time)} />
              <Field label="CONSULTATION TYPE" value={note.type} />
            </View>
            <View className="border-t border-edge pt-3">
              <Text className={recordKicker}>CLINICIAN</Text>
              <Text className={recordTitle}>{clinicianLine(note.practitioner, note.signedBy)}</Text>
              {note.practitioner ? <Text className={recordMeta}>{note.practitioner.specialty} · {note.practitioner.department}</Text> : null}
            </View>
          </View>

          {note.notes.map((entry) => (
            <View key={entry.signed.at} className={recordCard}>
              <Text className={recordTitle}>Consultation Note</Text>
              {entry.sections.map((section) => (
                <View key={section.heading} className={inset}>
                  <Text className={insetTitle}>{section.heading}</Text>
                  <Text className={body}>{section.body}</Text>
                </View>
              ))}
              {entry.addenda.map((addendum) => (
                <View key={addendum.at} className="gap-1 rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3">
                  <Text className={insetTitle}>Addendum · {dateTime(addendum.at)}</Text>
                  <Text className={body}>{addendum.text}</Text>
                </View>
              ))}
            </View>
          ))}

          {note.vitals ? <Vitals vitals={note.vitals} /> : null}

          {note.diagnoses.length ? (
            <View className={recordCard}>
              <Text className={recordTitle}>Diagnosis</Text>
              {note.diagnoses.map((item) => (
                <View key={`${item.icd}-${item.name}`} className={inset}>
                  <View className="flex-row flex-wrap gap-1.5">
                    <Pill label={item.designation} tone={item.designation === 'Primary' ? 'dark' : 'plain'} />
                    {item.verification !== 'Confirmed' ? <Pill label={item.verification} tone="amber" /> : null}
                  </View>
                  <Text className="font-pj-bd text-[14px] leading-5 text-heading">{item.name}</Text>
                  <Text className={body}>ICD-10 {item.icd}{item.severity ? ` · ${item.severity}` : ''}</Text>
                  {item.description ? <Text className={body}>{item.description}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          {note.linkedPrescriptions.length || note.linkedOrders.length ? (
            <View className={recordCard}>
              <Text className={recordKicker}>RELATED RECORDS FROM THIS VISIT</Text>
              {note.linkedPrescriptions.map((rx) => (
                <CardLink
                  key={rx.id}
                  label={`Prescription #${rx.reference} · ${rx.items.map((item) => `${item.name} ${item.strength}`).join(', ')}`}
                  onPress={() => router.push(`/health/prescriptions/${rx.id}`)}
                />
              ))}
              {note.linkedOrders.map((order) => (
                <CardLink
                  key={order.id}
                  label={`Test #${order.reference} · ${order.title} · ${ORDER_STATUS[order.status].label}`}
                  onPress={() => router.push(`/health/orders/${order.id}`)}
                />
              ))}
            </View>
          ) : null}

          <View className={recordCard}>
            {note.signed ? <Row label="Signed:" value={stampText(note.signed)} /> : null}
            <Row label="Signed by:" value={clinicianLine(note.practitioner, note.signedBy)} />
            <Text className="border-t border-edge pt-2 text-[11px] leading-4 text-muted">
              Signed notes cannot be edited. To ask for a correction, contact {note.clinicName}. Downloading a copy is not available in the app yet.
            </Text>
          </View>
        </>
      )}
    </RecordDetailScreen>
  );
}

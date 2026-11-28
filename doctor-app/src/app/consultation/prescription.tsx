import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Card, CardTitle, Kicker, Options, Panel, Tag } from '@/components/ui/Kit';
import { SearchField } from '@/components/ui/SearchField';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { quantityOf, RxItemCard } from '@/features/consultation/RxItemCard';
import { Stepper } from '@/features/consultation/Stepper';
import { WorkflowScreen } from '@/features/consultation/WorkflowScreen';
import { DURATIONS, FOOD_RELATIONS, FREQUENCIES, MEDICINES, ROUTES_OF_ADMIN, useActiveEncounter } from '@/features/doctor/clinical';
import { dayLabel } from '@/features/reception/desk';
import { useConsultation } from '@/state/ConsultationState';

type Medicine = (typeof MEDICINES)[number];

export default function NewPrescription() {
  const toast = useToast();
  const { rx, addRx, removeRx } = useConsultation();
  const { chart, diagnoses, prescriptions, sealed } = useActiveEncounter();
  const [query, setQuery] = useState('');
  const [drug, setDrug] = useState<Medicine | null>(null);
  const [strength, setStrength] = useState('');
  const [route, setRoute] = useState('Oral');
  const [frequency, setFrequency] = useState(FREQUENCIES[0]!.id);
  const [food, setFood] = useState('After food');
  const [days, setDays] = useState(30);
  const [dose, setDose] = useState(1);
  const [instruction, setInstruction] = useState('');
  const [indication, setIndication] = useState('');

  const allergies = (chart.data?.allergies ?? []).filter((allergy) => allergy.active);
  const conflictOf = (medicine: Medicine) => allergies.find((allergy) => allergy.drugClass && allergy.drugClass === medicine.drugClass);
  const ongoing = (chart.data?.prescriptions ?? []).filter((item) => item.status === 'active' && !prescriptions.includes(item));
  const needle = query.trim().toLowerCase();
  const matches = MEDICINES.filter((item) => !needle || `${item.name} ${item.drugClass}`.toLowerCase().includes(needle));
  const primary = diagnoses.find((item) => item.status === 'active' && item.designation === 'Primary');
  const chosen = FREQUENCIES.find((item) => item.id === frequency)!;
  const quantity = quantityOf({ dose, frequencyPerDay: chosen.perDay, durationDays: days });

  const configure = (medicine: Medicine) => {
    const conflict = conflictOf(medicine);
    if (conflict) {
      toast(`${medicine.name} conflicts with the documented ${conflict.substance} allergy.`);
      return;
    }
    setDrug(medicine);
    setStrength(medicine.strengths[0]!);
    setIndication(primary?.name ?? '');
    setInstruction('');
    setQuery('');
  };

  const addToPlan = () => {
    if (!drug) return;
    if (!indication.trim()) {
      toast('Give the indication for this medicine.');
      return;
    }
    addRx({
      medicineCode: drug.id,
      name: drug.name,
      strength,
      form: drug.form,
      route,
      drugClass: drug.drugClass,
      dose,
      frequency: chosen.label,
      frequencyPerDay: chosen.perDay,
      food,
      durationDays: days,
      instructions: instruction.trim(),
      indication: indication.trim(),
    });
    toast(`${drug.name} added to the prescription.`);
    setDrug(null);
  };

  const review = () => {
    if (rx.length === 0) {
      toast('Add at least one medicine before reviewing.');
      return;
    }
    router.push('/consultation/prescription-review');
  };

  return (
    <WorkflowScreen
      title="New Prescription"
      subtitle={rx.length ? `${rx.length} in the draft` : 'Compose, then review and authorize'}
      badge={{ label: prescriptions.length ? `${prescriptions.length} SIGNED` : 'DRAFT', tone: 'sky' }}
      status="The draft stays on this phone until you authorize it"
      secondary={prescriptions.length && !rx.length ? { label: 'Skip', onPress: () => router.push('/consultation/orders') } : undefined}
      primary={{ label: 'Review Prescription', onPress: review, disabled: sealed }}
      footnote="Checked against recorded allergies here and again by the server when you authorize.">
      {allergies.length ? (
        <View className="rounded-xl bg-[#ffdad6] p-3">
          <Text className="font-pj-bd text-[11px] leading-4 text-[#93000a]">DOCUMENTED ALLERGIES</Text>
          {allergies.map((allergy) => (
            <Text key={allergy.id} className="text-[12px] leading-[18px] text-[#93000a]">
              {allergy.substance}
              {allergy.classLabel ? ` (${allergy.classLabel})` : ''} · {allergy.severity} · {allergy.reaction}
            </Text>
          ))}
        </View>
      ) : (
        <View className="rounded-xl bg-sky-100 p-3">
          <Text className="text-[12px] leading-[18px] text-slate">No allergies are recorded for this patient.</Text>
        </View>
      )}
      {ongoing.length ? (
        <View className="rounded-xl bg-sky-100 p-3">
          <Text className="font-pj-bd text-[12px] leading-[18px] text-ink">Already taking</Text>
          {ongoing.map((item) => (
            <Text key={item.id} className="text-[11px] leading-4 text-slate">
              {item.items.map((entry) => `${entry.name} ${entry.strength}`).join(' + ')} · {item.reference} · {dayLabel(item.created.date)}
            </Text>
          ))}
        </View>
      ) : null}
      {prescriptions.length ? (
        <Card className="py-3">
          <Text className="font-pj-sb text-[12px] leading-[18px] text-ink">Signed this visit</Text>
          {prescriptions.map((item) => (
            <Text key={item.id} className="text-[11px] leading-4 text-slate">
              {item.reference}: {item.items.map((entry) => `${entry.name} ${entry.strength}`).join(', ')}
            </Text>
          ))}
        </Card>
      ) : null}

      {!sealed ? (
        <>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search the formulary (e.g. Atorva, Pantoprazole)..." />
          <View className="flex-row flex-wrap gap-1.5">
            {matches.map((item) => {
              const conflict = conflictOf(item);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={conflict ? `${item.name}, blocked by ${conflict.substance} allergy` : `Configure ${item.name}`}
                  onPress={() => configure(item)}
                  className={`rounded-xl border px-3 py-2 ${conflict ? 'border-[#ffdad6] bg-[#ffdad6]/40' : 'border-edge bg-white'}`}>
                  <Text className={`font-pj-sb text-[12px] leading-4 ${conflict ? 'text-[#93000a] line-through' : 'text-ink'}`}>+ {item.name}</Text>
                </Pressable>
              );
            })}
          </View>
          {needle && matches.length === 0 ? <Text className="text-[12px] leading-[18px] text-slate">Not in the clinic formulary.</Text> : null}
        </>
      ) : null}

      {drug && !sealed ? (
        <Card className="border-ink">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Kicker>CONFIGURING ITEM #{rx.length + 1}</Kicker>
              <Text className="font-pj-bd text-[15px] leading-5 text-ink">{drug.name}</Text>
              <Text className="text-[11px] leading-4 text-slate">
                {drug.form} · {drug.drugClass}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Discard this medicine" hitSlop={10} onPress={() => setDrug(null)}>
              <Text className="text-[16px] leading-5 text-slate">✕</Text>
            </Pressable>
          </View>
          <Text className="font-pj-bd text-[12px] leading-4 text-ink">Strength</Text>
          <Options options={drug.strengths.map((value) => ({ value, label: value }))} value={strength} onChange={setStrength} />
          <Text className="font-pj-bd text-[12px] leading-4 text-ink">Route of Administration</Text>
          <Options options={ROUTES_OF_ADMIN.map((value) => ({ value, label: value }))} value={route} onChange={setRoute} />
          <Text className="font-pj-bd text-[12px] leading-4 text-ink">Frequency</Text>
          <Options options={FREQUENCIES.map((item) => ({ value: item.id, label: item.label }))} value={frequency} onChange={setFrequency} />
          <Text className="font-pj-bd text-[12px] leading-4 text-ink">With Food</Text>
          <Options options={FOOD_RELATIONS.map((value) => ({ value, label: value }))} value={food} onChange={setFood} />
          <Text className="font-pj-bd text-[12px] leading-4 text-ink">Duration</Text>
          <Options options={DURATIONS.map((value) => ({ value: String(value), label: `${value} days` }))} value={String(days)} onChange={(value) => setDays(Number(value))} />
          <View className="flex-row gap-2">
            <Stepper label="Dose" value={dose} unit={drug.form === 'Capsule' ? 'Cap' : 'Tab'} step={1} min={1} max={20} onChange={setDose} />
            <Panel className="flex-1 border-sky-150 bg-sky-100">
              <Kicker>Total Quantity</Kicker>
              <Text className="font-pj-xb text-[18px] leading-8 text-ink">{quantity}</Text>
            </Panel>
          </View>
          <TextField label="Indication" value={indication} onChangeText={setIndication} maxLength={500} boxClassName="border-sky-150 bg-sky-100" />
          <TextField
            accessibilityLabel="Instructions for this medicine"
            placeholder="Instructions for the patient (optional)"
            boxClassName="border-sky-150 bg-sky-150"
            value={instruction}
            onChangeText={setInstruction}
            multiline
            maxLength={1000}
            inputClassName="min-h-[56px] text-[12px]"
          />
          <Pressable accessibilityRole="button" onPress={addToPlan} className="items-center rounded-xl bg-black py-3 active:opacity-80">
            <Text className="font-pj-bd text-[13px] leading-4 text-white">Add to Prescription</Text>
          </Pressable>
        </Card>
      ) : null}

      <CardTitle title="Draft Items" right={<Tag label={`${rx.length} Added`} />} />
      {rx.length === 0 ? (
        <Text className="rounded-xl bg-white p-4 text-center text-[12px] leading-[18px] text-slate">No medicines yet. Pick one from the formulary above.</Text>
      ) : null}
      {rx.map((item, index) => (
        <RxItemCard key={item.medicineCode} index={index + 1} item={item} onRemove={sealed ? undefined : () => removeRx(item.medicineCode)} />
      ))}
    </WorkflowScreen>
  );
}

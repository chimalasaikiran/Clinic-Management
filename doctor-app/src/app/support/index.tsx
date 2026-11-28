import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Glyph } from '@/components/staff/ui';
import { Text } from '@/components/ui/Text';
import { faqs } from '@/data/support';
import { PageHeader } from '@/features/common/PageHeader';
import { useSignedIn } from '@/state/SessionState';
import colors from '@/theme/colors';

const card = 'rounded-2xl border border-[#cfc4c5]/40 bg-white p-4';

export default function HelpAndSupport() {
  const clinic = useSignedIn()?.membership?.organisation.name;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(faqs[0]!.question);
  const term = query.trim().toLowerCase();
  const answers = faqs.filter((faq) => !term || `${faq.question} ${faq.answer}`.toLowerCase().includes(term));

  return (
    <Screen className="bg-sky-50" header={<PageHeader title="Help & Support" subtitle="Answers about the staff app." />} contentClassName="gap-4 px-5 pt-3 pb-8">
      <View className="flex-row gap-3 rounded-2xl border border-[#ffdad6] bg-[#ffdad6]/40 p-4">
        <View className="size-9 items-center justify-center rounded-full bg-danger">
          <Glyph name="emergency" size={18} color="#ffffff" />
        </View>
        <View className="flex-1 gap-1">
          <Text className="font-pj-sb text-[18px] leading-6 text-[#93000a]">Not for Medical Emergencies</Text>
          <Text className="text-[13px] leading-[19px] text-[#4c4546]">
            For a patient emergency, follow your ward emergency protocol and call <Text className="font-pj-sb text-[13px] text-danger">112 / 108</Text>. This app cannot give clinical help or send an emergency team.
          </Text>
        </View>
      </View>
      <View className="min-h-[52px] flex-row items-center gap-2.5 rounded-2xl border border-[#cfc4c5]/40 bg-white px-4">
        <Glyph name="search" size={18} color={colors.slate} />
        <TextInput accessibilityLabel="Search help" value={query} onChangeText={setQuery} placeholder="Search the answers" placeholderTextColor={colors.muted} autoCorrect={false} className="flex-1 py-3 font-pj text-[14px] text-ink" />
      </View>
      <Text className="font-pj-sb text-[18px] leading-6 text-ink">Common Questions</Text>
      {answers.length === 0 ? <Text className="text-[13px] leading-[18px] text-slate">No answer matches that search.</Text> : null}
      {answers.map((faq) => {
        const expanded = open === faq.question;
        return (
          <Pressable key={faq.question} accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setOpen(expanded ? null : faq.question)} className={card}>
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 font-pj-sb text-[14px] leading-5 text-ink">{faq.question}</Text>
              <Glyph name={expanded ? 'expand-less' : 'expand-more'} size={18} />
            </View>
            {expanded ? <Text className="pt-2 text-[13px] leading-[19px] text-slate">{faq.answer}</Text> : null}
          </Pressable>
        );
      })}
      <View className={`${card} gap-1`}>
        <Text className="font-pj-sb text-[14px] leading-5 text-ink">Still stuck?</Text>
        <Text className="text-[13px] leading-[19px] text-slate">
          Contact {clinic ? `your administrator at ${clinic}` : 'your clinic administrator'}. Sending support requests from the app is not available yet.
        </Text>
      </View>
    </Screen>
  );
}

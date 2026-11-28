import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { SearchField } from '@/components/ui/SearchField';
import { EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { faqs, issueCategories, popularSearches } from '@/data/support';
import { EmergencyNotice } from '@/features/profile/EmergencyNotice';
import { useList, useResource } from '@/hooks/useResource';
import type { ClinicLink, SupportTicket } from '@/types';

const card = 'gap-2.5 rounded-2xl border border-line/40 bg-white p-3.5';
const sectionTitle = 'font-pj-bd text-[16px] leading-6 text-ink';

export default function HelpAndSupport() {
  const [query, setQuery] = useState('');
  const [openQuestion, setOpenQuestion] = useState<string | null>(faqs[0].question);
  const links = useResource<ClinicLink[]>('/v1/patient/links', ['app_access']);
  const tickets = useList<SupportTicket>('/v1/patient/support-tickets?pageSize=50', ['requests', 'app_access']);
  const waiting = (tickets.data?.data ?? []).filter((ticket) => ticket.status === 'answered').length;
  const needle = query.trim().toLowerCase();
  const answers = faqs.filter((faq) => `${faq.question} ${faq.answer} ${faq.topics}`.toLowerCase().includes(needle));
  const ask = (category?: string) => router.push({ pathname: '/profile/help/request', params: category ? { category } : {} });

  return (
    <Screen inTabs className="bg-sky-50" header={<AppHeader title="Help & Support" subtitle="Answers and help from your clinic" />} contentClassName="gap-4 pt-4 pb-6">
      <Text className="text-[14px] leading-5 text-slate">Find an answer below, or send a request to one of your clinics.</Text>
      <EmergencyNotice />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search help topics..." />
      <View className="flex-row flex-wrap items-center gap-1.5">
        <Text className="text-[11px] leading-4 text-slate">Popular:</Text>
        {popularSearches.map((term) => (
          <Pressable key={term} accessibilityRole="button" onPress={() => setQuery(term)}>
            <Pill label={term} tone="plain" />
          </Pressable>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push('/profile/help/requests')} className={`${card} flex-row items-center`}>
        <View className="size-9 items-center justify-center rounded-xl bg-teal-100">
          <Icon name="help-circle" color="#006a61" />
        </View>
        <View className="flex-1">
          <Text className="font-pj-bd text-[14px] leading-5 text-ink">Your Help Requests</Text>
          <Text className="text-[12px] leading-[18px] text-slate">
            {tickets.data ? `${tickets.data.meta.total ?? tickets.data.data.length} sent${waiting ? ` · ${waiting} with a new reply` : ''}` : 'See replies from your clinics'}
          </Text>
        </View>
        {waiting ? <Pill label={`${waiting} new`} tone="dark" /> : null}
        <Icon name="chevron-right-slate" />
      </Pressable>

      {needle ? null : (
        <>
          <Text className={sectionTitle}>Ask About</Text>
          <View className="flex-row flex-wrap justify-between gap-y-2.5">
            {issueCategories.map((item) => (
              <Pressable key={item.value} accessibilityRole="button" onPress={() => ask(item.value)} className="w-[48.5%] gap-1.5 rounded-xl border border-line/40 bg-white p-3">
                <View className="size-8 items-center justify-center rounded-lg bg-sky-100">
                  <Icon name={item.icon} size={14} color="#081e26" />
                </View>
                <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">{item.value}</Text>
                <Text className="text-[11px] leading-4 text-slate">{item.caption}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text className={sectionTitle}>Frequently Asked Questions</Text>
      {answers.length === 0 ? (
        <EmptyState title="No answers found" message="Try different words, or send a request to your clinic." actionLabel="Clear search" onAction={() => setQuery('')} />
      ) : null}
      {answers.map((faq) => {
        const expanded = openQuestion === faq.question;
        return (
          <View key={faq.question} className={card}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setOpenQuestion(expanded ? null : faq.question)} className="flex-row items-center gap-2">
              <Text className="flex-1 font-pj-sb text-[13px] leading-[18px] text-ink">{faq.question}</Text>
              <View className={expanded ? '-rotate-180' : undefined}>
                <Icon name="chevron-down" />
              </View>
            </Pressable>
            {expanded ? <Text className="text-[12px] leading-[19px] text-slate">{faq.answer}</Text> : null}
          </View>
        );
      })}

      <View>
        <Text className={sectionTitle}>Your Clinics</Text>
        <Text className="text-[12px] leading-[18px] text-slate">For appointments, prescriptions, records and questions about the app</Text>
      </View>
      {(links.data ?? []).length === 0 ? (
        <View className={card}>
          <Text className="text-[13px] leading-[19px] text-slate">
            {links.data ? 'No clinic is connected yet. Book a visit or enter a connection code from your clinic, then you can send it requests here.' : 'Loading your clinics…'}
          </Text>
        </View>
      ) : (
        links.data!.map((link) => (
          <View key={link.id} className={card}>
            <Text className="font-pj-bd text-[14px] leading-5 text-ink">{link.clinicName}</Text>
            <Text className="text-[12px] leading-[18px] text-slate">
              {link.homeBranch.name} · {link.patientName} ({link.mrn})
            </Text>
            <Button label="Send a Request" variant="soft" size="sm" onPress={() => router.push({ pathname: '/profile/help/request', params: { link: link.id } })} />
          </View>
        ))
      )}
      <Text className="rounded-xl bg-sky-150 p-3 text-[12px] leading-[18px] text-slate">
        Clinic staff will never ask for your sign-in code. Do not share it with anyone.
      </Text>
    </Screen>
  );
}

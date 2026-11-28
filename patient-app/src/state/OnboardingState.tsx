import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export const languages = [
  { code: 'en', badge: 'EN', name: 'English', greeting: 'Default · International' },
  { code: 'hi', badge: 'हि', name: 'हिन्दी', greeting: 'Namaste · हिंदी' },
  { code: 'ta', badge: 'த', name: 'தமிழ்', greeting: 'Vanakkam · தமிழ்' },
  { code: 'te', badge: 'తె', name: 'తెలుగు', greeting: 'Namaskaram · తెలుగు' },
  { code: 'kn', badge: 'ಕ', name: 'ಕನ್ನಡ', greeting: 'Namaskara · ಕನ್ನಡ' },
  { code: 'bn', badge: 'বা', name: 'বাংলা', greeting: 'Nomoshkar · বাংলা' },
  { code: 'mr', badge: 'म', name: 'मराठी', greeting: 'Namaskar · मराठी' },
] as const;

export type LanguageCode = (typeof languages)[number]['code'];
export type AuthMode = 'signup' | 'signin';

type Onboarding = {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  /** Ten digits, without the country code. */
  phone: string;
  setPhone: (phone: string) => void;
  /** Proof that a new number was verified; creating the account needs it. */
  registrationToken: string | null;
  setRegistrationToken: (token: string | null) => void;
};

const OnboardingContext = createContext<Onboarding | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [mode, setMode] = useState<AuthMode>('signup');
  const [phone, setPhone] = useState('');
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  const value = useMemo(
    () => ({ language, setLanguage, mode, setMode, phone, setPhone, registrationToken, setRegistrationToken }),
    [language, mode, phone, registrationToken],
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): Onboarding {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return context;
}

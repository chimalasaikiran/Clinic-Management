import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { addDays } from '@/lib/dates';
import { clinicToday } from '@/lib/visit';

type Choices = {
  /** The clinic being booked; null until one is chosen. */
  branchId: string | null;
  serviceId: string | null;
  date: string;
  /** "HH:mm" in the clinic's time zone. */
  time: string | null;
};

type Booking = Choices & {
  start: (branchId: string, serviceId?: string) => void;
  setServiceId: (id: string) => void;
  setDate: (date: string) => void;
  setTime: (time: string | null) => void;
};

const BookingContext = createContext<Booking | null>(null);

const fresh = (): Choices => ({ branchId: null, serviceId: null, date: addDays(clinicToday(), 1), time: null });

/** Holds the choices made across the three booking steps. */
export function BookingProvider({ children }: { children: ReactNode }) {
  const [choices, setChoices] = useState<Choices>(fresh);

  const start = useCallback((branchId: string, serviceId?: string) => setChoices({ ...fresh(), branchId, serviceId: serviceId ?? null }), []);
  const setServiceId = useCallback((serviceId: string) => setChoices((current) => ({ ...current, serviceId, time: null })), []);
  const setDate = useCallback((date: string) => setChoices((current) => ({ ...current, date, time: null })), []);
  const setTime = useCallback((time: string | null) => setChoices((current) => ({ ...current, time })), []);

  const value = useMemo(() => ({ ...choices, start, setServiceId, setDate, setTime }), [choices, start, setServiceId, setDate, setTime]);
  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking(): Booking {
  const context = useContext(BookingContext);
  if (!context) throw new Error('useBooking must be used inside BookingProvider');
  return context;
}

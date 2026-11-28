import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/** One medicine on a prescription the doctor is still composing. */
export type RxDraft = {
  medicineCode: string;
  name: string;
  strength: string;
  form: string;
  route: string;
  drugClass: string | null;
  dose: number;
  frequency: string;
  frequencyPerDay: number;
  food: string;
  durationDays: number;
  instructions: string;
  indication: string;
};

/** One investigation the doctor has picked but not yet ordered. */
export type OrderDraft = {
  code: string;
  name: string;
  category: 'Laboratory' | 'Imaging' | 'Special Diagnostics';
  loinc: string | null;
  destination: string;
  priority: string;
};

type Consultation = {
  /** The encounter open on this phone. Its notes, vitals and orders live on the server. */
  encounterId: string | null;
  open: (encounterId: string) => void;
  /**
   * A prescription and an order set being composed. They stay on this phone until the doctor authorizes them on the
   * review screens, which is when the server records and signs them.
   */
  rx: RxDraft[];
  addRx: (item: RxDraft) => void;
  removeRx: (medicineCode: string) => void;
  clearRx: () => void;
  orders: OrderDraft[];
  addOrder: (order: OrderDraft) => void;
  removeOrder: (code: string) => void;
  clearOrders: () => void;
  reset: () => void;
};

const ConsultationContext = createContext<Consultation | null>(null);

export function ConsultationProvider({ children }: { children: ReactNode }) {
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [rx, setRx] = useState<RxDraft[]>([]);
  const [orders, setOrders] = useState<OrderDraft[]>([]);

  // Drafts belong to one encounter; opening another starts clean.
  const open = useCallback((id: string) => {
    setEncounterId((current) => {
      if (current !== id) {
        setRx([]);
        setOrders([]);
      }
      return id;
    });
  }, []);

  const value = useMemo<Consultation>(
    () => ({
      encounterId,
      open,
      rx,
      addRx: (item) => setRx((list) => [...list.filter((entry) => entry.medicineCode !== item.medicineCode), item]),
      removeRx: (code) => setRx((list) => list.filter((entry) => entry.medicineCode !== code)),
      clearRx: () => setRx([]),
      orders,
      addOrder: (order) => setOrders((list) => [...list.filter((entry) => entry.code !== order.code), order]),
      removeOrder: (code) => setOrders((list) => list.filter((entry) => entry.code !== code)),
      clearOrders: () => setOrders([]),
      reset: () => {
        setEncounterId(null);
        setRx([]);
        setOrders([]);
      },
    }),
    [encounterId, open, rx, orders],
  );

  return <ConsultationContext.Provider value={value}>{children}</ConsultationContext.Provider>;
}

export function useConsultation(): Consultation {
  const context = useContext(ConsultationContext);
  if (!context) throw new Error('useConsultation must be used inside ConsultationProvider');
  return context;
}

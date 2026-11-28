import type { PillTone } from '@/components/ui/Pill';
import type { TicketStatus } from '@/types';

export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: PillTone }> = {
  open: { label: 'Waiting for the clinic', tone: 'amber' },
  answered: { label: 'Clinic replied', tone: 'mint' },
  resolved: { label: 'Resolved', tone: 'sky' },
};

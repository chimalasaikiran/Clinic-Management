import { clock, dayLabel } from '@/features/reception/desk';
import { useList } from '@/hooks/useResource';

export type Notice = { id: string; kind: string; title: string; body: string; entityType: string | null; entityId: string | null; patientId: string | null; readAt: string | null; createdAt: string };

/** The signed-in member's notifications, newest first, with the unread count. */
export function useNotices(pageSize = 30) {
  const list = useList<Notice>(`/v1/notifications?pageSize=${pageSize}`, ['notifications']);
  return { ...list, items: list.data?.data ?? [], unread: Number(list.data?.meta.unread ?? 0) };
}

/** A notice's day and time on this phone. */
export function noticeWhen(iso: string) {
  const date = new Date(iso);
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `${dayLabel(day)}, ${clock(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`)}`;
}

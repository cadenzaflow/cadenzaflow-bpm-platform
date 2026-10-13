import { ToastNotification } from '@carbon/react';
import { create } from 'zustand';

export interface Notification {
  id: number;
  kind: 'success' | 'error' | 'info' | 'warning';
  title: string;
  subtitle?: string;
}

interface NotificationState {
  notifications: Notification[];
  notify: (notification: Omit<Notification, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

/** Short messages after an action, e.g. "The task is completed." */
export const useNotifications = create<NotificationState>((set) => ({
  notifications: [],
  notify: (notification) => set((state) => ({ notifications: [...state.notifications, { ...notification, id: nextId++ }] })),
  dismiss: (id) => set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
}));

export const notify = (notification: Omit<Notification, 'id'>) => useNotifications.getState().notify(notification);

/** Success messages close by themselves, errors stay until closed. */
export function Notifications() {
  const { notifications, dismiss } = useNotifications();
  return (
    <div className="cz-notifications" aria-live="polite">
      {notifications.map((notification) => (
        <ToastNotification
          key={notification.id}
          kind={notification.kind}
          lowContrast
          title={notification.title}
          subtitle={notification.subtitle}
          timeout={notification.kind === 'success' ? 5000 : 0}
          onClose={() => {
            dismiss(notification.id);
            return false;
          }}
        />
      ))}
    </div>
  );
}

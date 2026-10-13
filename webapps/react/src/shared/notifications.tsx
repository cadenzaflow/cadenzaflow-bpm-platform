import { ActionableNotification, Button, ToastNotification } from '@carbon/react';
import { create } from 'zustand';

export interface Notification {
  id: number;
  kind: 'success' | 'error' | 'info' | 'warning';
  title: string;
  subtitle?: string;
  /** Buttons in the message, e.g. links to tasks. */
  actions?: { label: string; onClick: () => void }[];
  /** Milliseconds until the message closes; 0 keeps it open. Default: 5 s for success, else 0. */
  timeout?: number;
}

interface NotificationState {
  notifications: Notification[];
  notify: (notification: Omit<Notification, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

/** Short messages after an action, e.g. "The task is completed." */
export const useNotifications = create<NotificationState>((set, get) => ({
  notifications: [],
  notify: (notification) => {
    const id = nextId++;
    set((state) => ({ notifications: [...state.notifications, { ...notification, id }] }));
    const timeout = notification.timeout ?? (notification.kind === 'success' ? 5000 : 0);
    if (timeout > 0) {
      setTimeout(() => get().dismiss(id), timeout);
    }
  },
  dismiss: (id) => set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
}));

export const notify = (notification: Omit<Notification, 'id'>) => useNotifications.getState().notify(notification);

/** Success messages close by themselves, errors stay until closed (unless a timeout is given). */
export function Notifications() {
  const { notifications, dismiss } = useNotifications();
  return (
    <div className="cz-notifications" aria-live="polite">
      {notifications.map((notification) => {
        const close = () => {
          dismiss(notification.id);
          return false;
        };
        // a toast may not contain buttons; a message with actions is an actionable one,
        // as a status (an alert dialog would take the focus and keep it)
        return notification.actions ? (
          <ActionableNotification
            key={notification.id}
            kind={notification.kind}
            lowContrast
            role="status"
            closeOnEscape={false}
            title={notification.title}
            subtitle={notification.subtitle}
            onClose={close}
          >
            <div className="cz-notification__actions">
              {notification.actions.map((action) => (
                <Button key={action.label} kind="ghost" size="sm" onClick={action.onClick}>
                  {action.label}
                </Button>
              ))}
            </div>
          </ActionableNotification>
        ) : (
          <ToastNotification
            key={notification.id}
            kind={notification.kind}
            lowContrast
            title={notification.title}
            subtitle={notification.subtitle}
            onClose={close}
          />
        );
      })}
    </div>
  );
}

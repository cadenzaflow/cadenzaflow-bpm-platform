import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@carbon/react';
import { Checkmark, Copy } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';

/** Puts the text on the clipboard; without the clipboard API (a page not served over HTTPS) through a selection. */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  try {
    document.execCommand('copy');
  } finally {
    field.remove();
  }
}

interface CopyValueProps {
  /** what is copied */
  text: string;
  /** what is shown; the text itself when left out */
  children?: ReactNode;
}

/**
 * A value with a button that copies it, like the clipboard widget of the
 * AngularJS webapps: the button shows when the value is pointed at or has
 * the focus.
 */
export function CopyValue({ text, children }: CopyValueProps) {
  const { t } = useTranslation('common');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <span className="cz-copy">
      {children ?? text}
      <Button
        kind="ghost"
        size="sm"
        hasIconOnly
        className="cz-copy__button"
        renderIcon={copied ? Checkmark : Copy}
        iconDescription={copied ? t('COPIED') : t('CAM_WIDGET_COPY', { value: text })}
        onClick={() => copyText(text).then(() => setCopied(true), () => setCopied(false))}
      />
    </span>
  );
}

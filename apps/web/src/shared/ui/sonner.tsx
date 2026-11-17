import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react';
import type * as React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useTheme } from '@/shared/lib/theme';

// Тема — выбранная в настройках, а не системная: у sonner своя палитра, и он её не угадает.
const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useTheme();
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--surface-3)',
          '--normal-text': 'var(--foreground)',
          '--normal-border': 'var(--border-strong)',
          '--border-radius': '3px',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };

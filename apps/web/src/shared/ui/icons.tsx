import type { ReactNode, SVGProps } from 'react';
import { cn } from '@/shared/lib/utils';

type IconProps = SVGProps<SVGSVGElement>;

/**
 * Гравировка: тонкий контур 1,5, острые углы (docs/ux.md, «Иконки»). Свои, а не lucide: уровни
 * дерева — руна, арка, знамя, ромб — должны читаться одним языком с ромбами-чекбоксами и дорогой.
 * Lucide остаётся внутри примитивов shadcn (крестики, галочки меню).
 */
function icon(name: string, paths: ReactNode) {
  function Icon({ className, ...props }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={cn('size-5 shrink-0', className)}
        {...props}
      >
        {paths}
      </svg>
    );
  }
  Icon.displayName = name;
  return Icon;
}

/** Сюжетная линия — путеводная руна. */
export const LineIcon = icon(
  'LineIcon',
  <>
    <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
    <circle cx="12" cy="12" r="1.6" />
  </>,
);
/** Глава — арка ворот. */
export const ChapterIcon = icon('ChapterIcon', <path d="M5 21V10a7 7 0 0114 0v11M3 21h18M9 21v-6a3 3 0 016 0v6" />);
/** Задание — знамя. */
export const QuestIcon = icon('QuestIcon', <path d="M6 3h12v14.5L12 21l-6-3.5zM9.5 8h5M9.5 11.5h5" />);
/** Этап — ромб, как у чекбокса. */
export const StepIcon = icon('StepIcon', <path d="M12 4.5l7 7.5-7 7.5L5 12z" />);
/** Активный квест — флаг. */
export const FlagIcon = icon('FlagIcon', <path d="M6 21V4M6 4h11l-2.5 4 2.5 4H6" />);
export const GearIcon = icon(
  'GearIcon',
  <>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
  </>,
);
export const TodayIcon = icon(
  'TodayIcon',
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2 2M16.7 16.7l2 2M18.7 5.3l-2 2M7.3 16.7l-2 2" />
  </>,
);
export const BookIcon = icon('BookIcon', <path d="M5 4.5h10a3 3 0 013 3V20H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h10" />);
export const DotsIcon = icon(
  'DotsIcon',
  <>
    <circle cx="12" cy="5.5" r="1.2" />
    <circle cx="12" cy="12" r="1.2" />
    <circle cx="12" cy="18.5" r="1.2" />
  </>,
);
export const BackIcon = icon('BackIcon', <path d="M15 5l-7 7 7 7" />);
export const ChevronRightIcon = icon('ChevronRightIcon', <path d="M9 6l6 6-6 6" />);
export const PlusIcon = icon('PlusIcon', <path d="M12 5v14M5 12h14" />);
/** Просрочка — песочные часы, не восклицательный знак: опоздание не провал (docs/ux.md). */
export const HourglassIcon = icon('HourglassIcon', <path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" />);
export const CalendarIcon = icon(
  'CalendarIcon',
  <>
    <rect x="4" y="5" width="16" height="15" rx="1" />
    <path d="M4 10h16M8 3v4M16 3v4" />
  </>,
);
export const PauseIcon = icon('PauseIcon', <path d="M9 5v14M15 5v14" />);
/** Контракт — свиток с печатью (docs/ux.md, «Иконки уровней», v2). */
export const ScrollIcon = icon(
  'ScrollIcon',
  <>
    <path d="M7 4h10a2 2 0 012 2v12M7 4a2 2 0 00-2 2v2h4M7 4a2 2 0 012 2v12a2 2 0 002 2h8a2 2 0 002-2v-1h-8" />
    <circle cx="14.5" cy="10.5" r="2.5" />
    <path d="M13.5 13l-.5 3 1.5-1 1.5 1-.5-3" />
  </>,
);
export const CloseIcon = icon('CloseIcon', <path d="M7 7l10 10M17 7L7 17" />);
export const SparksIcon = icon(
  'SparksIcon',
  <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />,
);

/**
 * Герб LIFE RPG: кольцо, пунктирный круг и четырёхлучевая звезда. Тот же рисунок — в иконке
 * приложения (public/pwa-icon.svg).
 */
export function Crest({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden className={className}>
      <circle cx="32" cy="32" r="29" />
      <circle cx="32" cy="32" r="24" strokeDasharray="1.5 3.5" />
      <path d="M32 7l5.5 19.5L57 32l-19.5 5.5L32 57l-5.5-19.5L7 32l19.5-5.5z" className="fill-surface-1" />
      <circle cx="32" cy="32" r="3.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Разделитель «нить с ромбом» — для входа и экрана завершения, не для списков. На span, а не div:
 * на экране завершения он стоит внутри заголовка, где допустим только фразовый контент.
 */
export function RuneDivider({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('flex items-center gap-2.5', className)}>
      <span className="h-px flex-1 bg-linear-to-r from-transparent via-gold-dim to-transparent" />
      <span className="size-1.75 rotate-45 border border-gold" />
      <span className="h-px flex-1 bg-linear-to-r from-transparent via-gold-dim to-transparent" />
    </span>
  );
}

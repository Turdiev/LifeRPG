import type { DraftCount, DraftKind } from '@life-rpg/domain';
import { plural } from '@/shared/lib/plural';
import { ru } from '@/shared/strings/ru';

const ORDER: DraftKind[] = ['chapter', 'quest', 'step'];

/** Фраза предпросмотра из docs/ux.md: «Будет создано: 3 задания и 9 этапов». */
export function pasteSummary(count: DraftCount): string {
  const parts = ORDER.filter((kind) => count[kind] > 0).map(
    (kind) => `${count[kind]} ${plural(count[kind], ru.paste.nouns[kind])}`,
  );
  const listed = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} и ${parts.at(-1)}` : (parts[0] ?? '');
  return ru.paste.summary(listed);
}

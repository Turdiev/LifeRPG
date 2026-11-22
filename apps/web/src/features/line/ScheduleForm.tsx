import {
  applyRemoveSchedule,
  buildTree,
  defaultTerm,
  DomainError,
  planSchedule,
  MAX_TERM_DAYS,
  type Schedule,
  type SchedulePlan,
} from '@life-rpg/domain';
import type { PutScheduleRequest } from '@life-rpg/shared';
import { useState } from 'react';
import { formatDeadline, localToday } from '@/shared/lib/format';
import { plural } from '@/shared/lib/plural';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Switch } from '@/shared/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import { addDays } from './contract-model';
import { allows, type TreeNode } from './line-model';

type ScheduleFormProps = {
  node: TreeNode;
  nodes: readonly TreeNode[];
  repeat: boolean;
  onRepeatChange: (repeat: boolean) => void;
  readOnly: boolean;
  saving: boolean;
  /** `null` снимает расписание. */
  onSave: (body: PutScheduleRequest | null) => void;
};

/**
 * Расписание в листе деталей (docs/ux.md, F-21, F-25). Сохраняется кнопкой, а не на лету: оно создаёт
 * и удаляет дни. Предпросмотр и запреты считает тот же `planSchedule`, что и сервер.
 */
export function ScheduleForm({ node, nodes, repeat, onRepeatChange, readOnly, saving, onSave }: ScheduleFormProps) {
  const today = localToday();
  const tree = buildTree(nodes);
  const current = node.schedule;
  const [weekdays, setWeekdays] = useState(current?.weekdays ?? 0);
  const [start, setStart] = useState(current?.start ?? today);
  const [end, setEnd] = useState(() => current?.end ?? defaultTerm(tree, node.id, today).end ?? '');
  // У идущего контракта начало не меняется (PRD, «Контракты», правило 6).
  const started = current !== null && current.start <= today;

  // В замороженной ветке домен ответил бы branch_locked — предпросматривать нечего.
  const assessed = repeat && !readOnly ? assess({ weekdays, start, end }) : null;
  const canRemove = current !== null && !readOnly && allows(() => applyRemoveSchedule(tree, node.id));

  function assess(draft: { weekdays: number; start: string; end: string }): { error: string } | { preview: string } {
    const { form } = ru.contract;
    if (draft.weekdays === 0) return { error: form.pickDays };
    if (!draft.end) return { error: form.pickEnd };
    if (draft.end < draft.start) return { error: form.endBeforeStart };
    if (draft.end > addDays(draft.start, MAX_TERM_DAYS)) return { error: form.tooLong };
    if (!started && draft.start < today) return { error: form.startInPast };
    const schedule: Schedule = { weekdays: draft.weekdays, start: draft.start, end: draft.end };
    let plan: SchedulePlan;
    try {
      plan = planSchedule(tree, node.id, schedule, today);
    } catch (error) {
      if (error instanceof DomainError && error.code === 'invalid_transition') return { error: form.noDays };
      throw error;
    }
    if (current === null) {
      const count = plan.add.length;
      const term = [formatDeadline(draft.start, today), formatDeadline(draft.end, today)] as const;
      return { preview: form.willBe(count, plural(count, ru.contract.days), ...term) };
    }
    const added = plan.add.length + plan.restore.length;
    const removed = plan.remove.length;
    if (added + removed === 0 && sameSchedule(current, schedule)) return { error: form.unchanged };
    const parts = [
      added > 0 && form.added(added, plural(added, ru.contract.days)),
      removed > 0 && form.removed(removed, plural(removed, ru.contract.days)),
    ].filter(Boolean);
    // Сдвиг конца без новых и лишних дней всё равно меняет срок — сохранять есть что.
    if (parts.length === 0) return { preview: form.termOnly };
    const text = parts.join(', ');
    return { preview: text[0]!.toUpperCase() + text.slice(1) };
  }

  const toggleId = `repeat-${node.id}`;
  return (
    <div className="grid gap-3">
      {current === null && (
        <div className="flex min-h-11 items-center justify-between gap-3">
          <Label htmlFor={toggleId}>{ru.contract.form.repeat}</Label>
          <Switch id={toggleId} checked={repeat} disabled={readOnly} onCheckedChange={onRepeatChange} />
        </div>
      )}

      {repeat && (
        <>
          <fieldset className="grid gap-2" disabled={readOnly}>
            <legend className="mb-2 text-sm font-medium">{ru.contract.form.weekdays}</legend>
            <ToggleGroup
              type="multiple"
              variant="outline"
              spacing={1}
              value={ru.contract.weekdays.filter((_, index) => weekdays & (1 << index))}
              onValueChange={(values) => setWeekdays(maskOf(values))}
              className="flex-wrap"
            >
              {ru.contract.weekdays.map((name) => (
                <ToggleGroupItem key={name} value={name} className="px-0">
                  {name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <div className="grid gap-2">
              <Label htmlFor="schedule-start">{ru.contract.form.start}</Label>
              <Input
                id="schedule-start"
                type="date"
                value={start}
                min={started ? undefined : today}
                readOnly={readOnly || started}
                onChange={(event) => setStart(event.target.value)}
                className="w-fit"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="schedule-end">{ru.contract.form.end}</Label>
              <Input
                id="schedule-end"
                type="date"
                value={end}
                min={start}
                max={start ? addDays(start, MAX_TERM_DAYS) : undefined}
                readOnly={readOnly}
                onChange={(event) => setEnd(event.target.value)}
                className="w-fit"
              />
            </div>
          </div>
          {assessed && (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {'error' in assessed ? assessed.error : assessed.preview}
            </p>
          )}
          {!readOnly && (
            <div className="grid gap-2">
              <Button
                disabled={saving || assessed === null || 'error' in assessed}
                onClick={() => onSave({ weekdays, start, end, today })}
              >
                {ru.contract.form.save}
              </Button>
              {canRemove && (
                <Button variant="outline" disabled={saving} onClick={() => onSave(null)}>
                  {ru.contract.form.remove}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function maskOf(names: readonly string[]): number {
  return ru.contract.weekdays.reduce((mask, name, index) => (names.includes(name) ? mask | (1 << index) : mask), 0);
}

function sameSchedule(a: Schedule, b: Schedule): boolean {
  return a.weekdays === b.weekdays && a.start === b.start && a.end === b.end;
}

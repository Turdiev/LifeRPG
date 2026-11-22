import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { FinishContractDialog } from '@/features/line/LineDialogs';
import { useNodeStatus } from '@/features/line/use-line';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { HourglassIcon, ScrollIcon } from '@/shared/ui/icons';
import { todayContractView, type TodayContractItem } from './today-model';
import { useTodayLineTree } from './use-today';

/**
 * Блок «На сегодня» (docs/ux.md, F-23): панель без золотых уголков — они только у активного квеста.
 * Порядок строк дал сервер: журнал, внутри цели — дерево, вышедший срок — в конце.
 */
export function TodayContracts({ items, date }: { items: readonly TodayContractItem[]; date: string }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="today-contracts" className="panel px-3.5 pt-3 pb-1">
      <h2 id="today-contracts" className="flex items-center gap-2 type-chapter">
        <ScrollIcon className="text-gold" />
        {ru.today.contracts.title}
      </h2>
      <ul className="mt-1">
        {items.map((item) => (
          <TodayContractRow key={item.questId} item={item} date={date} />
        ))}
      </ul>
    </section>
  );
}

function TodayContractRow({ item, date }: { item: TodayContractItem; date: string }) {
  // Дерево линии — в общем кеше: отметка здесь видна и на экране линии, и наоборот.
  const tree = useTodayLineTree(item.lineId, date);
  const status = useNodeStatus(item.lineId);
  const [finishing, setFinishing] = useState(false);
  const view = tree.data && todayContractView(tree.data.nodes, item);
  if (!view) return null;
  const { contract, day, progress } = view;
  const { contracts } = ru.today;
  const marked = day?.status === 'done';
  const path = view.path.join(' › ');
  const count = contracts.progress(progress.done, progress.total);
  const expiredText = progress.done > 0 ? contracts.expired(progress.done, progress.total) : contracts.expiredNone;

  return (
    <li className="flex items-start gap-1 border-b py-1 last:border-b-0">
      {day ? (
        <Checkbox
          checked={marked}
          // Повторный тап снимает отметку; день остаётся в блоке с галочкой до конца дня (docs/ux.md).
          onCheckedChange={() => status.mutate({ node: day, action: marked ? 'reopen' : 'complete' })}
          // Имя постоянное: отмечен ли день, скринридер скажет по состоянию флажка.
          aria-label={contracts.dayToday(contract.title)}
        />
      ) : (
        <span aria-hidden className="grid size-11 shrink-0 place-items-center text-overdue">
          <HourglassIcon />
        </span>
      )}
      <div className="min-w-0 flex-1 py-1.5">
        <Link
          to="/line/$lineId"
          params={{ lineId: item.lineId }}
          search={{ quest: contract.id }}
          aria-label={[contracts.open(contract.title), view.expired ? expiredText : `${path}, ${count}`].join(', ')}
          className="block rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span
            className={cn(
              'block text-[0.9375rem] leading-snug font-medium break-words',
              marked && 'text-muted-foreground line-through decoration-gold-dim',
            )}
          >
            {contract.title}
          </span>
          {view.expired ? (
            <span className="mt-0.5 block text-xs font-medium text-overdue">{expiredText}</span>
          ) : (
            // Путь слева, счёт справа: «8 из 27» читается отдельно от того, где лежит контракт.
            <span className="mt-0.5 flex items-baseline gap-3 text-xs text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">{path}</span>
              <span className="shrink-0 tabular-nums">{count}</span>
            </span>
          )}
        </Link>
        {view.expired && contract.status === 'open' && (
          // Без отметок завершать нечего — вместо «Завершить» отмена (docs/ux.md, «Срок вышел»).
          <Button
            variant="outline"
            className="mt-2"
            onClick={() =>
              progress.done > 0 ? setFinishing(true) : status.mutate({ node: contract, action: 'cancel' })
            }
          >
            {progress.done > 0 ? ru.contract.finish : ru.contract.cancelContract}
          </Button>
        )}
      </div>
      {finishing && (
        <FinishContractDialog
          marked={progress.done}
          total={progress.total}
          onOpenChange={(open) => !open && setFinishing(false)}
          onConfirm={() => {
            setFinishing(false);
            status.mutate({ node: contract, action: 'finish' });
          }}
        />
      )}
    </li>
  );
}

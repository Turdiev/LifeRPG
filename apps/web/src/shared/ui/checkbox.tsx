import * as React from "react"
import { cn } from "@/shared/lib/utils"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root> & {
  /** Крупный ромб для следующего этапа — ответа на «что сделать сейчас». */
  large?: boolean
  /** Отменённый элемент: серый ромб с крестом вместо пустого (docs/ux.md, «Цвета статусов»). */
  cancelled?: boolean
}

const DIAMOND = "14,2.5 25.5,14 14,25.5 2.5,14"

/**
 * Чекбокс-ромб: открыт — пустой с внутренним ромбом, выполнен — золотой с галочкой, отмена — крест.
 * Статус читается по форме, а не только по цвету. Зона касания 44 × 44 (у крупного — 52), ромб 28 / 34.
 * При отметке ромб подпрыгивает и от него расходится кольцо света — только в ответ на касание,
 * а не при каждом появлении уже отмеченного.
 */
function Checkbox({ className, large = false, cancelled = false, onCheckedChange, ...props }: CheckboxProps) {
  const [popped, setPopped] = React.useState(0)

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "group/check relative grid shrink-0 place-items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default",
        large ? "size-13" : "size-11",
        className
      )}
      onCheckedChange={(checked) => {
        if (checked === true) setPopped((count) => count + 1)
        onCheckedChange?.(checked)
      }}
      {...props}
    >
      {/* Новый key перезапускает анимацию. Ключи ромба и кольца разные: это соседи, и одинаковый key
          ломает сверку React — старые ромбы не удалялись и копились при отметке и снятии. */}
      <svg
        key={`diamond-${popped}`}
        viewBox="0 0 28 28"
        aria-hidden
        className={cn(
          "overflow-visible transition-[filter] group-data-[state=checked]/check:drop-shadow-[0_0_6px_var(--glow)] group-hover/check:not-group-disabled/check:drop-shadow-[0_0_5px_var(--glow)] group-disabled/check:not-group-data-[state=checked]/check:opacity-60",
          large ? "size-8.5" : "size-7",
          popped > 0 && "motion-safe:animate-check-pop"
        )}
      >
        <DiamondGlyph cancelled={cancelled} />
      </svg>
      {popped > 0 && (
        <span
          key={`ring-${popped}`}
          aria-hidden
          className={cn(
            "pointer-events-none absolute border-2 border-gold-bright opacity-0 motion-safe:animate-check-ring motion-reduce:hidden",
            large ? "size-8.5" : "size-7"
          )}
        />
      )}
    </CheckboxPrimitive.Root>
  )
}

/**
 * Рисунок ромба. Отмечен он или нет, решает `data-state` у ближайшего `group/check`: у чекбокса это
 * Radix Root, у статичного ромба — его обёртка.
 */
function DiamondGlyph({ cancelled }: { cancelled: boolean }) {
  if (cancelled) {
    return (
      <>
        <polygon points={DIAMOND} fill="none" className="stroke-muted-foreground" strokeWidth="1.2" opacity=".75" />
        <path d="M10 10l8 8M18 10l-8 8" className="stroke-muted-foreground" strokeWidth="1.6" strokeLinecap="round" />
      </>
    )
  }
  return (
    <>
      <polygon
        points={DIAMOND}
        strokeWidth="1.5"
        className="fill-surface-3 stroke-gold group-data-[state=checked]/check:fill-[url(#check-fill)] group-data-[state=checked]/check:stroke-gold-bright"
      />
      <polygon points="14,8.4 19.6,14 14,19.6 8.4,14" fill="none" className="stroke-gold-dim group-data-[state=checked]/check:hidden" />
      <path
        d="M9 14.4l3.7 3.7 6.5-7.6"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="hidden stroke-on-gold group-data-[state=checked]/check:block"
      />
    </>
  )
}

/**
 * Ромб без кнопки — для картинок вроде примера цели на экране входа: отмечать там нечего, и фокус
 * заходить не должен. Зона того же размера, что у чекбокса, чтобы строки совпадали с настоящими.
 */
function CheckDiamond({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      data-state={checked ? "checked" : "unchecked"}
      className={cn("group/check grid size-11 shrink-0 place-items-center", className)}
    >
      <svg
        viewBox="0 0 28 28"
        className="size-7 overflow-visible transition-[filter] duration-300 group-data-[state=checked]/check:drop-shadow-[0_0_6px_var(--glow)]"
      >
        <DiamondGlyph cancelled={false} />
      </svg>
    </span>
  )
}

/**
 * Градиент заливки отмеченного ромба — один на страницу: у SVG id глобальный, а ромбов в дереве десятки.
 * Монтируется в корневом layout.
 */
function CheckboxDefs() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs>
        <linearGradient id="check-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--gold-bright)" />
          <stop offset="1" stopColor="var(--gold)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export { CheckDiamond, Checkbox, CheckboxDefs }

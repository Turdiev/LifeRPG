export type PluralForms = { one: string; few: string; many: string };

const rules = new Intl.PluralRules('ru-RU');

export function plural(count: number, forms: PluralForms): string {
  const category = rules.select(count);
  return category === 'one' ? forms.one : category === 'few' ? forms.few : forms.many;
}

import { describe, expect, it } from 'vitest';
import { plural } from './plural';

describe('plural', () => {
  const elements = { one: 'элемент', few: 'элемента', many: 'элементов' };

  it('picks the Russian plural form by the number', () => {
    expect([1, 2, 5, 11, 21, 22, 25, 111].map((n) => `${n} ${plural(n, elements)}`)).toEqual([
      '1 элемент',
      '2 элемента',
      '5 элементов',
      '11 элементов',
      '21 элемент',
      '22 элемента',
      '25 элементов',
      '111 элементов',
    ]);
  });
});

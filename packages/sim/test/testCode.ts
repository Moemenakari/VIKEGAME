import { GIFT_CODES, hashString } from '../src';

/**
 * A gift code that exists only while the tests run (the real ones are never written in the
 * repository). It gives the same as the owner's testing code.
 */
export const TEST_CODE = 'TEST-ONLY-CODE';

export function addTestCode(): void {
  const hash = hashString(TEST_CODE);
  if (GIFT_CODES.some((g) => g.hash === hash)) return;
  GIFT_CODES.push({ ...GIFT_CODES[0]!, hash, name: 'Test-only code' });
}

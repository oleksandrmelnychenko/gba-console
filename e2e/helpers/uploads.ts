import fs from 'node:fs';
import path from 'node:path';

export const TEST_INCOME_ROOT = path.resolve('SQL/TestIncome');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

export function supplierDir(prefix: string): string {
  const dirs = fs
    .readdirSync(TEST_INCOME_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => path.join(TEST_INCOME_ROOT, entry.name));
  if (dirs.length !== 1) {
    throw new Error(`Expected exactly one TestIncome supplier dir starting with "${prefix}", found ${dirs.length}`);
  }
  return dirs[0];
}

export function customsSpecificationFile(supplierPrefix: string): string {
  const files = walk(supplierDir(supplierPrefix)).filter((file) => /копия\.xlsx$/i.test(path.basename(file)));
  if (files.length !== 1) {
    throw new Error(
      `Expected exactly one "CCD_* — копия.xlsx" for supplier "${supplierPrefix}", found: ${files.map((f) => path.basename(f)).join(', ') || 'none'}`,
    );
  }
  return files[0];
}

export function assertNotRawCcd(filePath: string): void {
  const name = path.basename(filePath);
  if (/^CCD_/.test(name) && !/копия\.xlsx$/i.test(name)) {
    throw new Error(`Raw CCD files must not be uploaded (README rule): ${name}`);
  }
}

import type { ScrollOwner } from './contracts';

export interface ScrollRegionDefinition {
  key: string;
  axis: 'vertical' | 'horizontal';
  owner: ScrollOwner;
  nested?: boolean;
}

export interface ScrollContractResult {
  valid: boolean;
  violations: string[];
}

export function validateScrollContract(regions: readonly ScrollRegionDefinition[]): ScrollContractResult {
  const violations: string[] = [];
  const primaryVertical = regions.filter((region) => region.axis === 'vertical' && region.owner !== 'internal');

  if (primaryVertical.length > 1) {
    violations.push(`Expected one primary vertical scroll owner; found ${primaryVertical.length}: ${primaryVertical.map((region) => region.key).join(', ')}`);
  }

  for (const region of regions) {
    if (region.axis === 'vertical' && region.owner === 'internal' && !region.nested) {
      violations.push(`Internal vertical scroll region "${region.key}" must explicitly declare nested=true.`);
    }
  }

  return { valid: violations.length === 0, violations };
}

import axe from 'axe-core';
import { expect } from 'vitest';

export async function expectNoA11yViolations(container: Element): Promise<void> {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
    },
  });

  if (results.violations.length > 0) {
    const formattedViolations = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.map((node) => node.html),
    }));
    expect(formattedViolations).toEqual([]);
  }

  expect(results.violations).toHaveLength(0);
}

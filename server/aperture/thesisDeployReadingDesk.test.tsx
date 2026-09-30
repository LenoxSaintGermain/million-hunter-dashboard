import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { ThesisRequirementPortrait } from '../../client/src/components/ThesisRequirementPortrait';
import { QuickHitCard } from '../../client/src/components/aperture/QuickHitCard';
import { CURATED_QUICK_HITS } from './quickHitCatalog';

describe('thesis and deployment reading desk', () => {
  it.each(['acquisition','property','capital'] as const)('keeps %s hints distinct from evidence', scope => {
    const $=load(renderToStaticMarkup(<ThesisRequirementPortrait scope={scope} hasDraft={false}/>));
    expect($('details')).toHaveLength(3);
    expect($('[aria-label="Not assessed"]')).toHaveLength(3);
    expect($.text()).toContain('These hints are not saved criteria');
    expect($.text()).not.toContain('100%');
  });
  it('does not turn entered draft text into a verified finding',()=>{
    expect(renderToStaticMarkup(<ThesisRequirementPortrait scope="acquisition" hasDraft/>)).toContain('Requirements not compiled yet');
  });
  it('renders proportional sample boundaries and budget-sensitive arithmetic, not an order',()=>{
    const play=CURATED_QUICK_HITS[0];
    const small=load(renderToStaticMarkup(<QuickHitCard play={play} defaultBudget={25}/>));
    const large=load(renderToStaticMarkup(<QuickHitCard play={play} defaultBudget={100}/>));
    expect(small('svg').attr('aria-label')).toContain('Not a price history');
    expect(small('.scenario-outcomes').text()).not.toEqual(large('.scenario-outcomes').text());
    expect(large('button[disabled]').text()).toContain('order unavailable');
    expect(large('details')).toHaveLength(2);
  });
  it('does not claim blanket evidence verification or preflight approval',()=>{
    const source=readFileSync('client/src/pages/aperture/ApertureDeploy.tsx','utf8');
    expect(source).not.toContain('100% Confirmed');
    expect(source).not.toContain('Broker & Single-Order Bounds Pass');
    expect(source).toContain('Checked during order review');
    expect(source).toContain('Buying power not recorded');
  });
});

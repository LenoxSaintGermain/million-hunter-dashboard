# Jim-equivalent Capital Aperture UAT Evidence

**Fixture identity:** `uat_jim_capital_20260813` / **Jim Capital UAT**. This is an application-only fixture; it has no OAuth identity and does not alter Jim Butler’s live account.

## Required stakeholder state

| Requirement | Verified state |
|---|---|
| Role | `admin` |
| Onboarding | Completed |
| Default root workspace | `capital_aperture` → `/aperture` |
| Shared canonical thesis | `Wingate Historic Stabilized` with `use` permission |
| Personal Capital / Trade thesis | `Jim Capital UAT — AI Liquidity Cycle` |
| Aperture projection | Active, primary, linked to the personal canonical thesis |

## Repeatable checks

Provision or refresh the fixture with:

```bash
node scripts/provision-jim-capital-uat.mjs
```

Validate the fixture without writing orders or calling a broker:

```bash
node scripts/validate-jim-capital-uat.mjs
```

The validation confirms the stakeholder profile, root route expectation, and access to the shared Wingate thesis. The database lifecycle check also confirms that the fixture’s personal Capital / Trade thesis has an active, primary Capital Aperture projection.

> This fixture validates application state and routing contracts. It never submits an order, connects to a real OAuth identity, or modifies Jim’s live account.

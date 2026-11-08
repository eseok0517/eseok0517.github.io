> **Original synthetic scenario:** This document describes the separate model at [scenario.html](scenario.html). For the real public procurement case, see [PUBLIC_DATA.md](PUBLIC_DATA.md).

# Management memo: manufacturing purchasing strategy

To: Manufacturing finance and procurement review
From: Ehahn Seok
Subject: Inventory capital versus purchasing cost
Basis: synthetic data, Jul–Dec 2025, 180 modeled days

## Recommendation

Evaluate a targeted frequent-ordering pilot for noncritical items, subject to service-level review. Bulk purchasing warrants separate evaluation where discounts are sustainable and cash capacity permits it. The modeled tradeoff does not justify a blanket policy change.

## Results at the default assumptions

| Policy | Average inventory (standard cost) | Six-month net policy cost | Unit fill rate |
|---|---:|---:|---:|
| Current | $3,148,945 | $292,123 | 99.98% |
| Frequent | $1,248,151 | $151,606 | 99.79% |
| Bulk | $4,252,079 | $1,241 | 99.99% |

Frequent ordering reduces average inventory investment by **$1,900,794** and six-month policy cost by **$140,517** relative to Current. These are distinct measures; capital release must not be added to recurring savings. Frequent ordering also has a lower fill rate, so critical-item shortages require review.

Bulk purchasing benefits from an assumed 4% discount but requires more inventory capital. Net policy cost deducts supplier discount benefits and excludes common base materials cost; it is not total procurement expenditure.

## Decisions before implementation

Confirm supplier minimum orders and freight, actual carrying costs and item criticality. Estimate downtime costs for shortages, model variable lead times, and create a transition cash-flow schedule. Reevaluate the recommendation if discounts, demand or financing costs change.

## Evidence and limits

Policies were calibrated on 18 training months and evaluated on identical held-out demand streams. Inventory units reconcile for all 360 item-policy combinations. Synthetic data, different opening inventory by policy and deterministic lead times limit generalization. All savings are modeled. The Excel annual steady-state model uses a different method and is labeled separately.

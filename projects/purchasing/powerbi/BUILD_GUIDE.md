# Native Power BI report assembly

These are implementation assets, not a finished `.pbix`. Use Power BI Desktop on Windows.

1. Get Data → Text/CSV: import `items.csv` as Items, `policy_results.csv` as PolicyResults and `purchases.csv` as Purchases.
2. In Power Query assign item_id/category/location/policy/supplier_id as text; quantities as whole numbers; costs and rates as decimal numbers. Do not aggregate or deduplicate PolicyResults: its key is item_id + policy.
3. Set one-to-many, single-direction relationships Items[item_id] → PolicyResults[item_id] and Items[item_id] → Purchases[item_id]. Do not directly join purchases to policy results; that would multiply transactions.
4. Create each measure from `measures.dax` individually. Use PolicyResults[policy] as the sole policy selector (single-select). Policy comparison measures remove only this policy-column filter, preserving room, item and category filters. Do not introduce a separate policy dimension without adapting those measures.
5. Financial overview page: location/category slicers from Items, single-select policy slicer, cards for Net Policy Cost USD, Average Inventory USD and Unit Fill Rate; bar chart policy vs Net Policy Cost USD. Disable the policy slicer's interaction with the comparison chart so all three policies remain visible.
6. Purchasing decisions page: table of item ID, category, policy, Cost Reduction USD, Capital Released USD and Unit Fill Rate. Sort cost reduction descending. Show shortages beside costs; do not automatically treat the lowest-cost policy as suitable for critical supplies.
7. Data quality page: card for Purchases row count (2,880), source note explaining 36 raw duplicates, and supplier spending by month using Purchases[spend] and Items[supplier_id]. Convert YYYY-MM month text to the first of that month if using a date axis.

**Important:** every headline inventory or cost card must have exactly one policy selected. Summing all three counterfactual policies counts three alternative worlds. Fill rate must be a ratio of summed quantities, not an average of item percentages. Format rates as 0.00%, monetary values as USD and quantities as integers.

**Validation:** with all rooms selected, Current inventory is $3,148,944.69 and six-month net policy cost is $292,123.20. Frequent inventory is $1,248,150.51 and net policy cost is $151,606.28. Compare these values to CSV totals before publishing. Add the synthetic-data label and six-month period to every page. Native Desktop execution is still required to verify DAX and report interactions.

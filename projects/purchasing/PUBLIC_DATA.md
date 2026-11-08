# Industrial Purchasing & Transaction Controls

## Source and scope

California Department of General Services, [Purchase Order Data](https://data.ca.gov/@california-department-of-general-services/purchase-order-data), historical 2012–2015 export; retrieved November 8, 2026. The portal states no restrictions on public use. The exact source URL and SHA-256 are in `data/public/summary.json`.

Read 344,504 original records. Select all 14,823 rows with Segment Title equal to Manufacturing Components and Supplies; Tools and General Machinery; or Electrical Systems and Lighting and Components and Accessories and Supplies. These categories are industrial analogues, not semiconductor-fab transactions. Classifications can be imperfect; some descriptions may be services or generic amounts despite their category.

## Field handling

The actual CSV differs from the generic portal data dictionary. It contains Quantity, Unit Price and Total Price, but **no unit-of-measure field, unique line ID, inventory balance, or receipt history**. No pack conversions, item equivalence, or bulk-discount savings are inferred. Original full export is not bundled; retrieve it from the government URL and verify the hash. The selected CSV preserves source row numbers, source item descriptions and selected business fields. Currency symbols and commas are removed from numeric values using Decimal arithmetic; identifier whitespace is trimmed. Source row 1 is the CSV header.

Purchase dates are used when parseable and between 2000 and the snapshot date. Otherwise the date is flagged and valid creation date is the fallback; both original parsed dates and the grouping basis are exported. Exact original date strings can be inspected using source_row in the government file. The date range printed on the source describes the extract, not a promise that every entered date lies in that interval.

## Measures and review rules

- Positive recorded amount: sum of strictly positive Total Price values, with all source rows retained. This is not paid expenditure, booked expense, savings, or a verified contract total.
- PO groups: distinct department/PO pairs, excluding missing POs. Not a count of unique lines or independently verified orders.
- Supplier count: distinct populated supplier codes. Charts instead group displayed supplier names, so name variants or shared names can split or merge groups. Unknown labels are retained.
- Repeated-line candidates: exact match of all selected business fields except source row, date fallback fields and flags. No automatic deletion because legitimate lines may repeat and source line IDs are unavailable.
- Extended amount review: absolute difference between quantity × unit price and line total exceeds $0.05; fees, tax, adjustments, or source conventions could explain differences.
- Additional flags: missing supplier code or PO; missing/invalid or implausible dates; missing/nonpositive numeric fields. Multiple flags can occur on one record.

## Management recommendation

Use the review CSV to request source documents for flagged records. Validate supplier identity and classification before assessing concentration. Obtain item specifications, units and contract terms before comparing prices. Request receipts, consumption, inventory and lead-time records before recommending replenishment changes. Do not present review amounts as recoverable savings or confirmed errors.

## Reproduce

From repository root:

```bash
python scripts/build_public_cases.py --download
# Or use saved original files to reproduce a specific snapshot:
python scripts/build_public_cases.py --california /path/to/california.csv --seattle /path/to/seattle.json
```

Python uses only the standard library. SQL checks are in `sql/public_procurement.sql`. Full output CSVs include every selected row; the webpage shows a fixed 250-row preview while category metrics cover the full selection. A future download may change if the publisher revises source data; compare hashes.

## Separate modeling exercise

`scenario.html`, `financial_model.xlsx`, `data/analysis.json`, the original SQL and Python simulation, `README.md`, and `MANAGEMENT_MEMO.md` describe the **original synthetic inventory policy scenario**. They are retained as a separate exercise, not analysis derived from the public purchase orders. No public PO data is silently substituted into the model.

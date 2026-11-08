# Seattle Public Equipment Register Review

Source: City of Seattle [Active Fleet Complement](https://data.seattle.gov/City-Administration/Active-Fleet-Complement/enxu-fgzb), public domain. Downloaded November 8, 2026 through the public Socrata API. Exact response preserved in `data/seattle_source.json`; source URL, SHA-256 and summary are in `data/summary.json`. Static snapshot, not a live feed.

## Scope and exclusion

The response contains 4,245 rows. One has only an aggregate in-service cost and no equipment ID. Exclude this row from equipment calculations to avoid double-counting cost; retain it in the raw source for inspection. The remaining 4,244 equipment records sum to $435,593,138.79 in recorded in-service cost. No asset record is dropped for zero cost or a replacement-year flag.

## Mapping

| Source API field | Export / tool field | Interpretation |
|---|---|---|
| equipid | asset_id | Equipment identifier, not physical verification |
| descrip | name | Source description |
| equipment_type | category | Source equipment category |
| dept | department / location grouping | Assigned department, **not physical location** |
| inservicedate | in_service_date | Service-entry date, **not acquisition date** |
| inservicecost | in_service_cost | Recorded cost to put into service, **not market value** |
| estimated_replacement_year | planned_replacement_year | Published plan, not measured useful life |

Make, model, model year, system group and fuel type are preserved in the CSV. License plates are not needed and are omitted from the normalized export (the original public response is preserved).

## Review rules

As of November 8, 2026, flag missing/nonpositive cost, missing/invalid or future in-service date, missing department, and planned replacement year ≤ 2026. The replacement rule includes the current year and therefore does **not** mean overdue. Source planning assumptions, condition, budgets and recent replacements must be checked before action. Zero cost can represent a valid accounting treatment; it is not proof of a missing asset.

The public source does not provide audit dates, condition, annual maintenance expense, depreciable useful life or salvage value. Public mode leaves these measures and estimated net book value unavailable, and disables the default useful-life estimate for this mode. The general upload tool and separately labeled synthetic demo still support those fields and editable assumptions. Completeness covers mapped fields only and is not an audit opinion.

## Recommended follow-up

Validate cost exceptions and replacement plans with each department. Obtain physical verification, accounting policy and maintenance histories before proposing adjustments or capital spending. Public fleet equipment is an asset-control analogue, not company equipment.

## Reproduce

`python scripts/build_public_cases.py --california /path/to/california.csv --seattle projects/asset-analysis/data/seattle_source.json`

Or `--download` to refresh both public sources. Compare snapshot hashes; source updates can change results. The case page includes 20 flagged examples, the summary includes 100, and CSV exports include all source-backed equipment records and exceptions.

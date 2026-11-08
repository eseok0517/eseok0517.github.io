"""Source reconciliation checks for public-data portfolio cases."""
import csv, json, unittest
from decimal import Decimal
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

class PublicCases(unittest.TestCase):
    def test_fleet_excludes_aggregate_without_losing_equipment(self):
        folder=ROOT/'projects/asset-analysis/data'
        source=json.loads((folder/'seattle_source.json').read_text())
        summary=json.loads((folder/'summary.json').read_text())
        with (folder/'seattle_assets.csv').open() as f: rows=list(csv.DictReader(f))
        equipment=[r for r in source if r.get('equipid')]
        self.assertEqual(len(rows),len(equipment))
        self.assertEqual(len(source)-len(rows),summary['excluded_without_equipment_id'])
        expected=sum((Decimal(r.get('inservicecost','0') or '0') for r in equipment),Decimal(0))
        self.assertEqual(expected.quantize(Decimal('0.01')),Decimal(str(summary['total_cost'])))
        self.assertEqual({r['asset_id'] for r in rows},{r['equipid'] for r in equipment})
        year=int(summary['as_of'][:4])
        due=sum(bool(r['planned_replacement_year']) and int(r['planned_replacement_year'])<=year for r in rows)
        self.assertEqual(due,summary['replacement_year_reached'])
        self.assertTrue(all('condition' not in r and 'last_audit_date' not in r for r in rows))

    def test_purchasing_reconciles_without_removing_review_candidates(self):
        folder=ROOT/'projects/purchasing/data/public'
        summary=json.loads((folder/'summary.json').read_text())
        with (folder/'purchase_records.csv').open() as f: rows=list(csv.DictReader(f))
        self.assertEqual(len(rows),summary['all']['rows'])
        self.assertEqual(len({r['source_row'] for r in rows}),len(rows))
        self.assertEqual({r['category'] for r in rows},set(summary['selection']))
        amount=sum((Decimal(r['total_price']) for r in rows if r['total_price'] and Decimal(r['total_price'])>0),Decimal(0))
        self.assertEqual(amount,Decimal(str(summary['all']['positive_spend'])))
        self.assertEqual(sum(bool(r['flags']) for r in rows),summary['all']['flagged'])
        with (folder/'review_exceptions.csv').open() as f: exceptions=list(csv.DictReader(f))
        self.assertEqual({r['source_row'] for r in exceptions},{r['source_row'] for r in rows if r['flags']})
        self.assertTrue(all('2000-01-01'<=r['date_used']<=summary['retrieved_on'] for r in rows if r['date_used']))
        self.assertTrue(any('Repeated line candidate' in r['flags'] for r in rows))

if __name__=='__main__':unittest.main()

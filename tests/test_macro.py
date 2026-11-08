"""Regression checks for the sample-length and month-boundary issues."""
import importlib.util,unittest
from pathlib import Path
s=importlib.util.spec_from_file_location('macro',Path(__file__).resolve().parents[1]/'scripts/fetch_macro.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class MacroChecks(unittest.TestCase):
 def test_partial_month_excluded(self):
  self.assertEqual(m.to_monthly_last([('2025-12-30',10),('2026-01-02',11)],before_month='2026-01'),{'2025-12':10})
 def test_optional_credit_does_not_truncate_curve(self):
  data={'SP500':{'2024-01':100,'2025-01':120},'T10Y2Y':{'2024-01':-.2,'2025-01':.5},'CPIAUCSL':{},'BAMLH0A0HYM2':{'2025-01':3}}
  rows=m.build_table(data);self.assertEqual(len(rows),2);self.assertIsNone(rows[0]['credit_regime']);self.assertEqual(rows[0]['fwd12_return'],20)
  self.assertEqual(sum(r['months'] for r in m.regime_stats(rows,'curve_regime')),1)
 def test_missing_endpoint_is_unavailable(self):
  data={'SP500':{'2024-01':100},'T10Y2Y':{'2024-01':1},'CPIAUCSL':{},'BAMLH0A0HYM2':{}}
  rows=m.build_table(data);self.assertIsNone(rows[0]['fwd12_return']);self.assertEqual(m.regime_stats(rows,'curve_regime'),[])
 def test_missing_cpi_does_not_become_low_inflation(self):
  data={'SP500':{'2024-01':100,'2025-01':110},'T10Y2Y':{'2024-01':1,'2025-01':1},'CPIAUCSL':{'2024-01':100},'BAMLH0A0HYM2':{}}
  self.assertIsNone(m.build_table(data)[0]['inflation_regime'])
if __name__=='__main__':unittest.main()

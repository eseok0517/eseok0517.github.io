"""Meaningful reconciliation and holdout checks; run after build_analysis.py."""
from pathlib import Path
import csv,json,math
P=Path(__file__).resolve().parents[1]/'data'
def read(name):return list(csv.DictReader((P/name).open()))
raw,clean,results,items=map(read,['raw_purchases.csv','purchases.csv','policy_results.csv','items.csv'])
assert len(raw)==2916 and len(clean)==2880 and len(results)==360
assert len({r['transaction_id'] for r in clean})==len(clean)
keys={r['item_id'] for r in items};assert all(r['item_id'] in keys for r in clean)
unique={r['transaction_id']:r for r in raw}
assert math.isclose(sum(float(r['spend']) for r in clean),sum(float(r['packs'])*float(r['unit_price']) for r in unique.values()),abs_tol=.01)
usage=read('usage.csv');demand=read('test_demand.csv')
for item in items:
 k=item['item_id'];train=[float(r['quantity']) for r in usage if r['item_id']==k and r['period']=='Train'];test=sum(int(r['demand_units']) for r in demand if r['item_id']==k)
 for r in [r for r in results if r['item_id']==k]:
  assert math.isclose(float(r['training_daily_mean']),sum(train)/540)
  assert int(r['demand_units'])==test==int(r['filled_units'])+int(r['lost_units'])
  assert int(r['opening_units'])+int(r['received_units'])-int(r['filled_units'])==int(r['ending_units'])
  assert math.isclose(float(r['relevant_cost']),float(r['freight'])+float(r['holding_cost'])+float(r['shortage_penalty'])-float(r['discount_benefit']),abs_tol=.021)
assert len(json.loads((P/'analysis.json').read_text())['policies'])==360
print('Verified: duplicate removal, key integrity, spending reconciliation, training-only calibration, common test demand, inventory roll-forward and cost components.')

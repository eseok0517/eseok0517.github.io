"""Deterministic synthetic procurement study; Python standard library only."""
from pathlib import Path
import csv,json,random,math,sqlite3,statistics
ROOT=Path(__file__).resolve().parents[1]
rng=random.Random(242)
def write(name,rows):
 with (ROOT/'data'/name).open('w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
items=[];usage=[];raw=[]
categories=['Safety supplies','Filters','Packaging','Maintenance','Lab consumables']
for i in range(1,121):
 item=dict(item_id=f'SKU-{i:03}',category=categories[(i-1)%5],supplier_id=f'SUP-{(i-1)%12+1:02}',unit_cost=round(rng.uniform(2,95),2),pack_size=rng.choice([1,10,25]),lead_days=rng.choice([7,14,21,28]),daily_mean=rng.uniform(1,15),location=['MC','RND','WH'][(i-1)%3])
 items.append(item)
 for m in range(1,25):
  seasonal=1+.15*math.sin((m-1)*math.pi/6)
  qty=max(0,round(item['daily_mean']*30*seasonal*rng.uniform(.7,1.3)*(1.15 if m>18 else 1)))
  usage.append(dict(item_id=item['item_id'],month=f'{2024+(m-1)//12}-{(m-1)%12+1:02}',period='Train' if m<=18 else 'Test',quantity=qty))
  # Export pack counts; controlled duplicates and stray whitespace illustrate validation.
  raw.append(dict(transaction_id=f'TX-{len(raw)+1:05}',item_id=' '+item['item_id']+' ' if m%7==0 else item['item_id'],month=usage[-1]['month'],packs=math.ceil(qty/item['pack_size']),unit='pack',unit_price=round(item['unit_cost']*item['pack_size']*(1+.003*m),2)))
raw+= [dict(x) for x in raw[:36]]
clean=[];seen=set()
for x in raw:
 if x['transaction_id'] in seen:continue
 seen.add(x['transaction_id']);item=items[int(x['item_id'].strip()[4:])-1]
 clean.append(dict(transaction_id=x['transaction_id'],item_id=x['item_id'].strip(),month=x['month'],quantity=x['packs']*item['pack_size'],unit_cost=x['unit_price']/item['pack_size'],spend=round(x['packs']*x['unit_price'],2)))
# Policies frozen on 18-month training data. Every policy faces identical daily test demand.
results=[];daily=[]
for item in items:
 train=[x['quantity'] for x in usage if x['item_id']==item['item_id'] and x['period']=='Train']
 mu=sum(train)/540; sigma=statistics.stdev(train)/30
 demand=[]
 for row in [x for x in usage if x['item_id']==item['item_id'] and x['period']=='Test']:
  weights=[rng.uniform(.2,1.8) for _ in range(30)]; vals=[int(row['quantity']*w/sum(weights)) for w in weights]
  for n in range(row['quantity']-sum(vals)):vals[n%30]+=1
  demand+=vals
 # Order quantity is a multiple of pack size; reorder point includes monthly-demand uncertainty proxy.
 for policy,cover,discount in [('Current',90,0),('Frequent',30,0),('Bulk',120,.04)]:
  q=math.ceil(mu*cover/item['pack_size'])*item['pack_size'];rop=math.ceil(mu*item['lead_days']+1.65*sigma*item['lead_days'])
  stock=rop+q;opening=stock;pipeline=[];lost=filled=totalstock=orders=received=purchased=0
  for day,d in enumerate(demand):
   receipts=sum(n for due,n in pipeline if due==day);pipeline=[(due,n) for due,n in pipeline if due!=day];stock+=receipts;received+=receipts
   sold=min(stock,d);stock-=sold;filled+=sold;lost+=d-sold;totalstock+=stock
   if stock+sum(n for _,n in pipeline)<=rop:
    pipeline.append((day+item['lead_days'],q));orders+=1;purchased+=q
  avg=totalstock/180;cost=item['unit_cost']*(1-discount);pricebenefit=filled*item['unit_cost']*discount
  freight=orders*45;holding=avg*item['unit_cost']*.18*180/360;shortage=lost*item['unit_cost']*.5
  relevant=freight+holding+shortage-pricebenefit
  assert opening+received-filled==stock
  results.append(dict(item_id=item['item_id'],category=item['category'],location=item['location'],policy=policy,order_qty=q,reorder_point=rop,demand_units=sum(demand),filled_units=filled,lost_units=lost,fill_rate=filled/sum(demand),avg_inventory_value=round(avg*item['unit_cost'],2),freight=freight,holding_cost=round(holding,2),shortage_penalty=round(shortage,2),discount_benefit=round(pricebenefit,2),relevant_cost=round(relevant,2),opening_units=opening,received_units=received,ending_units=stock,training_daily_mean=mu,unit_cost=item['unit_cost']))
 for day,d in enumerate(demand):daily.append(dict(item_id=item['item_id'],day=day+1,demand_units=d))
write('items.csv',items);write('usage.csv',usage);write('raw_purchases.csv',raw);write('purchases.csv',clean);write('policy_results.csv',results);write('test_demand.csv',daily)
# Rerunnable SQLite analysis for an accessible local entry point.
dbpath=ROOT/'data'/'purchasing.sqlite'
if dbpath.exists(): dbpath.unlink()
db=sqlite3.connect(dbpath)
for name,rows in [('items',items),('usage',usage),('purchases',clean),('policy_results',results)]:
 cols=list(rows[0]); types=['REAL' if isinstance(rows[0][c],(int,float)) else 'TEXT' for c in cols]
 db.execute('CREATE TABLE '+name+' ('+','.join(c+' '+t for c,t in zip(cols,types))+')')
 db.executemany('INSERT INTO '+name+' VALUES ('+','.join('?' for _ in cols)+')',[[r[c] for c in cols] for r in rows])
query=(ROOT/'sql'/'analysis.sql').read_text()
for statement in query.split(';'):
 if statement.strip(): db.execute(statement)
summary=dict(seed=242,items=len(items),raw_rows=len(raw),clean_rows=len(clean),duplicates_removed=len(raw)-len(clean),test_days=180,training_months=18,testing_months=6,policies=results)
(ROOT/'data'/'analysis.json').write_text(json.dumps(summary,separators=(',',':')))
db.commit()
agg=db.execute('SELECT policy, SUM(relevant_cost), SUM(avg_inventory_value), SUM(filled_units)/SUM(demand_units) FROM policy_results GROUP BY policy').fetchall()
print(json.dumps(agg,indent=2))

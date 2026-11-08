"""Rebuild public purchasing and fleet cases using only Python's standard library.

python scripts/build_public_cases.py --california /path/to/california.csv --seattle /path/to/seattle.json
Pass --download to fetch the original public exports into a temporary directory.
"""
import argparse, collections, csv, datetime as dt, hashlib, json, re, tempfile
from pathlib import Path
from decimal import Decimal, InvalidOperation
from urllib.request import urlretrieve

ROOT = Path(__file__).resolve().parents[1]
CA_URL = 'https://publish.data.ca.gov/dataset/ae343670-f827-4bc8-9d44-2af937d60190/resource/bb82edc5-9c78-44e2-8947-68ece26197c5/download/purchase-order-data-2012-2015-.csv'
SEA_URL = 'https://cos-data.seattle.gov/resource/enxu-fgzb.json?$limit=50000&$order=equipid'
SEGMENTS = {'Manufacturing Components and Supplies', 'Tools and General Machinery', 'Electrical Systems and Lighting and Components and Accessories and Supplies'}
AS_OF = dt.date(2026, 11, 8)

def number(v):
    try:
        s = str(v or '').strip().replace('$','').replace(',','')
        if s.startswith('(') and s.endswith(')'): s = '-' + s[1:-1]
        n = Decimal(s)
        return n if n.is_finite() else None
    except InvalidOperation: return None

def date(v):
    for f in ('%m/%d/%Y', '%Y-%m-%d'):
        try: return dt.datetime.strptime(str(v or '')[:10], f).date().isoformat()
        except ValueError: pass
    return ''

def write_csv(path, rows, fields=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', newline='', encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=fields or list(rows[0]));w.writeheader();w.writerows(rows)

def dump(path, value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

def purchasing(path):
    selected=[]; total=0
    with path.open(encoding='utf-8-sig',newline='') as f:
        for source_row,r in enumerate(csv.DictReader(f),2):
            total+=1
            if r['Segment Title'] not in SEGMENTS: continue
            q,p,t=(number(r[k]) for k in ('Quantity','Unit Price','Total Price'))
            flags=[]
            if not r['Purchase Order Number'].strip():flags.append('Missing PO number')
            if not r['Supplier Code'].strip():flags.append('Missing supplier code')
            pd=date(r['Purchase Date']);cd=date(r['Creation Date'])
            if pd and (pd<'2000-01-01' or pd>str(AS_OF)):
                flags.append('Implausible purchase date');pd=''
            if cd and (cd<'2000-01-01' or cd>str(AS_OF)):
                flags.append('Implausible creation date');cd=''
            if not pd:flags.append('Missing/invalid purchase date')
            if q is None or q<=0:flags.append('Nonpositive/missing quantity')
            if p is None or p<=0:flags.append('Nonpositive/missing unit price')
            if t is None or t<=0:flags.append('Nonpositive/missing total')
            if all(v is not None for v in (q,p,t)) and abs(q*p-t)>Decimal('0.05'):flags.append('Extended amount review')
            selected.append(dict(source_row=source_row,po_number=r['Purchase Order Number'].strip(),department=r['Department Name'].strip(),supplier_id=r['Supplier Code'].strip(),supplier=r['Supplier Name'].strip(),purchase_date=pd,creation_date=cd,date_used=pd or cd,date_basis='Purchase date' if pd else ('Creation date fallback' if cd else 'Unavailable'),category=r['Segment Title'],commodity=r['Commodity Title'].strip(),item=r['Item Name'].strip(),description=r['Item Description'].strip(),quantity=str(q) if q is not None else '',unit_price=str(p) if p is not None else '',total_price=str(t) if t is not None else '',flags='; '.join(flags)))
    # Source does not contain line IDs. Identical records remain review candidates, never automatic deletions.
    keys=['po_number','department','supplier_id','purchase_date','creation_date','category','commodity','item','description','quantity','unit_price','total_price']
    counts=collections.Counter(tuple(r[k] for k in keys) for r in selected)
    for r in selected:
        if counts[tuple(r[k] for k in keys)]>1:r['flags']+='; Repeated line candidate' if r['flags'] else 'Repeated line candidate'
    def summary(rows):
        positives=[r for r in rows if number(r['total_price']) is not None and number(r['total_price'])>0]
        spend=sum((number(r['total_price']) for r in positives),Decimal(0))
        supplier=collections.defaultdict(Decimal);monthly=collections.defaultdict(Decimal)
        for r in positives:
            supplier[r['supplier'] or '(missing supplier)']+=number(r['total_price'])
            if r['date_used']:monthly[r['date_used'][:7]]+=number(r['total_price'])
        ranked=sorted(supplier.items(),key=lambda x:(-x[1],x[0]))
        return dict(rows=len(rows),positive_spend=float(spend),suppliers=len({r['supplier_id'] for r in rows if r['supplier_id']}),pos=len({(r['department'],r['po_number']) for r in rows if r['po_number']}),flagged=sum(bool(r['flags']) for r in rows),top5_share=float(sum((v for _,v in ranked[:5]),Decimal(0))/spend*100) if spend else 0,top_suppliers=[{'name':k,'value':float(v)} for k,v in ranked[:8]],monthly=[{'month':k,'value':float(v)} for k,v in sorted(monthly.items())],flags=dict(collections.Counter(flag for r in rows for flag in r['flags'].split('; ') if flag)))
    out=ROOT/'projects/purchasing/data/public'
    write_csv(out/'purchase_records.csv',selected)
    write_csv(out/'review_exceptions.csv',[r for r in selected if r['flags']],list(selected[0]))
    results={'source_url':CA_URL,'retrieved_on':str(AS_OF),'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'source_rows':total,'selection':sorted(SEGMENTS),'scope':'Selected source line records; no deduplication or demand inference','all':summary(selected),'categories':{c:summary([r for r in selected if r['category']==c]) for c in sorted(SEGMENTS)},'preview':[{k:r[k] for k in ('source_row','po_number','department','supplier','category','item','quantity','unit_price','total_price','flags')} for r in sorted(selected,key=lambda r:(not bool(r['flags']),r['source_row']))[:250]]}
    dump(out/'summary.json',results)
    print('Purchasing:',json.dumps(results['all']))

def fleet(path):
    source=json.loads(path.read_text());rows=[];excluded=[]
    for r in source:
        if not str(r.get('equipid','')).strip():excluded.append(r);continue
        rows.append(dict(asset_id=r['equipid'],name=r.get('descrip',''),category=r.get('equipment_type',''),department=r.get('dept',''),in_service_date=date(r.get('inservicedate')),in_service_cost=r.get('inservicecost',''),planned_replacement_year=r.get('estimated_replacement_year',''),make=r.get('make',''),model=r.get('model',''),model_year=r.get('year',''),system_group=r.get('system_group',''),fuel_type=r.get('fuel_type','')))
    def flags(r):
        f=[];c=number(r['in_service_cost']);yr=number(r['planned_replacement_year'])
        if c is None or c<=0:f.append('Missing/nonpositive in-service cost')
        if not r['in_service_date']:f.append('Missing/invalid in-service date')
        elif r['in_service_date']>str(AS_OF):f.append('Future in-service date')
        if yr is not None and yr<=AS_OF.year:f.append('Planned replacement year reached')
        if not r['department']:f.append('Missing department')
        return '; '.join(f)
    for r in rows:r['review_flags']=flags(r)
    out=ROOT/'projects/asset-analysis/data'
    # Preserve the exact source response for reproducibility; it includes a cost-only summary row.
    (out).mkdir(parents=True,exist_ok=True);(out/'seattle_source.json').write_bytes(path.read_bytes())
    write_csv(out/'seattle_assets.csv',rows)
    write_csv(out/'seattle_exceptions.csv',[r for r in rows if r['review_flags']],list(rows[0]))
    total=sum((number(r['in_service_cost']) or Decimal(0) for r in rows),Decimal(0))
    by=collections.defaultdict(Decimal)
    for r in rows:by[r['department'] or '(missing)']+=number(r['in_service_cost']) or Decimal(0)
    summary=dict(source_url=SEA_URL,retrieved_on=str(AS_OF),as_of=str(AS_OF),source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),source_rows=len(source),excluded_without_equipment_id=len(excluded),rows=len(rows),total_cost=float(total),departments=len({r['department'] for r in rows if r['department']}),nonpositive_cost=sum(number(r['in_service_cost']) is None or number(r['in_service_cost'])<=0 for r in rows),replacement_year_reached=sum('Planned replacement year reached' in r['review_flags'] for r in rows),flagged=sum(bool(r['review_flags']) for r in rows),by_department=[{'name':k,'value':float(v)} for k,v in sorted(by.items(),key=lambda x:(-x[1],x[0]))],preview=[r for r in rows if r['review_flags']][:100])
    dump(out/'summary.json',summary);print('Fleet:',json.dumps({k:v for k,v in summary.items() if k not in ('preview','by_department')}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--california',type=Path);p.add_argument('--seattle',type=Path);p.add_argument('--download',action='store_true');a=p.parse_args()
    with tempfile.TemporaryDirectory() as temp:
        if a.download:
            a.california=Path(temp)/'california.csv';a.seattle=Path(temp)/'seattle.json'
            urlretrieve(CA_URL,a.california);urlretrieve(SEA_URL,a.seattle)
        if not a.california or not a.seattle:p.error('Provide both saved sources or --download')
        purchasing(a.california);fleet(a.seattle)

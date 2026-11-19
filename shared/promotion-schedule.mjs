export function promotionSchedule(start='',end=''){
 const valid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
 if(typeof start!=='string'||typeof end!=='string'||(start&&!valid(start))||(end&&!valid(end))||(start&&end&&start>end))throw new Error('Use valid start and end dates; end date must be on or after start date.');
 return {start,end};
}
export function promotionActive(rule,now=Date.now()){
 if(!rule)return false;
 const date=new Date(now+19800000).toISOString().slice(0,10);
 return (!rule.start||date>=rule.start)&&(!rule.end||date<=rule.end);
}

export const birthdayToday=(now=Date.now())=>new Date(Number(now)+19800000).toISOString().slice(0,10);
export function validBirthday(value,now=Date.now()){
 if(value==='')return true;
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'1900-01-01'||value>birthdayToday(now))return false;
 const date=new Date(value+'T00:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}

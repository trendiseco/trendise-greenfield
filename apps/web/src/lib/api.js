export const API_BASE=process.env.NEXT_PUBLIC_API_BASE||'http://localhost:4100';
export async function api(path,options={}) {
  const {token,...rest}=options;
  const isRead=!rest.method||rest.method==='GET';
  const timeout=isRead?AbortSignal.timeout(20000):null;
  const signal=timeout&&rest.signal?AbortSignal.any([timeout,rest.signal]):timeout||rest.signal;
  let res,payload;
  try {
    res=await fetch(`${API_BASE}${path}`,{
      ...rest,signal,
      cache:'no-store',
      headers:{...(rest.body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`}:{}),...(rest.headers||{})}
    });
    payload=await res.json();
  } catch(error) {
    if(rest.signal?.aborted)throw error;
    if(timeout?.aborted)throw new Error('TRENDISE took too long to respond. Please retry.');
    throw new Error('Could not reach the TRENDISE API. Check that the local server is running, then retry.');
  }
  if(!res.ok)throw Object.assign(new Error(payload.error||`Request failed (${res.status})`),{status:res.status,code:payload.code});
  return payload;
}
export const cash=value=>`₹${Number(value||0).toLocaleString('en-IN',{maximumFractionDigits:2,minimumFractionDigits:0})}`;
export const skuList=cart=>cart.map(x=>({sku:x.sku,qty:x.qty}));
export const uniqueKey=()=>{if(typeof crypto!=='undefined'&&crypto.randomUUID)return crypto.randomUUID();return `${Date.now()}-${Math.random()}`;};

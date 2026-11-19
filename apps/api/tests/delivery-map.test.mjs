import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createDeliveryMap,mapAddress} from '../src/delivery-map.mjs';
import {Commerce} from '../src/core.mjs';
import {createServer} from '../src/server.mjs';
const feature={properties:{countrycode:'IN',name:'Public landmark',street:'Koti Road',locality:'Koti',state:'Telangana',postcode:'500095',district:'Ward 78'},geometry:{coordinates:[78.4867,17.385]}};
test('map addresses normalize postal district without inventing missing city or house numbers',()=>{
 const address=mapAddress(feature,17.385,78.4867);
 assert.equal(address.line1,'Koti Road');assert.equal(address.city,'');assert.equal(address.district,'Hyderabad');assert.equal(address.pincode,'500095');
 assert.deepEqual(address.mapPin,{lat:17.385,lon:78.4867});
 assert.throws(()=>mapAddress({...feature,properties:{countrycode:'US'}},17.385,78.4867),{status:422});
 assert.throws(()=>mapAddress(feature,20,78),{status:422});
 assert.throws(()=>mapAddress(null,17.385,78.4867),{status:422});
});
test('lookup validates coordinates, caches results and limits requests without sending customer fields',async()=>{
 let calls=0,time=0;
 const lookup=createDeliveryMap({},async(url,options)=>{calls++;assert.equal(url.searchParams.get('lat'),'17.385');assert.equal(url.searchParams.has('phone'),false);assert.match(options.headers['User-Agent'],/TRENDISE/);return Response.json({features:[feature]});},()=>time);
 await assert.rejects(lookup('17',78),{status:400});await assert.rejects(lookup(90,78),{status:400});
 await lookup(17.385,78.4867);await lookup(17.385,78.4867);assert.equal(calls,1);
 await assert.rejects(lookup(17.386,78.4867),{status:429});
 time=1200;await lookup(17.385,78.4868);assert.equal(calls,2);
});
test('provider failure gives a retryable message and missing mapped fields stay blank',async()=>{
 const lookup=createDeliveryMap({},async()=>{throw new Error('private provider failure');});
 await assert.rejects(lookup(17.385,78.4867),error=>error.status===502&&!error.message.includes('private'));
 const address=mapAddress({...feature,properties:{countrycode:'IN'}},17.385,78.4867);
 assert.equal(address.pincode,'');assert.equal(address.district,'');assert.equal(address.city,'');
});
test('delivery map endpoint supports address lookup without changing commerce stock or orders',async()=>{
 const core=new Commerce(),before=JSON.stringify(core.stock);
 const server=createServer(core,undefined,null,undefined,async(lat,lon)=>mapAddress(feature,lat,lon));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/delivery/map-address',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lat:17.385,lon:78.4867})});
  assert.equal(response.status,200);assert.equal((await response.json()).pincode,'500095');assert.equal(core.orders.size,0);assert.equal(JSON.stringify(core.stock),before);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

export function warehousePickCode(orderId,lineIndex){return `LINE-${orderId}-${lineIndex+1}`;}
export function resolvePickLine(order,value){
 const code=String(value||'').trim();
 const line=/^LINE-(TRD-\d+)-([1-9]\d*)$/.exec(code);
 if(line?.[1]===order.id)return order.items[Number(line[2])-1];
 const legacy=/^PICK-(TRD-\d+)-([A-Z0-9-]+)$/.exec(code);
 if(legacy?.[1]===order.id)return order.items.find(i=>i.sku===legacy[2]);
}

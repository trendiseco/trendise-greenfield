export const orderStatusLabels={paid:'Confirmed',confirmed:'Confirmed',picking:'Processing',shipped:'Shipped',delivered:'Delivered',cancelled:'Cancelled'};
export const orderListLabels={all:'All orders',returns:'Returns',cancelled:'Cancelled',shipped:'Shipped',picking:'Processing','needs-review':'Needs review',confirmed:'Confirmed',delivered:'Delivered'};
export const reviewStatusLabels={requested:'Awaiting review',approved:'Approved for follow-up',rejected:'Declined'};
export function orderCases(order){
 return [
  ...(order.returnRequests||[order.returnRequest].filter(Boolean)).map(request=>({kind:'return',key:'return:'+request.sku,request})),
  ...(order.issueReport?[{kind:'issue',key:'issue',request:order.issueReport}]:[])
 ];
}

export const orderRequestStatus=request=>request.inspection?(request.inspection.decision==='pass'?'Inspection passed':'Inspection failed'):request.receivedAt?'Received by warehouse':reviewStatusLabels[request.status]||request.status;

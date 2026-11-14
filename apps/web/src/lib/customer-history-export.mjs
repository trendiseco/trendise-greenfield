const indiaDate = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'});
const indiaTime = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit'});

export function customerHistoryWorkbook(Excel, history) {
 const book = new Excel.Workbook();
 const purchases = book.addWorksheet('Purchases');
 const items = book.addWorksheet('Items');
 for (const [sheet,headers] of [
  [purchases,['Channel','Reference','Purchase date (IST)','Time (IST)','Customer','Mobile','Payment method','Status','Total (INR)','Sample']],
  [items,['Channel','Reference','Product','SKU','Colour','Size','Quantity','Unit price (INR)']]
 ]) {
  sheet.addRow(headers).font={bold:true};
  sheet.columns.forEach((column,index)=>{column.width=Math.max(16,headers[index].length+3);});
  sheet.views=[{state:'frozen',ySplit:1}];
  sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};
 }
 purchases.getColumn(6).numFmt='@';
 purchases.getColumn(9).numFmt='#,##0.00';
 items.getColumn(8).numFmt='#,##0.00';

 for (const [channel,records] of [['Store POS',history.sales],['Website',history.orders]]) {
  for (const record of records) {
   const at=new Date(record.at);
   purchases.addRow([channel,record.id,indiaDate.format(at),indiaTime.format(at),
    record.customer?.name||record.name||history.name||'',record.customer?.phone||record.phone||history.phone||'',
    record.payment?.method||record.payment,record.status||record.payment?.status,
    record.quote?.total??record.total,record.example?'Yes':'']);
   for (const line of record.items) {
    items.addRow([channel,record.id,line.name,line.sku,line.color,line.size,line.qty,line.unitPrice]);
   }
  }
 }
 return book;
}

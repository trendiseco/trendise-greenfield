// Customer ownership follows a verified identity. A delivery phone alone grants no access.
export const customerKey=session=>session.customerId??session.phone;
export const belongsToCustomer=(record,session)=>record.customerId
 ? record.customerId===session.customerId
 : !session.customerId&&record.phone===session.phone;
export const customerIdentity=session=>({
 phone:session.phone,...(session.customerId?{customerId:session.customerId}:{}),
});
export const orderCustomer=order=>({role:'customer',...customerIdentity(order)});

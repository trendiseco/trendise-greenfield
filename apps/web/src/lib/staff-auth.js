import {api} from './api';

export const staffTokenKey='trd_staff_token';

export async function signOutStaff(token=sessionStorage.getItem(staffTokenKey)){
 if(token){
  try{await api('/api/auth/staff/logout',{token,method:'POST'});}
  catch(error){if(error.status!==401)throw error;}
 }
 if(sessionStorage.getItem(staffTokenKey)===token)sessionStorage.removeItem(staffTokenKey);
}

'use client';
import {useEffect,useState} from 'react';
import {effectivePermissions,permissionGroups,reservedPermissions} from '../../../../shared/staff-access.mjs';
import {api} from '../lib/api';
import ActionFeedback from './ActionFeedback';

export default function StaffAccessEditor({access,token,save,feedback,busy}) {
 const [staff,setStaff]=useState({id:'',name:'',role:'admin',locationId:'store-hyd-01',active:true,pin:''});
 const [role,setRole]=useState('');
 const [permissions,setPermissions]=useState([]);
 const [search,setSearch]=useState('');
 const [audit,setAudit]=useState(null);
 const [auditError,setAuditError]=useState('');
 useEffect(()=>{setAudit(null);},[access]);
 const editing=access.users.some(user=>user.id===staff.id);

 function loadRole(value){
  setRole(value);
  setPermissions(effectivePermissions(value,access.roles[value]));
 }

 async function loadAudit(){
  setAuditError('');
  try{setAudit((await api('/api/admin/audit',{token})).entries);}
  catch(error){setAuditError(error.message);}
 }

 return <section className="staff-panel" id="admin-staff">
  <h2>Staff access</h2>
  <p>Set a PIN for new staff and existing custom accounts created before staff PINs were introduced.</p>
  {access.users.map(user=><div className="m02-row" key={user.id}>
   <span>{user.name} ({user.id}) · {user.role} · {user.active?'Active':'Disabled'}</span>
   <button onClick={()=>setStaff({...user,pin:''})}>Edit</button>
  </div>)}
  <button onClick={()=>setStaff({id:'',name:'',role:'admin',locationId:'store-hyd-01',active:true,pin:''})}>New staff member</button>
  <form className="m02-grid" onSubmit={event=>{
   event.preventDefault();
   save('user','Saving staff user…','/api/admin/users',staff,'Staff access saved.',()=>setStaff(previous=>({...previous,pin:''})));
  }}>
   <label>Staff ID<input required value={staff.id} onChange={event=>setStaff({...staff,id:event.target.value})}/></label>
   <label>Name<input required value={staff.name} onChange={event=>setStaff({...staff,name:event.target.value})}/></label>
   <label>Role<select value={staff.role} onChange={event=>setStaff({...staff,role:event.target.value})}>
    {Object.keys(access.roles).map(value=><option key={value}>{value}</option>)}
   </select></label>
   <label>Assigned location<select value={staff.locationId} onChange={event=>setStaff({...staff,locationId:event.target.value})}>
    {access.locations.map(location=><option value={location.id} key={location.id}>{location.name}</option>)}
   </select></label>
   <label>{editing?'New PIN (optional)':'Initial PIN'}<input type="password" autoComplete="new-password" inputMode="numeric"
    pattern="[0-9]{6,12}" required={!editing} value={staff.pin} onChange={event=>setStaff({...staff,pin:event.target.value})}/></label>
   <label><input type="checkbox" checked={staff.active} onChange={event=>setStaff({...staff,active:event.target.checked})}/>Active</label>
   <button disabled={busy}>Save staff member</button>{feedback('user')}
  </form>
  <h2>Roles & permissions</h2>
  <p>Choose an existing role to edit, or enter a new name. Supporting read access is included when an action needs it.</p>
  <div className="m02-grid">
   <label>Existing role<select value={Object.hasOwn(access.roles,role)?role:''} onChange={event=>loadRole(event.target.value)}>
    <option value="">Create a role</option>
    {Object.keys(access.roles).map(value=><option key={value}>{value}</option>)}
   </select></label>
   <label>Role name<input value={role} onChange={event=>setRole(event.target.value)} placeholder="e.g. warehouse-picker"/></label>
   <label>Search permissions<input type="search" value={search} onChange={event=>setSearch(event.target.value)}/></label>
  </div>
  <div className="m02-grid">
   {Object.entries(permissionGroups).map(([group,entries])=>{
    const visible=Object.entries(entries).filter(([key,label])=>[group,key,label].some(value=>value.toLowerCase().includes(search.trim().toLowerCase())));
    if(!visible.length)return null;
    return <fieldset key={group}><legend>{group}</legend>
     {visible.map(([key,label])=><label key={key} className="checkbox-row">
      <input type="checkbox" disabled={role==='superadmin'||reservedPermissions.includes(key)}
       checked={permissions.includes(key)} onChange={event=>setPermissions(current=>event.target.checked?[...current,key]:current.filter(value=>value!==key))}/>
      {label}{reservedPermissions.includes(key)&&' (Super Admin only)'}
     </label>)}
    </fieldset>;
   })}
  </div>
  <button disabled={busy||!role||role==='superadmin'} onClick={()=>save('role','Saving role…','/api/admin/roles',{name:role,permissions:permissions.filter(key=>!reservedPermissions.includes(key))},'Role permissions saved.')}>Save role</button>
  {feedback('role')}
  <h2>Audit log</h2>
  <button onClick={loadAudit}>Load recent activity</button>
  <ActionFeedback error={auditError}/>
  {audit&&<ul>{audit.map((entry,index)=><li key={index}>
   {entry.at} · {entry.actor||'System'} · {entry.type} · {entry.id}
   {entry.assignedRole&&<> · {entry.assignedRole} · {entry.locationId} · {entry.active?'Active':'Disabled'}</>}
   {entry.permissions&&<> · {entry.permissions.join(', ')||'No permissions'}</>}
  </li>)}</ul>}
 </section>;
}

'use client';
import StaffPortal from '../../components/StaffPortal';
import AdminWorkspace from '../admin/AdminWorkspace';

export default function SuperAdminPage() {
 return <StaffPortal portal="superadmin"><AdminWorkspace defaultSection="admin-staff"/></StaffPortal>;
}

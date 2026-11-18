import Link from 'next/link';
import {staffPortals} from '../../../../../shared/staff-access.mjs';

export const metadata = {title:'Staff sign-in | TRENDISE'};

export default function StaffLoginPage() {
 return <main className="container staff-login-page">
  <section className="staff-login-card">
   <h1>Staff sign-in</h1>
   <p>Choose your portal to continue.</p>
   <nav className="button-row staff-portal-nav" aria-label="Choose a staff portal">
    {staffPortals.map(({id,href,label})=><Link key={id} className="button button-dark" href={href}>{label}</Link>)}
   </nav>
  </section>
 </main>;
}

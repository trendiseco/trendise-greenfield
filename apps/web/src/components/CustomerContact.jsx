'use client';
import {useSite} from './SiteProvider';
import {customerContactDefaults} from '../../../../shared/customer-contact.mjs';

export default function CustomerContact(){
 const {site}=useSite();
 const {phone,email}=site.contact??customerContactDefaults;
 return <div className="about-contact-details">
  <p>Call us<br/><a className="about-text-link" href={'tel:+91'+phone}>+91 {phone}</a></p>
  <p>Email us<br/><a className="about-text-link" href={'mailto:'+email}>{email}</a></p>
 </div>;
}

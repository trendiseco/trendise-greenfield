import './globals.css';
import './storefront.css';
import './operations.css';
import {CartProvider} from '../components/CartProvider';
import {SiteProvider} from '../components/SiteProvider';
import Chrome from '../components/Chrome';
export const metadata={icons:{icon:{url:'/media/brand/trendise-icon.svg',type:'image/svg+xml'}},title:'TRENDISE | The Modern Indian Man, in Motion',description:'TRENDISE menswear — premium shirts, trousers, denim, polos and essentials. Development-only mock storefront.'};
export default function RootLayout({children}){return <html lang="en"><body><SiteProvider><CartProvider><Chrome>{children}</Chrome></CartProvider></SiteProvider></body></html>}

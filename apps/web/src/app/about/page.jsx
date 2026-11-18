import Link from 'next/link';
import './about.css';
import CustomerContact from '../../components/CustomerContact';

export const metadata={
 title:'Our story | TRENDISE',
 description:'The spirit behind TRENDISE. Menswear for work, weekends and everything in between.',
};

export default function AboutPage(){
 return <main className="trendise-about">
  <section className="about-opening" aria-labelledby="about-title">
   <div className="about-opening-copy">
    <p className="eyebrow">ABOUT TRENDISE</p>
    <h1 id="about-title">A life in motion.<br/>A style <em>of your own.</em></h1>
    <p>The best clothes become part of your story. The shirt you reach for before an important morning. The denim that settles into your weekends. The familiar feeling of looking in the mirror and recognising yourself.</p>
    <a className="about-text-link" href="#our-story">Discover our story ↓</a>
   </div>
   <figure className="about-opening-photo">
    <img src="/media/campaign-work.jpg" alt="TRENDISE menswear campaign showing contemporary everyday style" fetchPriority="high"/>
    <figcaption>THE MODERN INDIAN MAN, IN MOTION.</figcaption>
   </figure>
  </section>
  <section className="about-story" id="our-story" aria-labelledby="about-story-title">
   <p className="eyebrow">OUR POINT OF VIEW</p>
   <div><h2 id="about-story-title">You bring the character.<br/><em>We think about the clothes.</em></h2>
    <p>There is no single way to be a modern Indian man. Your days hold ambition and responsibility, old friendships and new beginnings. You move between the office and the dinner table, a crowded city and a quiet moment to yourself. Your wardrobe should make room for all of it.</p>
    <p>That is the idea at the heart of TRENDISE. Clothes that help you feel considered, comfortable and ready for the day ahead. A sharp shirt when the occasion calls for it. Easy chinos when plans change. A polo, a tee or a pair of cargos when the day belongs to you.</p>
    <p>We see personal style in the small decisions. The way a collar sits. The balance of a silhouette. A colour that feels right. The confidence of wearing something that feels like you, wherever you are going.</p>
   </div>
  </section>
  <section className="about-statement" aria-label="Our philosophy">
   <p>For the days you plan.<br/>For the moments <em>you don’t.</em></p>
   <span>TRENDISE · MADE FOR HOW YOU MOVE</span>
  </section>
  <section className="about-everyday" aria-labelledby="about-everyday-title">
   <h2 id="about-everyday-title">Make room for<br/><em>your everyday.</em></h2>
   <div><p>Our collection brings shirts, formal trousers, cotton chinos, denim, cotton cargos, polos and round-neck tees into one wardrobe. Pieces to dress up, settle into and make your own.</p>
    <p>Trends can be a starting point. The way you wear them is the story. We want TRENDISE to be part of the mornings, milestones and ordinary afternoons that make that story yours.</p>
    <Link className="about-text-link" href="/shop">Explore the collection ↗</Link>
   </div>
  </section>
  <section className="about-contact" id="contact" aria-labelledby="about-contact-title">
   <div><p className="eyebrow">CONTACT US</p><h2 id="about-contact-title">Let’s talk.</h2><p>Questions about a product, choosing your size or an order? We’d love to hear from you.</p></div>
   <CustomerContact/>
  </section>
 </main>;
}

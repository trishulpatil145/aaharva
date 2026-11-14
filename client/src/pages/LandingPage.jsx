import { Link } from 'react-router-dom';
import { Brand } from '../components/Ui';
import { useAuth } from '../contexts/AuthContext';

function FoodIllustration() {
  return <svg viewBox="0 0 540 460" className="hero-illustration" role="img" aria-label="Illustration of a food rescue box with fresh vegetables and a leaf">
    <defs><linearGradient id="boxg" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#e2bd88"/><stop offset="1" stopColor="#bd8e59"/></linearGradient><linearGradient id="leafg" x1="0" x2="1"><stop stopColor="#75a86c"/><stop offset="1" stopColor="#2c6c49"/></linearGradient></defs>
    <circle cx="282" cy="225" r="177" fill="#e8f0e5"/><circle cx="282" cy="225" r="142" fill="#d4e4d0" opacity=".52"/>
    <path d="M123 250L270 174L419 255L270 339Z" fill="#9d713e"/><path d="M123 250L270 339L270 421L123 329Z" fill="url(#boxg)"/><path d="M270 339L419 255L419 333L270 421Z" fill="#c59a65"/><path d="M123 250L270 174L419 255L270 339Z" fill="#f5e8d1" stroke="#b58b58" strokeWidth="3"/>
    <path d="M167 242L269 196L371 249L269 302Z" fill="#d7a96e"/><path d="M177 246L269 206L360 252L269 292Z" fill="#467a4d"/><path d="M199 239C185 211 198 190 228 182C231 210 222 230 199 239Z" fill="url(#leafg)"/><path d="M236 222C227 186 248 161 282 166C273 198 256 215 236 222Z" fill="#649c59"/><path d="M281 231C277 199 302 179 331 190C318 217 300 230 281 231Z" fill="#80ae68"/><path d="M228 260C204 250 198 229 211 210C233 226 239 244 228 260Z" fill="#91b86e"/>
    <path d="M299 224C302 190 327 177 351 192C338 217 318 227 299 224Z" fill="#34724a"/><circle cx="252" cy="246" r="25" fill="#d58d46"/><circle cx="252" cy="246" r="16" fill="#efb766"/><path d="M252 221L252 270M227 246L277 246M235 229L269 263M270 229L235 263" stroke="#d58d46" strokeWidth="2"/>
    <g transform="translate(65 80)"><rect x="0" y="0" width="111" height="48" rx="24" fill="#fff"/><circle cx="25" cy="24" r="13" fill="#2c6b49"/><path d="M19 24L23 28L31 19" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/><text x="47" y="29" fontSize="13" fontWeight="700" fill="#315b43">Food rescued</text></g>
    <g transform="translate(348 113) rotate(9)"><rect width="111" height="46" rx="23" fill="#fff"/><path d="M23 30C15 19 24 9 35 10C34 22 30 28 23 30Z" fill="#6b9f62"/><text x="45" y="28" fontSize="12" fontWeight="700" fill="#315b43">Less waste</text></g>
    <g transform="translate(340 358) rotate(-5)"><rect width="120" height="47" rx="23" fill="#f9fbf7" stroke="#d6e5d4"/><circle cx="24" cy="23" r="12" fill="#f1dd9d"/><path d="M19 25L23 29L30 18" stroke="#6b8047" strokeWidth="2" strokeLinecap="round"/><text x="44" y="28" fontSize="12" fontWeight="700" fill="#315b43">Shared with care</text></g>
    <path d="M83 345C101 326 113 327 127 339C115 359 97 362 83 345Z" fill="#80a96a"/><path d="M89 349L116 337" stroke="#3e794f" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}

const steps = [
  { number: '01', icon: '♧', title: 'List surplus food', description: 'Restaurants share safe, unused food with clear quantities and collection windows.' },
  { number: '02', icon: '↔', title: 'Connect with care', description: 'NGOs, school partners and rescue volunteers coordinate eligible collections.' },
  { number: '03', icon: '♡', title: 'Make it count', description: 'Track handovers, support affordable food access and learn from real outcomes.' }
];
const partners = [
  { icon: '♨', title: 'Food businesses', text: 'Donate surplus meals or offer them at a lower price.' },
  { icon: '✳', title: 'NGOs & communities', text: 'Find available donations and organize fair distribution.' },
  { icon: '↗', title: 'Rescue partners', text: 'Coordinate pickup, delivery and handover updates.' },
  { icon: '⌂', title: 'Government schools', text: 'Request supplementary food support through verified workflows.' }
];

export default function LandingPage() {
  const { user } = useAuth();
  return <div className="landing">
    <header className="landing-header"><Brand /><nav className="landing-nav"><a href="#how-it-works">How it works</a><a href="#who-its-for">Who it helps</a><Link to="/browse">Find surplus food</Link></nav><div className="landing-actions">{user ? <Link to="/dashboard" className="button button-primary">Go to workspace <span>→</span></Link> : <><Link to="/login" className="sign-in-link">Sign in</Link><Link to="/register" className="button button-primary">Join Aaharva <span>→</span></Link></>}</div></header>

    <main>
      <section className="hero-section"><div className="hero-copy"><div className="eyebrow hero-eyebrow"><span className="eyebrow-leaf">✳</span> A smarter way to share surplus</div><h1>Good food deserves<br />a <span>second chance.</span></h1><p className="hero-description">Aaharva brings food businesses, community organizations and rescue partners together to move surplus food where it can do the most good.</p><div className="hero-actions"><Link to="/register" className="button button-primary button-large">Start rescuing food <span>↗</span></Link><a href="#how-it-works" className="text-action">See how it works <span>↓</span></a></div><div className="hero-trust"><div className="trust-avatars" aria-hidden="true"><span>F</span><span>N</span><span>R</span><span>♡</span></div><p><strong>Built for community action</strong><br /><span>Every meal matters. Every partner counts.</span></p></div></div><div className="hero-art"><div className="hero-art-tag"><span className="pulse-dot" /> Local food, shared thoughtfully</div><FoodIllustration /><div className="art-footnote"><span className="art-footnote-icon">✳</span><span><strong>Rescue. Reuse. Reconnect.</strong><small>A simple step toward less food waste.</small></span></div></div>
      </section>

      <section className="promise-strip"><div><span className="promise-icon">♧</span><span><strong>Food-first, always</strong><small>Safe handling built into the flow</small></span></div><div><span className="promise-icon">⌂</span><span><strong>Made for local communities</strong><small>Designed around Indian food networks</small></span></div><div><span className="promise-icon">↗</span><span><strong>Clear from start to finish</strong><small>Track handovers and follow-up</small></span></div></section>

      <section className="how-section section-wrap" id="how-it-works"><div className="section-intro"><p className="eyebrow">A little coordination goes a long way</p><h2>Turn surplus into<br /><span>something meaningful.</span></h2><p>From a kitchen with extra portions to a community group ready to distribute them, Aaharva helps each step stay connected.</p></div><div className="steps-grid">{steps.map(step => <article className="step-card" key={step.number}><div className="step-card-top"><span className="step-icon">{step.icon}</span><span className="step-number">{step.number}</span></div><h3>{step.title}</h3><p>{step.description}</p><span className="step-line" /></article>)}</div></section>

      <section className="who-section" id="who-its-for"><div className="section-wrap"><div className="who-heading"><div><p className="eyebrow">A shared network</p><h2>Different roles.<br /><span>One common good.</span></h2></div><p>Whether you're preparing food, distributing donations or helping with a collection, your role has a place in the network.</p></div><div className="partner-grid">{partners.map((partner, index) => <article key={partner.title} className="partner-card"><span className={`partner-icon partner-icon-${index}`}>{partner.icon}</span><h3>{partner.title}</h3><p>{partner.text}</p><span className="partner-arrow" aria-hidden="true">↗</span></article>)}</div></div></section>

      <section className="safety-section section-wrap"><div className="safety-visual"><div className="safety-orbit safety-orbit-one" /><div className="safety-orbit safety-orbit-two" /><div className="safety-plate"><span>✓</span><strong>Food safety</strong><small>is part of every handover</small></div><span className="safety-spark safety-spark-one">✳</span><span className="safety-spark safety-spark-two">✳</span></div><div className="safety-copy"><p className="eyebrow">Responsible by design</p><h2>Helping food move.<br /><span>Helping trust grow.</span></h2><p>Food safety information, organization verification, delivery events and incident reporting support more responsible sharing — with authorized review at the right moments.</p><ul><li><span>✓</span> Verified partner workflows</li><li><span>✓</span> Clear collection and safe-use details</li><li><span>✓</span> Report issues and document follow-up</li></ul><Link to="/register" className="text-action text-action-green">Become a partner <span>→</span></Link></div></section>

      <section className="cta-section"><div className="cta-leaf cta-leaf-one"/><div className="cta-leaf cta-leaf-two"/><div className="cta-content"><p className="eyebrow cta-eyebrow">Ready to make a difference?</p><h2>Let's put good food<br />to good use.</h2><p>Bring your organization into a network built around sharing food responsibly.</p><Link to="/register" className="button button-light button-large">Join Aaharva <span>↗</span></Link></div><div className="cta-deco" aria-hidden="true">✳</div></section>
    </main>
    <footer className="landing-footer"><Brand /><p>Rescue Food. Reduce Waste. Nourish Lives.</p><div><a href="#how-it-works">How it works</a><Link to="/login">Sign in</Link><Link to="/register">Create an account</Link></div><small>© {new Date().getFullYear()} Aaharva. A community-led food rescue platform.</small></footer>
  </div>;
}

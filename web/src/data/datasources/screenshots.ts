/**
 * Synthetic phone screenshots for the Screenshots album + OCR demo.
 * Rendered as inline SVG so the prototype ships zero extra binary assets.
 */
import type { CameraMeta, MediaItem } from '../models';
import { emptyEdit } from '../models';

const SCREEN_CAM: CameraMeta = { model: 'Screen capture', lens: '—', iso: 0, shutter: '—', aperture: '—' };

const shell = (body: string, bg: string) => `
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="780" viewBox="0 0 360 780">
  <rect width="360" height="780" fill="${bg}"/>
  <rect x="0" y="0" width="360" height="34" fill="rgba(0,0,0,0.25)"/>
  <text x="18" y="23" font-family="sans-serif" font-size="14" fill="#fff">9:41</text>
  <circle cx="316" cy="17" r="5" fill="none" stroke="#fff" stroke-width="2"/>
  <rect x="330" y="11" width="18" height="11" rx="3" fill="none" stroke="#fff" stroke-width="1.6"/>
  <rect x="332" y="13" width="11" height="7" rx="1.5" fill="#fff"/>
  ${body}
</svg>`;

interface Shot {
  id: string;
  at: string;
  title: string;
  ocr: string;
  svg: string;
}

const SHOTS: Shot[] = [
  {
    id: 'scr-1',
    at: '2026-09-07T09:42:00',
    title: 'Payment — Harbour Coffee Co.',
    ocr: 'Payment Successful 12.40 paid to Harbour Coffee Co. Card 4417 07 Sep 2026 9:42 AM Ref 4281773399',
    svg: shell(`
      <rect x="0" y="34" width="360" height="746" fill="#0e1b12"/>
      <circle cx="180" cy="220" r="58" fill="#1d3a26"/>
      <path d="M155 220l18 18 34-36" stroke="#7ee2a8" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="180" y="330" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#eaf6ee">Payment Successful</text>
      <text x="180" y="378" text-anchor="middle" font-family="sans-serif" font-size="40" fill="#7ee2a8">$12.40</text>
      <text x="180" y="412" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#9db8a4">paid to Harbour Coffee Co.</text>
      <rect x="40" y="452" width="280" height="1" fill="#28402f"/>
      <text x="180" y="492" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#9db8a4">Card •••• 4417</text>
      <text x="180" y="520" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#9db8a4">07 Sep 2026, 9:42 AM</text>
      <text x="180" y="548" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#6f8a77">Ref 4281773399</text>
      <rect x="48" y="660" width="264" height="52" rx="26" fill="#7ee2a8"/>
      <text x="180" y="692" text-anchor="middle" font-family="sans-serif" font-size="17" fill="#0e1b12">Done</text>`, '#0e1b12'),
  },
  {
    id: 'scr-2',
    at: '2026-08-26T22:14:00',
    title: 'Chat — Emma',
    ocr: 'Emma send me the Bali photos pls you on it sending tonight 22:14',
    svg: shell(`
      <rect x="0" y="34" width="360" height="746" fill="#101a24"/>
      <rect x="0" y="34" width="360" height="58" fill="#16232f"/>
      <circle cx="38" cy="63" r="17" fill="#3b6ea5"/>
      <text x="38" y="69" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#fff">E</text>
      <text x="66" y="60" font-family="sans-serif" font-size="16" fill="#e8f0f7">Emma</text>
      <text x="66" y="78" font-family="sans-serif" font-size="12" fill="#8aa2b5">online</text>
      <rect x="120" y="150" width="210" height="52" rx="16" fill="#20455e"/>
      <text x="136" y="172" font-family="sans-serif" font-size="14" fill="#e8f0f7">send me the Bali photos</text>
      <text x="136" y="190" font-family="sans-serif" font-size="14" fill="#e8f0f7">pls 🌊</text>
      <rect x="30" y="226" width="150" height="40" rx="16" fill="#2b3947"/>
      <text x="46" y="251" font-family="sans-serif" font-size="14" fill="#dfe8f0">on it! 😄</text>
      <rect x="30" y="282" width="196" height="40" rx="16" fill="#2b3947"/>
      <text x="46" y="307" font-family="sans-serif" font-size="14" fill="#dfe8f0">sending tonight</text>
      <rect x="24" y="700" width="264" height="48" rx="24" fill="#1b2836"/>
      <text x="44" y="730" font-family="sans-serif" font-size="14" fill="#7d93a6">Message</text>
      <circle cx="320" cy="724" r="22" fill="#3b6ea5"/>
      <path d="M312 724l16-7-6 7 6 7z" fill="#fff"/>`, '#101a24'),
  },
  {
    id: 'scr-3',
    at: '2026-09-01T08:05:00',
    title: 'Boarding pass JFK → LAX',
    ocr: 'Boarding pass JFK LAX Flight 264 SkyLine Air 12 Sep 2026 Gate B22 Seat 14C Confirmed',
    svg: shell(`
      <rect x="0" y="34" width="360" height="746" fill="#f2f5f9"/>
      <rect x="0" y="34" width="360" height="66" fill="#c62828"/>
      <text x="24" y="74" font-family="sans-serif" font-size="20" fill="#fff">SkyLine Boarding Pass</text>
      <rect x="24" y="130" width="312" height="220" rx="14" fill="#ffffff"/>
      <text x="44" y="170" font-family="sans-serif" font-size="24" fill="#1c2733">JFK → LAX</text>
      <text x="44" y="200" font-family="sans-serif" font-size="14" fill="#5a6b7c">Flight 264 · SkyLine Air</text>
      <text x="44" y="238" font-family="sans-serif" font-size="16" fill="#1c2733">12 Sep 2026 · 06:15</text>
      <text x="44" y="268" font-family="sans-serif" font-size="14" fill="#5a6b7c">Booking 4521 77</text>
      <rect x="44" y="288" width="272" height="1" fill="#dbe3ea"/>
      <text x="44" y="320" font-family="sans-serif" font-size="15" fill="#1c2733">Gate B22 · Seat 14C</text>
      <rect x="232" y="300" width="84" height="30" rx="15" fill="#e6f4ea"/>
      <text x="274" y="320" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#1e7e34">CNF</text>
      <rect x="24" y="380" width="312" height="86" rx="14" fill="#ffffff"/>
      <text x="44" y="416" font-family="sans-serif" font-size="14" fill="#5a6b7c">Fare paid</text>
      <text x="44" y="444" font-family="sans-serif" font-size="20" fill="#1c2733">$286.00</text>`, '#f2f5f9'),
  },
  {
    id: 'scr-4',
    at: '2026-09-06T21:37:00',
    title: 'Now playing — Sunset Drive',
    ocr: 'Now playing Sunset Drive The Coastlines 3:42 playlist Golden hour',
    svg: shell(`
      <rect x="0" y="34" width="360" height="746" fill="#141021"/>
      <rect x="60" y="120" width="240" height="240" rx="20" fill="#372a55"/>
      <circle cx="180" cy="240" r="62" fill="#5b4a86"/>
      <circle cx="180" cy="240" r="12" fill="#141021"/>
      <text x="180" y="420" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#f1ecff">Sunset Drive</text>
      <text x="180" y="450" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#a79bc9">The Coastlines</text>
      <rect x="48" y="520" width="264" height="5" rx="2.5" fill="#3a3154"/>
      <rect x="48" y="520" width="150" height="5" rx="2.5" fill="#b39dff"/>
      <text x="48" y="548" font-family="sans-serif" font-size="12" fill="#8f84b3">2:11</text>
      <text x="312" y="548" text-anchor="end" font-family="sans-serif" font-size="12" fill="#8f84b3">3:42</text>
      <circle cx="180" cy="620" r="34" fill="#b39dff"/>
      <path d="M170 604v32l26-16z" fill="#141021"/>
      <path d="M110 606v28M98 612v16M122 612v16" stroke="#8f84b3" stroke-width="4" stroke-linecap="round"/>
      <path d="M250 606v28M238 612v16M262 612v16" stroke="#8f84b3" stroke-width="4" stroke-linecap="round"/>`, '#141021'),
  },
  {
    id: 'scr-5',
    at: '2026-09-06T07:12:00',
    title: 'Weather — Queenstown',
    ocr: 'Queenstown 14° Light rain expected tonight Humidity 78% Mon 15° Tue 12° Wed 13°',
    svg: shell(`
      <rect x="0" y="34" width="360" height="746" fill="#0d2137"/>
      <text x="180" y="130" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#dcecf9">Queenstown</text>
      <text x="180" y="230" text-anchor="middle" font-family="sans-serif" font-size="88" fill="#ffffff">14°</text>
      <text x="180" y="268" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#9dc3de">Light rain expected tonight</text>
      <text x="180" y="296" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#7ba6c4">Humidity 78%</text>
      <circle cx="212" cy="176" r="26" fill="#ffd166"/>
      <path d="M120 196a22 22 0 0 1 42-8 18 18 0 1 1 4 36h-44a18 18 0 0 1-2-28z" fill="#e8f1f8"/>
      <rect x="24" y="360" width="312" height="120" rx="16" fill="#12304c"/>
      <text x="48" y="396" font-family="sans-serif" font-size="15" fill="#bcd8ea">Mon</text><text x="288" y="396" text-anchor="end" font-family="sans-serif" font-size="15" fill="#fff">15°</text>
      <text x="48" y="430" font-family="sans-serif" font-size="15" fill="#bcd8ea">Tue</text><text x="288" y="430" text-anchor="end" font-family="sans-serif" font-size="15" fill="#fff">12°</text>
      <text x="48" y="464" font-family="sans-serif" font-size="15" fill="#bcd8ea">Wed</text><text x="288" y="464" text-anchor="end" font-family="sans-serif" font-size="15" fill="#fff">13°</text>`, '#0d2137'),
  },
  {
    id: 'scr-6',
    at: '2026-08-30T16:48:00',
    title: 'Route — Harbour Bridge Lookout',
    ocr: 'Harbour Bridge Lookout 12 min via Coastal Rd 4.2 km traffic light Start',
    svg: shell(`
      <rect x="0" y="34" width="360" height="746" fill="#e8ece4"/>
      <path d="M0 300c80-40 140 40 220 10s100-90 140-70" stroke="#ffffff" stroke-width="26" fill="none"/>
      <path d="M40 780c20-160 60-260 140-300s120-120 140-180" stroke="#ffffff" stroke-width="18" fill="none"/>
      <path d="M40 780c20-160 60-260 140-300s120-120 140-180" stroke="#4f8ef7" stroke-width="9" fill="none" stroke-linecap="round"/>
      <circle cx="40" cy="760" r="12" fill="#1f6f43"/>
      <path d="M220 300l14-26 14 26-14 10z" fill="#c62828"/>
      <circle cx="234" cy="292" r="6" fill="#fff"/>
      <rect x="16" y="420" width="328" height="180" rx="20" fill="#ffffff"/>
      <text x="36" y="462" font-family="sans-serif" font-size="21" fill="#1c2733">Harbour Bridge Lookout</text>
      <text x="36" y="496" font-family="sans-serif" font-size="26" fill="#1f6f43">12 min</text>
      <text x="130" y="496" font-family="sans-serif" font-size="15" fill="#5a6b7c">via Coastal Rd</text>
      <text x="36" y="528" font-family="sans-serif" font-size="15" fill="#5a6b7c">4.2 km · traffic light</text>
      <rect x="36" y="548" width="288" height="40" rx="20" fill="#4f8ef7"/>
      <text x="180" y="574" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#fff">Start</text>`, '#e8ece4'),
  },
];

export function buildScreenshotItems(): MediaItem[] {
  return SHOTS.map((s) => ({
    id: s.id,
    kind: 'screenshot' as const,
    src: `data:image/svg+xml;utf8,${encodeURIComponent(s.svg)}`,
    w: 360,
    h: 780,
    bytes: Math.round(s.svg.length * 0.42),
    takenAt: new Date(s.at).getTime(),
    title: s.title,
    folder: 'Screenshots',
    place: 'Home',
    camera: SCREEN_CAM,
    ocr: s.ocr,
    favorite: false,
    trashedAt: null,
    locked: false,
    hidden: false,
    edits: emptyEdit(),
  }));
}

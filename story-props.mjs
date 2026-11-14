/**
 * Independent SVG foreground overlays for the approved Streaming Pivot art.
 * These are decorative environment cues, not decision hints or economics.
 * Kept as SVG so each prop can be animated separately without new downloads.
 */
const DRAWINGS = Object.freeze({
  envelope: '<svg viewBox="0 0 100 76" fill="none" aria-hidden="true"><rect x="8" y="11" width="84" height="54" rx="7" fill="#FFF5DB" fill-opacity=".92" stroke="#13DD13" stroke-width="3"/><path d="M9 17 50 47 91 17" stroke="#0E421B" stroke-width="3" stroke-linecap="round"/><path d="M10 63 35 42M90 63 65 42" stroke="#B0C6A8" stroke-width="2"/></svg>',
  terminal: '<svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><rect x="12" y="9" width="76" height="62" rx="8" fill="#0A2017" fill-opacity=".95" stroke="#13DD13" stroke-width="4"/><path d="M25 49 40 33l13 10 23-20" stroke="#83FF9A" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 71v13M32 85h36" stroke="#CEFDC8" stroke-width="5" stroke-linecap="round"/></svg>',
  documents: '<svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M25 9h42l13 15v64H25z" fill="#DDF4E1" fill-opacity=".87" stroke="#3DE84A" stroke-width="3"/><path d="M67 9v17h13M37 42h29M37 53h29M37 64h19" stroke="#286A42" stroke-width="3" stroke-linecap="round"/></svg>',
  beacon: '<svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M42 31v-9a8 8 0 0 1 16 0v9" stroke="#FF9A42" stroke-width="4"/><path d="M32 55a18 18 0 0 1 36 0v17H32z" fill="#FF9A42" fill-opacity=".72" stroke="#FFB460" stroke-width="4"/><rect x="21" y="72" width="58" height="10" rx="4" fill="#FFDD94"/><path d="M12 35 3 28M85 36l10-8M50 9V1" stroke="#FCE2A8" stroke-width="4" stroke-linecap="round"/></svg>',
  server: '<svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><rect x="18" y="9" width="64" height="83" rx="7" fill="#091B17" fill-opacity=".9" stroke="#43E96B" stroke-width="3"/><path d="M25 30h50M25 51h50M25 72h50" stroke="#7DA99C" stroke-width="2"/><circle cx="33" cy="20" r="4" fill="#13DD13"/><circle cx="33" cy="41" r="4" fill="#13DD13"/><circle cx="33" cy="62" r="4" fill="#FF923B"/><path d="M47 21h23M47 42h23M47 63h23" stroke="#B5F7D4" stroke-width="3" stroke-linecap="round"/></svg>',
  crate: '<svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M14 28 50 10l36 18v48L50 94 14 76z" fill="#443021" fill-opacity=".8" stroke="#E5A45C" stroke-width="3"/><path d="M14 28 50 46l36-18M50 46v48M33 19l36 18-14 7-36-18" stroke="#EEC293" stroke-width="3"/></svg>',
  spotlight: '<svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M36 11h28l9 19-23 8-23-8z" fill="#2E2B43" stroke="#B9A6FF" stroke-width="3"/><path d="M50 39 12 94h76z" fill="#CEB0FF" fill-opacity=".16"/><path d="M50 40v50" stroke="#DDC9FF" stroke-opacity=".6" stroke-width="2"/></svg>',
  screen: '<svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><rect x="7" y="13" width="86" height="62" rx="7" fill="#0E1327" fill-opacity=".89" stroke="#A985FF" stroke-width="3"/><circle cx="36" cy="42" r="13" fill="#A985FF" fill-opacity=".42"/><path d="M52 39h24M52 51h17" stroke="#DACDFF" stroke-width="3" stroke-linecap="round"/><path d="M50 75v12M30 87h40" stroke="#A985FF" stroke-width="4" stroke-linecap="round"/></svg>',
  ticket: '<svg viewBox="0 0 100 76" fill="none" aria-hidden="true"><path d="M10 15h80v18a11 11 0 0 0 0 22v9H10V55a11 11 0 0 0 0-22z" fill="#262139" fill-opacity=".85" stroke="#AE8CFF" stroke-width="3"/><path d="M53 20v7m0 7v7m0 7v10" stroke="#BDA8FF" stroke-width="3" stroke-dasharray="3 4"/><path d="M22 30h20M22 39h14" stroke="#E6D9FF" stroke-width="3" stroke-linecap="round"/></svg>',
  coin: '<svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><circle cx="50" cy="50" r="36" fill="#206E28" fill-opacity=".7" stroke="#B5FB76" stroke-width="5"/><circle cx="50" cy="50" r="24" stroke="#13DD13" stroke-width="3"/><path d="M58 36H45a13 13 0 0 0 0 28h13V51H48" stroke="#E5FFD7" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
});
const LAYOUTS = Object.freeze({
  intro: [['envelope',15,29,70,-14],['terminal',73,23,85,7],['envelope',47,47,55,9]],
  'decision-01': [['documents',17,25,76,-8],['terminal',72,24,85,6],['documents',54,44,51,12]],
  'decision-02': [['screen',16,25,83,-12],['beacon',77,31,65,9],['ticket',44,43,63,12]],
  'decision-03': [['crate',13,31,78,-12],['server',76,22,89,7],['crate',52,46,61,8]],
  'decision-04': [['spotlight',18,22,78,-8],['documents',78,31,76,9],['screen',52,43,58,6]],
  'result-strong': [['coin',15,25,66,-14],['coin',75,27,82,13],['terminal',47,42,65,5]],
  'result-steady': [['envelope',19,31,66,-8],['server',75,28,73,6],['documents',50,45,52,9]],
  'result-rough': [['beacon',18,25,73,-8],['server',77,30,76,8],['documents',50,46,59,-6]],
  'result-collapse': [['crate',17,39,75,-12],['documents',77,35,70,12],['beacon',46,48,48,0]]
});
export const PIVOT_PROP_KEYS = Object.freeze(Object.keys(LAYOUTS));
export function propsForScene(key) {
  return (LAYOUTS[key] || []).map(([kind,x,y,size,tilt],i)=>({kind,x,y,size,tilt,order:i}));
}
export function storyProps(key) {
  const props = propsForScene(key);
  if (!props.length) return '';
  const elements = props.map(p =>
    '<span class="stage-prop" data-prop="' + p.kind + '" style="--prop-x:' + p.x +
    '%;--prop-y:' + p.y + '%;--prop-size:' + p.size + 'px;--prop-tilt:' + p.tilt +
    'deg;--prop-order:' + p.order + '"><span class="stage-prop-inner">' +
    DRAWINGS[p.kind] + '</span></span>').join('');
  return '<div class="stage-layer stage-props" aria-hidden="true">' + elements + '</div>';
}

/**
 * Brand Backlash decorative business objects, each an independent visual
 * layer. All objects are generic/unbranded and cannot reveal correct choices.
 */
const shapes=Object.freeze({
  bottle:'<svg viewBox="0 0 90 120" aria-hidden="true"><path d="M35 5h20v20l7 13v60q0 14-17 14T28 98V38l7-13z" fill="#145231" fill-opacity=".78" stroke="#9AF1A1" stroke-width="3"/><path d="M30 59h30v25H30z" fill="#F4E9CE" fill-opacity=".85"/><path d="M33 12h24" stroke="#B2FAC7" stroke-width="4"/></svg>',
  glass:'<svg viewBox="0 0 90 110" aria-hidden="true"><path d="M20 16h50l-7 65H27z" fill="#A7E8DB" fill-opacity=".2" stroke="#A7E8DB" stroke-width="3"/><path d="M26 46h38l-4 30H30z" fill="#AD6835" fill-opacity=".63"/><path d="M45 83v16m-20 0h40" stroke="#D8F5E1" stroke-width="3"/></svg>',
  crate:'<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M14 24h72v59H14z" fill="#423120" fill-opacity=".86" stroke="#F4B86E" stroke-width="4"/><path d="M19 30 81 76m0-46L19 76M19 30h62M18 77h64" fill="none" stroke="#FFD49B" stroke-width="3"/></svg>',
  cart:'<svg viewBox="0 0 120 98" aria-hidden="true"><path d="M10 10h14l10 60h64l13-46H30" stroke="#B1E9C3" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M39 30h62l-10 34H44z" fill="#0E572E" fill-opacity=".5" stroke="#13DD13" stroke-width="3"/><circle cx="50" cy="84" r="7" fill="#E9E7CA"/><circle cx="91" cy="84" r="7" fill="#E9E7CA"/></svg>',
  camera:'<svg viewBox="0 0 110 100" aria-hidden="true"><rect x="10" y="24" width="79" height="54" rx="8" fill="#27293B" stroke="#CAA5FF" stroke-width="4"/><circle cx="54" cy="51" r="19" fill="#17162A" stroke="#BDA2FF" stroke-width="4"/><circle cx="54" cy="51" r="9" fill="#5A2B7E"/><path d="M89 39 104 28v46L89 62" fill="#3A3153" stroke="#CAB4FF" stroke-width="3"/></svg>',
  mic:'<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="38" y="10" width="24" height="45" rx="12" fill="#383B4F" stroke="#E3BEFF" stroke-width="4"/><path d="M28 38v10a22 22 0 0 0 44 0V38M50 72v16m-17 0h34" fill="none" stroke="#D7C3E9" stroke-width="4" stroke-linecap="round"/></svg>',
  folder:'<svg viewBox="0 0 110 95" aria-hidden="true"><path d="M8 26h41l11 11h42v46H8z" fill="#B17A40" fill-opacity=".9" stroke="#FFE2AB" stroke-width="3"/><path d="M8 26V15h38l8 11" stroke="#FFE2AB" stroke-width="4" fill="none"/></svg>',
  spark:'<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 6 59 40 94 50 59 59 50 94 41 59 6 50 41 40Z" fill="#13DD13" fill-opacity=".4" stroke="#B4FA91" stroke-width="3"/></svg>'
});
const placements=Object.freeze({
  intro:[['bottle',21,32,69,-9],['glass',74,39,55,10],['bottle',50,21,54,7]],
  'decision-01':[['glass',20,32,60,-10],['bottle',76,28,75,8],['folder',52,44,55,-5]],
  'decision-02':[['cart',17,33,68,-6],['crate',75,34,70,9],['bottle',51,44,54,-5]],
  'decision-03':[['camera',15,34,74,-8],['mic',78,26,67,6],['folder',53,46,54,9]],
  'decision-04':[['mic',19,31,74,-9],['camera',77,27,67,8],['folder',50,43,53,-5]],
  'result-strong':[['spark',19,31,72,-9],['bottle',75,35,73,6],['glass',48,45,58,-7]],
  'result-steady':[['bottle',19,33,70,-10],['folder',75,32,63,9],['crate',50,43,55,-7]],
  'result-rough':[['folder',17,35,71,-8],['crate',78,27,73,7],['bottle',50,45,51,6]],
  'result-collapse':[['crate',21,39,70,-10],['bottle',75,36,72,8],['folder',50,44,51,5]]
});
export const BRAND_PROP_KEYS=Object.freeze(Object.keys(placements));
export function brandProps(key){
 const props=placements[key]||[];
 if(!props.length)return '';
 return '<div class="stage-layer stage-props" aria-hidden="true">'+props.map(([type,x,y,size,tilt],order)=>
   '<span class="stage-prop" data-prop="'+type+'" style="--prop-x:'+x+'%;--prop-y:'+y+'%;--prop-size:'+size+'px;--prop-tilt:'+tilt+'deg;--prop-order:'+order+'"><span class="stage-prop-inner">'+shapes[type]+'</span></span>'
 ).join('')+'</div>';
}

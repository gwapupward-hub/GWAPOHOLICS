/** Lightweight independent environmental silhouettes for Season 1 episodes.
 * Purely decorative. No business outcome hint or user input interception.
 */
const svgs=Object.freeze({
 container:'<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M12 29 52 17l36 12v53L52 92 12 81z" fill="#144A40" fill-opacity=".8" stroke="#9CFBC9" stroke-width="3"/><path d="M52 17v75M24 31v45M36 27v50M66 25v59M79 29v52" stroke="#6ED6B3" stroke-width="2"/></svg>',
 parcel:'<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M14 28 50 10l36 18v51L50 95 14 79z" fill="#A27338" fill-opacity=".8" stroke="#F9D29F" stroke-width="3"/><path d="M14 28 50 47l36-19M50 47v48" fill="none" stroke="#FFE0AE" stroke-width="3"/></svg>',
 phone:'<svg viewBox="0 0 85 110" aria-hidden="true"><rect x="17" y="5" width="51" height="99" rx="11" fill="#102A24" stroke="#88EFB2" stroke-width="4"/><rect x="24" y="18" width="37" height="64" rx="4" fill="#13DD13" fill-opacity=".26"/><circle cx="42" cy="94" r="4" fill="#D7F7DE"/></svg>',
 dock:'<svg viewBox="0 0 120 110" aria-hidden="true"><path d="M25 100V16h70v84M16 16h88M25 45h70M25 72h70" fill="none" stroke="#E5AB67" stroke-width="7"/><path d="M39 28h42M39 58h42M39 87h42" stroke="#A36B39" stroke-width="3"/></svg>',
 laptop:'<svg viewBox="0 0 115 95" aria-hidden="true"><rect x="16" y="8" width="83" height="59" rx="6" fill="#0A211C" stroke="#90F9AF" stroke-width="4"/><path d="M8 77h99l-12 12H21z" fill="#2C463B" stroke="#90F9AF" stroke-width="3"/><path d="M31 47 45 36l13 9 18-19" fill="none" stroke="#13DD13" stroke-width="4"/></svg>',
 stopwatch:'<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="57" r="34" fill="#30243F" fill-opacity=".75" stroke="#C7A8FF" stroke-width="4"/><path d="M50 28v29l18 10M40 9h20M50 9v12" stroke="#DBC5FF" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
 contract:'<svg viewBox="0 0 100 110" aria-hidden="true"><path d="M20 9h49l13 13v79H20z" fill="#EFE6CF" fill-opacity=".9" stroke="#FAD399" stroke-width="3"/><path d="M69 9v14h13M32 46h37M32 60h37M32 74h24" fill="none" stroke="#A87E50" stroke-width="3" stroke-linecap="round"/></svg>',
 lantern:'<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="47" r="25" fill="#FF993B" fill-opacity=".32" stroke="#FFCB8A" stroke-width="4"/><path d="M42 20v-8h16v8M42 72h16M50 73v16" stroke="#FFE1B5" stroke-width="4" fill="none"/></svg>',
 basket:'<svg viewBox="0 0 120 110" aria-hidden="true"><path d="M20 44h80L89 93H31z" fill="#6B4B35" fill-opacity=".8" stroke="#EFC090" stroke-width="4"/><path d="M42 45 57 18l20 27M37 60h46M42 74h36" stroke="#EFC090" stroke-width="4" fill="none"/></svg>',
 safe:'<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="13" y="17" width="74" height="66" rx="6" fill="#34433E" stroke="#A5BEB1" stroke-width="4"/><circle cx="50" cy="50" r="19" fill="#193027" stroke="#90E3BA" stroke-width="4"/><path d="M50 34v32M34 50h32" stroke="#C5F6D6" stroke-width="3"/></svg>',
 clock:'<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="38" fill="#2B2935" fill-opacity=".7" stroke="#E7BF84" stroke-width="5"/><path d="M50 20v30l21 11" fill="none" stroke="#FFF0C9" stroke-width="5" stroke-linecap="round"/></svg>',
 portfolio:'<svg viewBox="0 0 110 100" aria-hidden="true"><path d="M15 22h80v63H15z" fill="#5B432A" fill-opacity=".88" stroke="#D5BB8C" stroke-width="3"/><path d="M35 22v-11h40v11M31 65 48 53l16 6 17-21" stroke="#A9FBC1" stroke-width="4" fill="none"/></svg>'
});
const table=Object.freeze({
 'supply-shock':['container','parcel','phone','dock'],
 'founder-runway':['laptop','stopwatch','contract','lantern'],
 'inflation-trap':['clock','safe','basket','portfolio']
});
const keys=Object.freeze(['intro','decision-01','decision-02','decision-03','decision-04','result-strong','result-steady','result-rough','result-collapse']);
export function seasonProps(caseId,key){
 const types=table[caseId],index=keys.indexOf(key);
 if(!types||index<0)return '';
 const pos=[[17,31,-8],[79,29,9],[49,44,5]];
 return '<div class="stage-layer stage-props" aria-hidden="true">'+pos.map(([x,y,tilt],order)=>{
  const type=types[(index+order)%types.length];
  return '<span class="stage-prop" data-prop="'+type+'" style="--prop-x:'+x+'%;--prop-y:'+y+'%;--prop-size:'+(order===2?55:70)+'px;--prop-tilt:'+tilt+'deg;--prop-order:'+order+'"><span class="stage-prop-inner">'+svgs[type]+'</span></span>';
 }).join('')+'</div>';
}
export const SEASON_PROP_CASE_IDS=Object.freeze(Object.keys(table));
export const SEASON_PROP_SCENES=keys;

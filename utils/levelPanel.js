'use strict';
const DEFAULTS={hideXP:false,hideLevel:false,hideRank:false,hideRole:false,hideStreak:false,color:'#7A5CFF',bar:'blocks',nickname:''};
const STYLES={blocks:['🟪','⬛'],mint:['🟩','⬛'],ice:['🟦','⬛'],hearts:['💜','🖤'],classic:['▰','▱'],dots:['●','○']};
function settings(value={}){
    const s={...DEFAULTS};
    for(const key of ['hideXP','hideLevel','hideRank','hideRole','hideStreak'])s[key]=value[key]===true;
    if(/^#[0-9a-f]{6}$/i.test(value.color||''))s.color=value.color;
    if(STYLES[value.bar])s.bar=value.bar;
    s.nickname=String(value.nickname||'').replace(/[\r\n\t\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,32);
    return s;
}
function bar(percent,style){const [full,empty]=STYLES[style]||STYLES.blocks;const count=Math.round(Math.max(0,Math.min(100,percent))/10);return full.repeat(count)+empty.repeat(10-count);}
module.exports={DEFAULTS,STYLES,settings,bar};

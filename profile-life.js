(() => {
  'use strict';
  function dateFields(profile) {
    const boxes = [profile?.infobox,profile?.metadata?.infobox].filter(Boolean);
    const map = {};
    boxes.forEach(box => {
      if (Array.isArray(box)) box.forEach(row => { const key=row?.key||row?.label||row?.name; if(key) map[String(key).toLowerCase().replace(/[^a-z]/g,'')]=row.value; });
      else Object.entries(box).forEach(([key,value]) => { map[key.toLowerCase().replace(/[^a-z]/g,'')]=value; });
    });
    return map;
  }
  function yearOf(value) { const match=String(value||'').match(/(?<!\d)(\d{4})(?!\d)/); return match?Number(match[1]):null; }
  function lifeRange(profile) {
    const fields=dateFields(profile), first=(...keys)=>keys.map(key=>fields[key.replace(/[^a-z]/gi,'').toLowerCase()]??profile?.[key]??profile?.metadata?.[key]).find(value=>value!==undefined&&value!==null&&String(value).trim());
    const text=String(profile?.description||'');
    const pair=text.match(/[([]\s*(?:ur\.?\s*)?(\d{4})(?:\s*[–—-]\s*(\d{4}))?\s*[)\]]/i)||text.match(/ur(?:odzony|\.)?\s*(\d{4}).{0,100}?(?:zm(?:arł|arła|\.)|†)\s*(\d{4})/i);
    return {birth:yearOf(first('birthDate','birth_date','born','birth','dateOfBirth','yearOfBirth'))||Number(pair?.[1])||null,death:yearOf(first('deathDate','death_date','died','death','dateOfDeath','yearOfDeath'))||Number(pair?.[2])||null};
  }
  function matchesYear(profile, raw) {
    const value=String(raw||'').trim(); if(!value)return true;
    const match=value.match(/^(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?$/); if(!match)return false;
    const a=Number(match[1]),b=Number(match[2]||match[1]),from=Math.min(a,b),to=Math.max(a,b),life=lifeRange(profile);
    return !!life.birth&&life.birth<=to&&(life.death||Infinity)>=from;
  }
  window.NeoProfileLife={lifeRange,matchesYear,isValidYearQuery:value=>!String(value||'').trim()||/^(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?$/.test(String(value).trim())};
})();

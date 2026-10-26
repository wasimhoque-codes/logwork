export type Page = 'today'|'programme'|'progress'|'progress/history'|'progress/movement'|'progress/volume'|'progress/bodyweight'|'progress/recovery'|'settings'|'workout'|'workout/review'|'workout/saved';
const pages:Page[]=['today','programme','progress','progress/history','progress/movement','progress/volume','progress/bodyweight','progress/recovery','settings','workout','workout/review','workout/saved'];
export function resolvePage(hash:string):Page {
  const value=hash.replace(/^#/,'');
  const alias:Record<string,Page>={plan:'programme',insights:'progress',history:'progress/history'};
  return alias[value]??(pages.includes(value as Page)?value as Page:'today');
}
export const pageTitles:Record<Page,string>={today:'Today',programme:'Programme',progress:'Progress','progress/history':'Progress','progress/movement':'Movement','progress/volume':'Training volume','progress/bodyweight':'Bodyweight','progress/recovery':'Recovery',settings:'Settings',workout:'Workout','workout/review':'Review workout','workout/saved':'Workout saved'};

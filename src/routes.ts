export const programmeDays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;
export type ProgrammePage = `programme/${typeof programmeDays[number]}`;
export type Page = 'today'|'programme'|ProgrammePage|'progress'|'progress/exercises'|'progress/history'|'progress/movement'|'progress/volume'|'progress/bodyweight'|'settings'|'workout'|'workout/review'|'workout/saved';
export const programmePage = (day: number): ProgrammePage => `programme/${programmeDays[((day % 7) + 7) % 7]}`;
export const programmeDay = (page: Page): number | undefined => {
  const day = programmeDays.findIndex(value => page === `programme/${value}`);
  return day < 0 ? undefined : day;
};
const pages:Page[]=['today','programme',...programmeDays.map((_,day)=>programmePage(day)),'progress','progress/exercises','progress/history','progress/movement','progress/volume','progress/bodyweight','settings','workout','workout/review','workout/saved'];
export function resolvePage(hash:string):Page {
  const value=hash.replace(/^#/,'').split('?')[0];
  const alias:Record<string,Page>={plan:'programme',insights:'progress',history:'progress/history','progress/recovery':'progress'};
  return alias[value]??(pages.includes(value as Page)?value as Page:value.startsWith('programme/')?'programme':'today');
}
export const pageTitles:Record<Page,string>={today:'Today',programme:'Programme','programme/monday':'Programme','programme/tuesday':'Programme','programme/wednesday':'Programme','programme/thursday':'Programme','programme/friday':'Programme','programme/saturday':'Programme','programme/sunday':'Programme',progress:'Progress','progress/exercises':'Progress','progress/history':'Progress','progress/movement':'Movement','progress/volume':'Training volume','progress/bodyweight':'Bodyweight',settings:'Settings',workout:'Workout','workout/review':'Review workout','workout/saved':'Workout saved'};

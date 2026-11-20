import { test, expect } from './fixture';
import { fixedWorkoutForDay } from '../../src/data';
import { freshStore, newSession, toKg, type Store } from '../../src/model';

for(const unit of ['kg','lb'] as const){
  test(`logs added dip weight in ${unit} and retains it after reload`,async({page})=>{
    const store=freshStore();store.settings.unit=unit;
    store.active=newSession(fixedWorkoutForDay(4,store.programme.options)!,store);
    store.active.resume!.exerciseIndex=3;
    await page.addInitScript(raw=>{
      if(!sessionStorage.getItem('seeded')){
        localStorage.setItem('gym-hawk-v4',raw);sessionStorage.setItem('seeded','yes');
      }
    },JSON.stringify(store));
    await page.goto('/#workout');
    await expect(page.getByRole('heading',{name:'Weighted Dips',exact:true})).toBeVisible();
    const weight=page.getByLabel(`Set 1 weight in ${unit}`);
    await expect(weight).toHaveValue('');await weight.fill('10');
    await page.getByLabel('Set 1 reps',{exact:true}).fill('8');
    await page.getByRole('button',{name:'Log set 1',exact:true}).click();
    const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('gym-hawk-v4')!) as Store);
    await expect.poll(async()=>((await saved()).active?.exercises[3].sets[0].done)).toBe(true);
    expect((await saved()).active!.exercises[3].sets[0].weight).toBeCloseTo(toKg(10,unit));
    await page.reload();
    await expect(page.getByRole('heading',{name:'Weighted Dips',exact:true})).toBeVisible();
    expect((await saved()).active!.exercises[3].sets[0]).toMatchObject({done:true,reps:8});
    await page.locator('.logged-sets summary').click();
    await expect(page.locator('.logged-sets')).toContainText(`10 ${unit}`);
  });
}

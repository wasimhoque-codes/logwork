import { test, expect, openSetOptions, setAction } from './fixture';
import { freshStore, selectedWorkout, newSession } from '../../src/model';

for (const [width,height] of [[320,568],[390,844],[430,932],[1440,1000]]) {
  test(`visible sets and completion remain usable at ${width}px`,async({page},testInfo)=>{
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:'reduce'});
    const store=freshStore();
    store.active=newSession(selectedWorkout(store,4)!,store);
    const exercise=store.active.exercises[0];
    const last=newSession(selectedWorkout(store,4)!,store);
    last.id='previous-workout';last.startedAt-=86400000;last.endedAt=last.startedAt+60000;
    last.exercises[0].sets.forEach(set=>Object.assign(set,{weight:35,reps:6,done:true}));
    store.sessions=[last];
    await page.addInitScript(value=>localStorage.setItem('gym-hawk-v4',value),JSON.stringify(store));
    await page.goto('/#workout');
    const rows=page.locator('.workout-set');
    const current=page.getByRole('group',{name:'Current working set'});
    const dock=page.locator('.workout-dock');
    await expect(rows).toHaveCount(exercise.sets.length);
    await expect(current).toContainText('Last time');
    await expect(current).toContainText('35 kg assistance × 6 reps');
    await expect(rows.last()).toContainText('Suggested');
    if(width>=390){
      const lastRow=await rows.last().boundingBox(), action=await dock.boundingBox();
      expect(lastRow!.y+lastRow!.height).toBeLessThan(action!.y);
      expect(await page.evaluate(()=>window.scrollY)).toBe(0);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`logging-${width}.png`),animations:'disabled',scale:'css'});
    await page.getByLabel('Set 1 assistance in kg').fill('30');
    await page.getByRole('button',{name:'Log set 1',exact:true}).click();
    await expect(rows.first()).toHaveClass(/is-logged/);
    await expect(rows.first()).toContainText('30 kg');
    await expect(page.getByRole('group',{name:'Rest timer'})).toBeVisible();
    await setAction(page,1,'Edit');
    await page.getByLabel('Set 1 assistance in kg').fill('20');
    await page.getByRole('button',{name:'Cancel edit',exact:true}).click();
    await expect(rows.first()).toContainText('30 kg');
    for(let index=1;index<exercise.sets.length;index++){
      await page.getByRole('button',{name:`Log set ${index+1}`,exact:true}).click();
    }
    await expect(page.getByRole('heading',{name:'Exercise complete',exact:true})).toBeVisible();
    await expect(page.getByRole('region',{name:'Next exercise preview'})).toContainText(store.active.exercises[1].name);
    await expect(rows).toHaveCount(exercise.sets.length);
    await expect(page.locator('.workout-set.is-logged')).toHaveCount(exercise.sets.length);
    await expect(page.getByRole('heading',{name:exercise.name,exact:true})).toBeVisible();
    const preview=await page.getByRole('region',{name:'Next exercise preview'}).boundingBox(), restDock=await dock.boundingBox();
    expect(preview!.y+preview!.height).toBeLessThanOrEqual(restDock!.y);
    if(width>=390)expect((await page.getByRole('heading',{name:exercise.name,exact:true}).boundingBox())!.y).toBeGreaterThanOrEqual(0);
    await page.screenshot({path:testInfo.outputPath(`complete-${width}.png`),animations:'disabled',scale:'css'});
    await page.getByRole('button',{name:'Undo last set'}).click();
    await expect(current).toBeFocused();
    await expect(page.getByRole('region',{name:'Next exercise preview'})).toHaveCount(0);
    await openSetOptions(page,exercise.sets.length);
    await page.getByRole('button',{name:'Skip set',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Exercise reviewed'})).toBeVisible();
    await expect(page.locator('.workout-completion')).toContainText('1 skipped');
    await page.getByRole('button',{name:'Next exercise',exact:true}).click();
    await expect(page.getByRole('heading',{name:store.active.exercises[1].name,exact:true})).toBeVisible();
    await expect(page.getByRole('group',{name:'Rest timer'})).toBeVisible();
  });
}

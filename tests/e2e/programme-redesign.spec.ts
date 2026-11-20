import { expect, test, workoutResource, type Page } from './fixture';
import { freshStore, newSession, validateStore, type Store } from '../../src/model';
import { fixedWorkoutForDay } from '../../src/data';
import { programmeDays } from '../../src/routes';

const names = ['Upper A','Lower A','Active recovery','Upper B','Lower B','Upper C','Rest day'];
const dismiss = async (page: Page) => {
  await page.getByRole('dialog').getByRole('button',{name:'Close dialog',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
};
const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('gym-hawk-v4')!) as Store);
async function seed(page: Page, store: Store) {
  await page.addInitScript(raw=>{if(!sessionStorage.getItem('programme-seeded')){localStorage.setItem('gym-hawk-v4',raw);sessionStorage.setItem('programme-seeded','yes');}},JSON.stringify(store));
}

test('the recurring overview opens all seven sessions without changing training records', async ({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-20T12:00:00Z'));
  await page.goto('/#plan');
  const week=page.getByRole('list',{name:'Weekly programme'});
  await expect(week.getByRole('link')).toHaveCount(7);
  await expect(week.getByRole('link',{name:'Friday Lower B'})).toHaveAttribute('data-today','true');
  await expect(week.getByRole('link',{name:'Saturday Upper C'})).toContainText('6 exercises · 6 working sets');
  const before=await read(page);
  for(let day=0;day<7;day++) {
    await week.getByRole('link').nth(day).click();
    await expect(page).toHaveURL(new RegExp(`#programme/${programmeDays[day]}$`));
    await page.reload();
    await expect(page.getByRole('heading',{name:names[day],exact:true})).toBeVisible();
    await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Programme',exact:true})).toHaveAttribute('aria-current','page');
    if(day===2||day===6) {
      await expect(page.getByRole('button',{name:'Start workout',exact:true})).toHaveCount(0);
      await expect(page.getByRole('list',{name:'Optional rest-day activities'})).toContainText('MobilityRunningWalking');
    }
    await page.getByRole('button',{name:'Back to programme'}).click();
  }
  expect(await read(page)).toEqual(before);
  await page.goto('/#programme/not-a-day');
  await expect(page).toHaveURL(/#programme$/);
});

test('session navigation restores scroll, focus, browser history and settings origin',async({page})=>{
  await page.setViewportSize({width:390,height:700});
  await page.goto('/#programme');
  const saturday=page.getByRole('link',{name:'Saturday Upper C',exact:true});
  await saturday.scrollIntoViewIfNeeded();
  await saturday.focus();
  const scroll=await page.evaluate(()=>window.scrollY);
  await saturday.press('Enter');
  await expect(page.getByRole('heading',{name:'Upper C',exact:true})).toBeVisible();
  await page.goBack();
  await expect(saturday).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(scroll);
  await page.goForward();
  await expect(page).toHaveURL(/#programme\/saturday$/);
  await page.getByRole('button',{name:'Open settings'}).click();
  await page.getByRole('button',{name:'Go back',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Upper C',exact:true})).toBeVisible();
});

test('Upper C settings preview, cancel, save and start with the resolved prescription',async({page})=>{
  await page.goto('/#programme/saturday');
  const open=()=>page.getByRole('button',{name:'Upper C settings',exact:true}).click();
  await open();
  await page.getByRole('radio',{name:/^Two sets/}).check();
  await page.getByRole('radio',{name:/^Dead Bug/}).check();
  await expect(page.getByRole('status',{name:'Upper C preview'})).toContainText('7 exercises · 14 working sets');
  await dismiss(page);
  await open();
  await expect(page.getByRole('radio',{name:/^One set/})).toBeChecked();
  await expect(page.getByRole('radio',{name:/^No additional core work/})).toBeChecked();
  await page.getByRole('radio',{name:/^Two sets/}).check();
  await page.getByRole('radio',{name:/^Dead Bug/}).check();
  await page.getByRole('button',{name:'Save settings'}).click();
  await page.reload();
  await expect(page.getByRole('region',{name:'Session overview'})).toContainText('14');
  await expect(page.locator('.programme-exercise')).toHaveCount(7);
  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  await expect(page.getByRole('group',{name:'Current working set'})).toContainText('Set 1 of 2');
  const store=await read(page);
  expect(store.active!.exercises).toHaveLength(7);
  expect(store.active!.workout.exercises.at(-1)!.id).toBe('p16-dead-bug');
  validateStore(store);
});

test('warm-up drafts stay with their session and carry into logging',async({page})=>{
  await page.goto('/#programme/monday');
  await page.getByRole('button',{name:/First, find your rhythm/}).click();
  await page.getByRole('dialog').getByRole('checkbox').first().check();
  await expect(page.getByRole('status')).toContainText('1 of 7 steps checked');
  await dismiss(page);
  await page.getByRole('button',{name:'Back to programme'}).click();
  await page.getByRole('link',{name:'Tuesday Lower A'}).click();
  await page.getByRole('button',{name:/First, find your rhythm/}).click();
  await expect(page.getByRole('dialog').getByRole('checkbox').first()).not.toBeChecked();
  await dismiss(page);
  await page.getByRole('button',{name:'Back to programme'}).click();
  await page.getByRole('link',{name:'Monday Upper A'}).click();
  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  await workoutResource(page,'Warm-up');
  await expect(page.getByRole('dialog').getByRole('checkbox').first()).toBeChecked();
});

test('future exercise changes preserve an active workout and offer an explicit resume',async({page})=>{
  await page.goto('/#programme/tuesday');
  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Leg Press',exact:true})).toBeVisible();
  const original=(await read(page)).active;
  await page.getByRole('button',{name:'Leave workout'}).click();
  await expect(page).toHaveURL(/#programme\/tuesday$/);
  await expect(page.getByRole('button',{name:'Start workout',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:/Leg Press/}).click();
  await page.getByLabel('Exercise variation',{exact:true}).selectOption('p16-belt-squat');
  await page.getByRole('button',{name:'Save exercise choice'}).click();
  await expect(page.locator('.programme-exercise').first()).toContainText('Belt Squat');
  expect((await read(page)).active).toEqual(original);
  await page.getByRole('button',{name:'Back to programme'}).click();
  await page.getByRole('link',{name:'Monday Upper A'}).click();
  await expect(page.getByRole('complementary',{name:'Workout in progress'})).toContainText('Lower A');
  await page.getByRole('button',{name:'Resume Lower A',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Leg Press',exact:true})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Leave workout'}).click();
  await expect(page).toHaveURL(/#programme\/tuesday$/);
});

test('exercise details preserve timed, per-side, assistance and unit meanings',async({page})=>{
  const store=freshStore();
  store.settings.unit='lb';
  const session=newSession(fixedWorkoutForDay(4,store.programme.options)!,store);
  session.date='2026-11-19';session.endedAt=session.startedAt+60000;
  Object.assign(session.exercises[0].sets[0],{done:true,weight:20,reps:8});
  Object.assign(session.exercises[6].sets[0],{done:true,weight:0,reps:30});
  store.sessions=[session];await seed(page,store);
  await page.goto('/#programme/thursday');
  await page.getByRole('button',{name:/Assisted Pull-Ups/}).click();
  await expect(page.getByRole('region',{name:'Last two logged sets'})).toContainText('lb assistance × 8 reps');
  await page.getByLabel('Exercise variation',{exact:true}).selectOption('p16-pullup');
  await expect(page.getByRole('region',{name:'Last two logged sets'})).toContainText('No logged sets yet');
  await dismiss(page);
  await page.getByRole('button',{name:/Side Plank/}).click();
  await expect(page.locator('.programme-prescription')).toContainText('2 × 20–40 sec / side');
  await expect(page.getByRole('region',{name:'Last two logged sets'})).toContainText('Bodyweight × 30 sec / side');
});

test('optional knee raises retain their session confirmation',async({page})=>{
  await page.goto('/#programme/saturday');
  await page.getByRole('button',{name:'Upper C settings',exact:true}).click();
  await page.getByRole('radio',{name:/^Supported Captain/}).check();
  await page.getByRole('button',{name:'Save settings'}).click();
  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start with knee raises'})).toBeDisabled();
  await page.getByRole('button',{name:'Use dead bugs this session'}).click();
  await expect(page.getByRole('group',{name:'Current working set'})).toBeVisible();
  await expect.poll(async()=>(await read(page)).active?.workout.exercises.at(-1)?.id).toBe('p16-dead-bug');
});

test('Programme screens and sheets fit phones, tablet and desktop with accessible actions',async({page},info)=>{
  test.setTimeout(90000);
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:width<400?700:1000});
    const capture=async(name:string)=>{
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
      await page.screenshot({path:info.outputPath(`${width}-${name}.png`),fullPage:!name.match(/exercise|warmup|guide|urgent|settings/)});
    };
    await page.goto('/#programme');await expect(page.getByRole('list',{name:'Weekly programme'})).toBeVisible();await capture('overview');
    await page.getByRole('link',{name:'Monday Upper A'}).click();await capture('session');
    await page.getByRole('button',{name:/Incline Dumbbell Press/}).click();
    const save=page.getByRole('button',{name:'Save exercise choice'});
    await expect(save).toBeInViewport();
    await page.locator('.programme-sheet-body').evaluate(element=>element.scrollTop=element.scrollHeight);
    await expect(save).toBeInViewport();await capture('exercise');
    await dismiss(page);
    await page.getByRole('button',{name:/First, find your rhythm/}).click();await capture('warmup');await dismiss(page);
    await page.getByRole('button',{name:/^Training guide/}).click();await capture('guide');await dismiss(page);
    await page.getByRole('button',{name:'Back pain: urgent help'}).click();await capture('urgent');await dismiss(page);
    await page.goto('/#programme/saturday');await page.getByRole('button',{name:'Upper C settings',exact:true}).click();
    await expect(page.getByRole('button',{name:'Save settings'})).toBeInViewport();await capture('settings');await dismiss(page);
    await page.goto('/#programme/wednesday');await expect(page.getByRole('heading',{name:'Active recovery',exact:true})).toBeVisible();await capture('recovery');
  }
  await page.emulateMedia({forcedColors:'active'});
  await expect(page.getByRole('button',{name:'Back to programme'})).toBeVisible();
});

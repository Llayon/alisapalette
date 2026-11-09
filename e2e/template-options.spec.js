import { test, expect } from './fixtures.js';
import { getPoeticColorName } from '../src/poetic.js';

const palette = [[248,241,229],[118,78,56],[118,128,78],[194,98,72],[164,198,228],[98,22,38]];

test('все шаблоны соблюдают настройки и границы для 1/2/6 цветов', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 15000 });
  const failures = await page.evaluate(({ palette, names }) => {
    const failures = [];
    for (const title of ['Palette of my day', 'Длинная достопримечательность воскресного утра', 'W'.repeat(60)]) {
    document.getElementById('storyTitleInput').value = title;
    document.getElementById('storyTitleInput').dispatchEvent(new Event('input'));
    document.getElementById('storyChannelInput').value = '@' + 'W'.repeat(32);
    document.getElementById('storyChannelInput').dispatchEvent(new Event('input'));
    document.querySelector('[data-story-count="6"]').click();
    for (const count of [1, 2, 6]) {
      window.__chromastyle.palette = palette.slice(0, count).map(([r,g,b]) => ({ r,g,b,percentage:100/count }));
      for (let mask=0;mask<8;mask++) {
        ['storyNames','storyHex','storyPct'].forEach((id,index) => {
          const input=document.getElementById(id);input.checked=!!(mask & (1<<index));input.dispatchEvent(new Event('change'));
        });
        for (const template of ['editorial','polaroid','magazine','aroma']) {
          const texts=[];const original=CanvasRenderingContext2D.prototype.fillText;let context2d;
          CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...args) {
            context2d=this;
            const m=this.measureText(text);texts.push({text:String(text),left:x-m.actualBoundingBoxLeft,right:x+m.actualBoundingBoxRight,top:y-m.actualBoundingBoxAscent,bottom:y+m.actualBoundingBoxDescent});
            return original.call(this,text,x,y,...args);
          };
          let meta;
          try { meta=window.__storyShot(template).meta; } finally { CanvasRenderingContext2D.prototype.fillText=original; }
          const context={template,count,mask,title};
          if(meta.swatches.length!==count)failures.push({...context,error:'swatch count'});
          if(meta.texts.length!==texts.length)failures.push({...context,error:'incomplete text metadata'});
          meta.texts.forEach((bounds,index) => {
            const actual=texts[index];
            if(!actual || Math.abs(bounds.x-actual.left)>0.01 || Math.abs(bounds.y-actual.top)>0.01
              || Math.abs(bounds.w-(actual.right-actual.left))>0.01 || Math.abs(bounds.h-(actual.bottom-actual.top))>0.01)
              failures.push({...context,error:'incorrect text metadata',bounds,actual});
          });
          for(let i=0;i<meta.swatches.length;i++) {
            const swatch=meta.swatches[i];
            const pixel=[...context2d.getImageData(Math.floor((swatch.x+swatch.w-4)/2),Math.floor((swatch.y+swatch.h-4)/2),1,1).data].slice(0,3);
            if(pixel.some((v,j)=>Math.abs(v-swatch.rgb[j])>2))failures.push({...context,error:'swatch RGB',pixel,want:swatch.rgb});
            const labels=texts.filter(t=>template==='editorial' ? t.top>=swatch.y-1 && t.bottom<=swatch.y+swatch.h+1
              : template==='magazine' ? t.left>=swatch.x && t.right<=swatch.x+swatch.w && t.top>=swatch.y && t.bottom<=swatch.y+swatch.h
              : t.left>=swatch.x-1 && t.right<=swatch.x+swatch.w+1 && t.top>=swatch.y+swatch.h && t.bottom<=swatch.y+swatch.h+140);
            const labelText=labels.map(t=>t.text).join('').replace(/\s/g,'');
            const hasName=labelText.includes(names[i].replace(/\s/g,''));
            if(hasName!==!!(mask&1))failures.push({...context,error:'name toggle',name:names[i],labels:labels.map(t=>t.text)});
          }
          for(const t of texts)if(t.left < -1 || t.right >1081 || t.top < -1 || t.bottom>1921)failures.push({...context,error:'bounds',...t});
          const hexes=texts.filter(t=>/^#[0-9A-F]{6}$/.test(t.text));
          const percentages=texts.filter(t=>/^\d+(\.\d+)?%$/.test(t.text));
          if(hexes.length!==((mask&2)?count:0))failures.push({...context,error:'HEX toggle',got:hexes.length});
          if(percentages.length!==((mask&4)?count:0))failures.push({...context,error:'percentage toggle',got:percentages.length});
          if(percentages.some(t=>t.text!==(100/count).toFixed(1)+'%'))failures.push({...context,error:'percentage precision',texts:percentages.map(t=>t.text)});
        }
      }
    }
    }
    return failures;
  }, { palette, names: palette.map(([r,g,b])=>getPoeticColorName(r,g,b)) });
  expect(failures).toEqual([]);
});

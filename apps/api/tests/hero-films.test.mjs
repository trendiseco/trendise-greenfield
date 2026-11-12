import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {heroPlaylist,nextFilmIndex,additionalHeroFilms} from '../../../shared/hero-films.mjs';
test('campaign plays original, work, weekend, after hours and wraps to original',()=>{const films=heroPlaylist({video:'/media/original.mp4',poster:'/media/original.jpg'});assert.equal(films.length,4);assert.equal(films[0].src,'/media/original.mp4');assert.equal(films[1].title,'Work');let index=0;const seen=[];for(let n=0;n<5;n++){seen.push(index);index=nextFilmIndex(index,films.length);}assert.deepEqual(seen,[0,1,2,3,0]);assert.equal(heroPlaylist({video:additionalHeroFilms[0].src}).length,3);});
test('broken films are skipped; all broken returns poster fallback',()=>{assert.equal(nextFilmIndex(0,4,[1]),2);assert.equal(nextFilmIndex(3,4,[0]),1);assert.equal(nextFilmIndex(0,4,[1,2,3]),0);assert.equal(nextFilmIndex(0,4,[0,1,2,3]),-1);});
test('all new campaign media and posters are bundled locally',async()=>{for(const film of additionalHeroFilms)for(const path of [film.src,film.poster])await access(new URL('../../web/public'+path,import.meta.url));});

import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {heroPlaylist,nextFilmIndex,additionalHeroFilms} from '../../../shared/hero-films.mjs';
test('campaign plays original, work, weekend, after hours and wraps to original',()=>{const films=heroPlaylist({video:'/media/original.mp4',poster:'/media/original.jpg'});assert.equal(films.length,4);assert.equal(films[0].src,'/media/original.mp4');assert.equal(films[1].title,'Work');let index=0;const seen=[];for(let n=0;n<5;n++){seen.push(index);index=nextFilmIndex(index,films.length);}assert.deepEqual(seen,[0,1,2,3,0]);assert.equal(heroPlaylist({video:additionalHeroFilms[0].src}).length,3);});
test('broken films are skipped; all broken returns poster fallback',()=>{assert.equal(nextFilmIndex(0,4,[1]),2);assert.equal(nextFilmIndex(3,4,[0]),1);assert.equal(nextFilmIndex(0,4,[1,2,3]),0);assert.equal(nextFilmIndex(0,4,[0,1,2,3]),-1);});
test('the four default films use cloud URLs without changing custom films',async()=>{
 const films=heroPlaylist({video:'/media/trendise-film-web.mp4',poster:'/media/film-poster.jpg'});
 assert.deepEqual(films.map(film=>new URL(film.src).pathname.split('/').at(-1)),[
  'trendise-film-web.mp4','campaign-work.mp4','campaign-weekend.mp4','campaign-after-hours.mp4'
 ]);
 for(const film of films){
  assert.match(film.src,/^https:\/\/[^/]+\/storage\/v1\/object\/public\/storefront-films\//);
  await access(new URL('../../web/public'+film.poster,import.meta.url));
 }
 assert.equal(heroPlaylist({video:films[1].src}).length,3);
 assert.equal(heroPlaylist({video:'/api/media/custom'}).at(0).src,'/api/media/custom');
});

const cloudFilmBase='https://lddnaqffzszqvhxgxjje.supabase.co/storage/v1/object/public/storefront-films/';
const uploadedFilms=new Set(['trendise-film-web.mp4','campaign-work.mp4','campaign-weekend.mp4','campaign-after-hours.mp4']);

// Older saved website drafts and published settings use the bundled paths.
export function heroFilmSource(src){
 if(!src?.startsWith('/media/'))return src;
 const filename=src.slice('/media/'.length);
 return uploadedFilms.has(filename)?cloudFilmBase+filename:src;
}

export const additionalHeroFilms=[
 {src:'/media/campaign-work.mp4',poster:'/media/campaign-work.jpg',title:'Work'},
 {src:'/media/campaign-weekend.mp4',poster:'/media/campaign-weekend.jpg',title:'Weekend'},
 {src:'/media/campaign-after-hours.mp4',poster:'/media/campaign-after-hours.jpg',title:'After Hours'}
];
export function heroPlaylist(hero){return [{src:hero.video,poster:hero.poster,title:'TRENDISE campaign'},...additionalHeroFilms].map(film=>({...film,src:heroFilmSource(film.src)})).filter((film,i,all)=>film.src&&all.findIndex(f=>f.src===film.src)===i);}
export function nextFilmIndex(index,length,failed=[]){for(let step=1;step<=length;step++){const candidate=(index+step)%length;if(!failed.includes(candidate))return candidate;}return -1;}

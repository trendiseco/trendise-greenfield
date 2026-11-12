'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useSite,mediaUrl} from './SiteProvider';
import {heroPlaylist,nextFilmIndex} from '../../../../shared/hero-films.mjs';
export default function CinemaHero(){
 const {site}=useSite(),hero=site.hero;
 const video=useRef(null),wantsPlayback=useRef(false),[playing,P]=useState(false),[reduced,R]=useState(true),[active,A]=useState(0),[failed,F]=useState([]);
 const films=heroPlaylist(hero),film=films[active]||films[0],unavailable=failed.length>=films.length;
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const apply=()=>R(media.matches||!!navigator.connection?.saveData);apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);},[]);
 useEffect(()=>{A(0);F([]);},[hero.video]);
 useEffect(()=>{wantsPlayback.current=!reduced;if(reduced)video.current?.pause();else video.current?.play().catch(()=>P(false));},[reduced]);
 useEffect(()=>{P(false);if(wantsPlayback.current&&!unavailable)video.current?.play().catch(()=>P(false));},[film.src,unavailable]);
 const advance=(bad=false)=>{const excluded=bad?[...new Set([...failed,active])]:failed;if(bad)F(excluded);const next=nextFilmIndex(active,films.length,excluded);if(next<0){P(false);return;}if(next===active){if(wantsPlayback.current){video.current.currentTime=0;video.current.play().catch(()=>P(false));}}else A(next);};
 const toggle=()=>{wantsPlayback.current=!playing;if(playing)video.current?.pause();else video.current?.play().catch(()=>P(false));};
 return <section className="cinema-hero" aria-label="TRENDISE fashion film"><img className="film-poster" src={mediaUrl(hero.poster)} alt={hero.posterAlt} fetchPriority="high"/>{!unavailable&&<video key={film.src} src={mediaUrl(film.src)} ref={video} className="hero-film" muted playsInline preload={reduced?'none':'metadata'} poster={mediaUrl(film.poster)} onPlay={()=>P(true)} onPause={()=>P(false)} onEnded={()=>advance()} onError={()=>advance(true)} aria-label={`${film.title} campaign film, no sound`} tabIndex={-1}/>}<div className="cinema-shade"/><div className="film-topline"><span>{hero.eyebrow}</span><span>{hero.campaign}</span></div><div className="cinema-copy"><div className="cinema-kicker"><span/> {hero.kicker}</div><h1>{hero.title}<br/><em>{hero.emphasis}</em></h1><p>{hero.description}</p><Link href={hero.href} className="cinema-cta">{hero.button} <span>↗</span></Link></div><div className="film-bottomline"><span>{hero.bottom}</span><div>{!unavailable&&<><span className="film-counter" aria-label={`Campaign film ${active+1} of ${films.length}`}>{String(active+1).padStart(2,'0')} / {String(films.length).padStart(2,'0')}</span><button className="film-toggle" onClick={toggle} aria-label={playing?'Pause campaign film':'Play campaign film'}>{playing?'Ⅱ PAUSE FILM':'▷ PLAY FILM'}</button></>}<a href="#the-edit">DISCOVER BELOW ↓</a></div></div></section>;
}

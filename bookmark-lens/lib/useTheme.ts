import { useEffect, useState } from 'react';
export type Theme = 'light' | 'dark' | 'system';
export function useTheme() {
 const [theme,setTheme] = useState<Theme>(()=>{const value=localStorage.getItem('theme');return value==='dark'||value==='system'?value:'light';});
 useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)');const apply=()=>{document.documentElement.dataset.theme=theme==='system'?(media.matches?'dark':'light'):theme;};apply();localStorage.setItem('theme',theme);media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);},[theme]);
 return {theme,setTheme};
}

// Sans "use client" : le script ne part qu'en ligne dans le gabarit racine, jamais dans le JavaScript client (budget).
export const THEME_STORAGE_KEY = "nextin-theme";

/**
 * Script exécuté avant le premier rendu : applique data-theme="light|dark" sans flash.
 * Préférence enregistrée (auto | light | dark) dans localStorage ; "auto" suit le système.
 */
export const themeInitScript = `(()=>{try{var k="${THEME_STORAGE_KEY}",p=localStorage.getItem(k)||"auto",m=window.matchMedia("(prefers-color-scheme: dark)"),a=function(){var d=p==="dark"||(p==="auto"&&m.matches);document.documentElement.dataset.theme=d?"dark":"light";document.documentElement.dataset.themePreference=p};a();m.addEventListener("change",function(){p=localStorage.getItem(k)||"auto";a()})}catch(e){document.documentElement.dataset.theme="light"}})();`;

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
function declarations(selector){const block=css.match(selector)?.[1]||'';return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[\da-fA-F]{3,8})/g)].map(([,key,value])=>[key,value]));}
const light={...declarations(/:root\{([^}]*)\}/),...declarations(/:root\{[^}]*\}[\s\S]*?:root\{([^}]*)\}/)};
const dark={...light,...declarations(/:root\[data-theme=dark\]\{([^}]*)\}/)};
function luminance(color){let hex=color.slice(1);if(hex.length===3)hex=[...hex].map(v=>v+v).join('');const rgb=hex.slice(0,6).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
const ratio=(a,b)=>{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05);};

test('tokens de texto atingem contraste WCAG AA nos temas claro e escuro',()=>{
 for(const [theme,label] of [[light,'claro'],[dark,'escuro']])for(const background of [theme['--bg'],theme['--panel']]){
  assert.ok(ratio(theme['--ink'],background)>=4.5,`texto principal com baixo contraste no tema ${label}`);
  assert.ok(ratio(theme['--muted'],background)>=4.5,`texto secundário com baixo contraste no tema ${label}`);
 }
 for(const theme of [light,dark])assert.ok(ratio('#1f1f21',theme['--lime'])>=4.5,'texto de botão de destaque com contraste insuficiente');
});

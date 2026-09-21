import {spawn} from 'node:child_process';
const raw=process.argv.slice(2);const args=[];for(const arg of raw){if(arg==='--strictPort')continue;args.push(arg==='--host'?'--hostname':arg);}
const proc=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',...args],{stdio:'inherit'});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>proc.kill(signal));
proc.on('exit',code=>process.exit(code||0));

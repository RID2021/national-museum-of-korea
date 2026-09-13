// Local-only visual test fixture. Never included in the ZEP archive.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "../..");
const data = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, "src/nationalMuseum/npcs.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
}).outputText, { exports: data });
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>Museum dialogue QA</title>
<style>body{margin:20px;background:#283c39;color:white;font:16px sans-serif}iframe{width:1020px;height:660px;border:0}select,button{font:inherit;padding:8px}</style>
<h1>박물관 대화 검수</h1><label>NPC <select id="npc"></select></label> <label>장면 <select id="scene"></select></label> <button id="show">대화 열기</button>
<p id="status">대기</p><iframe title="NPC 대화" src="/widget"></iframe>
<script>
const npcs=${JSON.stringify(data.NATIONAL_MUSEUM_NPCS)};
const n=document.querySelector('#npc'),s=document.querySelector('#scene'),frame=document.querySelector('iframe');
npcs.forEach(x=>n.add(new Option(x.name,x.id)));
function scenes(){s.replaceChildren();npcs.find(x=>x.id===n.value).scenes.forEach(x=>s.add(new Option(x.title,x.id)));s.value='intro';}
function show(){const npc=npcs.find(x=>x.id===n.value),scene=npc.scenes.find(x=>x.id===s.value);const speakers=scene.speakerLines||[];
frame.contentWindow.postMessage({type:'mission-npc:init',payload:{...scene,npcId:npc.id,sceneId:scene.id,name:npc.name,profileImageUrl:npc.profileImageUrl,role:npc.role,kind:npc.kind,mapNames:npc.mapNames,lines:speakers.length?speakers.map(x=>x.text):scene.lines,speakerLines:speakers,speakerlessLineTexts:speakers.filter(x=>x.speakerless).map(x=>x.text),choices:[]}},'*');
document.querySelector('#status').textContent=npc.name+' / '+scene.id;}
n.onchange=()=>{scenes();show()};s.onchange=show;document.querySelector('#show').onclick=show;
addEventListener('message',e=>{if(e.source!==frame.contentWindow)return;if(e.data?.type==='mission-npc:ready')show();if(e.data?.type==='mission-npc:complete')document.querySelector('#status').textContent+=' / 대화 완료';});
scenes();</script></html>`;
http.createServer((req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (req.url === "/") return res.end(html);
  if (req.url === "/widget") return res.end(fs.readFileSync(path.join(root, "res/html/museum-npc-widget-v1.html")));
  res.statusCode = 404;
  res.end("Not found");
}).listen(4179, "127.0.0.1", () => process.stdout.write("Museum QA at http://127.0.0.1:4179\n"));

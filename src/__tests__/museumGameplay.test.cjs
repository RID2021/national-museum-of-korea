const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const base = path.resolve(__dirname, '../nationalMuseum');
function harness() {
  const cache = {}, moves = [], opened = [], widgets = [], timers = [];
  const app = { spaceHashID: 'nLP9zE', mapHashID: '0EAV9k' };
  const player = { tag: {}, storage: JSON.stringify({ other: 'keep' }), isMobile: false, sendUpdated() {}, save() {}, showCenterLabel() {}, spawnAtMap: (...args) => moves.push(args),
    showWidget(file) { const w = { file, destroyed: false, messages: [], destroy() { this.destroyed = true; }, sendMessage(m) { this.messages.push(m); }, onMessage: { Add(fn) { w.receive = fn; } } }; widgets.push(w); return w; } };
  const utils = { preparePlayerTag: p => p.tag, loadPlayerStorage: p => JSON.parse(p.storage), savePlayerStorage: (p, s) => p.storage = JSON.stringify(s), preparePlayerStorage: p => JSON.parse(p.storage) };
  function load(name) {
    if (cache[name]) return cache[name];
    const exports = {}; cache[name] = exports;
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(base, name + '.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS } }).outputText,
      { exports, ScriptApp: app, setTimeout: fn => timers.push(fn), require: id => id.includes('utils/player') ? utils : load(id.replace('./', '')) });
    return exports;
  }
  return { game: load('games'), nav: load('navigation'), api: load('gameplay'), player, app, moves, opened, widgets, timers, open: (_p, s) => opened.push(s) };
}
function solve(game, id, state) {
  state = JSON.parse(JSON.stringify(state));
  const act = a => state = game.applyGameAction(id, state, a);
  const n = game.GAME_IDS.indexOf(id);
  if (n === 0) { [1,4,7].forEach(index => act({kind:'pick',index})); act({kind:'answer',text:' 교 류 '}); }
  if (n === 1 || n === 4) {
    if (n === 4) state.order = [3,0,5,1,2,4];
    for (let i=0;i<state.order.length;i++) if(state.order[i]!==i) { const j=state.order.indexOf(i); act({kind:'pick',index:i}); act({kind:'pick',index:j}); }
    act({kind:'submit'});
    if (n===4) { for(let i=0;i<5;i++)act({kind:'pick',index:i});act({kind:'submit'}); }
  }
  if (n===2 || n===3)act({kind:'pick',index:1});
  if (n===5)[1,3,5].forEach(index=>act({kind:'pick',index}));
  if (n===6)for(let p=0;p<5;p++){act({kind:'pick',index:state.deck.indexOf(p*2)});act({kind:'pick',index:state.deck.indexOf(p*2+1)});}
  return state;
}
test('all seven MVP rule engines can be solved without mutating input',()=>{
  const {game}=harness();
  for(const id of game.GAME_IDS){const initial=game.createGameState();const before=JSON.stringify(initial);assert.equal(solve(game,id,initial).done,true,id);assert.equal(JSON.stringify(initial),before);}
});
test('wrong answers, incomplete collections, mismatches and invalid actions cannot complete',()=>{
  const {game}=harness();
  for(const id of game.GAME_IDS){let s=game.createGameState();for(const a of [{kind:'success'},{kind:'submit'},{kind:'pick',index:-1},{kind:'pick',index:999},{kind:'answer',text:'wrong'},{kind:'pick',index:0}])s=game.applyGameAction(id,s,a);assert.equal(s.done,false,id);}
  let s=game.createGameState();s.stage=1;s.visited=[0,1,2,3];assert.equal(game.applyGameAction(game.GAME_IDS[4],s,{kind:'submit'}).done,false);
  s=game.createGameState();s.deck=[0,2,1,3,4,5,6,7,8,9];s=game.applyGameAction(game.GAME_IDS[6],s,{kind:'pick',index:0});s=game.applyGameAction(game.GAME_IDS[6],s,{kind:'pick',index:1});assert.equal(s.matched.length,0);
});
test('live widget contract checks token/revision and restores saved partial progress',()=>{
  const h=harness();h.api.openMuseumGame(h.player,h.game.GAME_IDS[0],h.open);
  let w=h.widgets.at(-1), m=w.messages.at(-1);
  w.receive(h.player,{type:'museum:action',token:'fake',revision:0,action:{kind:'pick',index:1}});
  assert.equal(JSON.parse(h.player.storage).museumGames[h.game.GAME_IDS[0]].collected.length,0);
  const action={type:'museum:action',token:m.token,revision:m.revision,action:{kind:'pick',index:1}};w.receive(h.player,action);w.receive(h.player,action);
  assert.equal(w.messages.at(-1).revision,1);
  w.receive(h.player,{type:'museum:close',token:m.token});assert.equal(w.destroyed,true);
  h.api.openMuseumGame(h.player,h.game.GAME_IDS[0],h.open);w=h.widgets.at(-1);assert.deepEqual(Array.from(w.messages.at(-1).disabled),[1]);
  h.api.leaveMuseumExperience(h.player);assert.equal(w.destroyed,true);assert.equal(JSON.parse(h.player.storage).other,'keep');
});
test('widget-driven full journey completes seven missions, dialogues, moves and ending',()=>{
  const h=harness();
  for(let n=0;n<7;n++){
    const mission=h.nav.MISSIONS[n];h.app.mapHashID=mission.map;
    if(n===6)h.nav.saveMuseumStory(h.player,'emergency');
    h.api.openMuseumGame(h.player,mission.id,h.open);
    const w=h.widgets.at(-1);
    function act(action){const m=w.messages.at(-1);w.receive(h.player,{type:'museum:action',token:m.token,revision:m.revision,action});}
    const state=()=>JSON.parse(h.player.storage).museumGames[mission.id];
    if(n===0){[1,4,7].forEach(index=>act({kind:'pick',index}));act({kind:'answer',text:'교류'});}
    if(n===1||n===4){for(let i=0;i<state().order.length;i++){const j=state().order.indexOf(i);if(i!==j){act({kind:'pick',index:i});act({kind:'pick',index:j});}}act({kind:'submit'});if(n===4){for(let i=0;i<5;i++)act({kind:'pick',index:i});act({kind:'submit'});}}
    if(n===2||n===3)act({kind:'pick',index:1});
    if(n===5)[1,3,5].forEach(index=>act({kind:'pick',index}));
    if(n===6){const deck=state().deck;for(let i=0;i<5;i++){act({kind:'pick',index:deck.indexOf(i*2)});act({kind:'pick',index:deck.indexOf(i*2+1)});}}
    assert.equal(w.destroyed,true);assert.equal(h.nav.journey(h.player).completed.length,n+1);
    if(n<6){assert.equal(h.nav.journey(h.player).pendingCompletion,mission.id);h.api.handleMuseumAction(h.player,mission.id,h.open);}
  }
  assert.deepEqual(h.moves.at(-1),['nLP9zE','XWA4Aj']);h.app.mapHashID='XWA4Aj';h.nav.handleMuseumArrival(h.player,h.open);h.timers.shift()();assert.match(h.opened.at(-1),/:ending$/);
  h.api.handleMuseumAction(h.player,'ending',h.open);assert.equal(h.nav.journey(h.player).endingSeen,true);
});
test('current mission button bridges lobby 4 to Silla and rejects out of order games',()=>{
  const h=harness();h.app.mapHashID='r7aeam';h.api.openMuseumGame(h.player,h.game.GAME_IDS[3],h.open);assert.equal(h.widgets.length,0);
  h.player.storage=JSON.stringify({museumJourney:{completed:h.game.GAME_IDS.slice(0,3)}});h.app.mapHashID='eXY3Yx';h.api.continueMuseum(h.player,h.open);assert.deepEqual(h.moves.at(-1),['nLP9zE','r7aeam']);
});
test('ending remains resumable until its last page; restart preserves unrelated storage',()=>{
  const h=harness();h.app.mapHashID='XWA4Aj';h.player.storage=JSON.stringify({other:'keep',inventory:['existing'],museumJourney:{completed:h.game.GAME_IDS,pendingEnding:true},museumGames:{}});
  h.nav.handleMuseumArrival(h.player,h.open);h.timers.shift()();assert.equal(h.nav.journey(h.player).pendingEnding,true);
  h.api.startMuseumExperience(h.player,h.open);const hud=h.widgets.at(-1);hud.receive(h.player,{type:'museum:restart-confirmed'});
  const saved=JSON.parse(h.player.storage);assert.deepEqual(saved.inventory,['existing']);assert.equal(saved.other,'keep');assert.equal(saved.museumJourney.completed.length,0);assert.deepEqual(h.moves.at(-1),['nLP9zE','R57laZ']);
});
test('mobile answer buttons work without keyboard, preserve drafts and ignore IME Enter',()=>{
  const html=fs.readFileSync(path.resolve(base,'../../res/html/museum-game-v1.html'),'utf8');
  const elements={}, messages=[], timers=[];
  function element(){return {value:'',children:[],append(...items){this.children.push(...items);for(const item of items)if(item.id)elements[item.id]=item;},replaceChildren(){this.children=[];},setAttribute(){},classList:{add(){}}};}
  for(const id of ['title','number','prompt','hint','note','feedback','board','submit','close'])elements[id]=element();
  const parent={postMessage:m=>messages.push(m)};
  const context={document:{getElementById:id=>elements[id],createElement:element},parent,window:{addEventListener(){}},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}};
  vm.createContext(context);vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1],context);
  const payload={type:'museum:game',token:'t',revision:0,mission:1,kind:'answer',title:'test'};
  context.render(payload);
  elements.submit.onclick();assert.equal(messages.filter(m=>m.type==='museum:action').length,0);
  const keys=elements.board.children.at(-1).children;
  keys.find(k=>k.textContent==='교').onclick();keys.find(k=>k.textContent==='류').onclick();assert.equal(elements.answer.value,'교류');
  elements.answer.oncompositionstart();elements.answer.onkeydown({key:'Enter',isComposing:true,keyCode:229});assert.equal(messages.filter(m=>m.type==='museum:action').length,0);
  elements.answer.oncompositionend();elements.submit.onclick();assert.equal(messages.at(-1).action.text,'교류');
  context.render({...payload,revision:1,feedback:'다시 도전'});assert.equal(elements.answer.value,'교류');
  elements.board.children.at(-1).children.find(k=>k.textContent==='모두 지우기').onclick();assert.equal(elements.answer.value,'');
});

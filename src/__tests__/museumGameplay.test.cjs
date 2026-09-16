const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const base = path.resolve(__dirname, '../nationalMuseum');
test('dialogue quizzes validate answers and wait for explanation completion',()=>{
  for(const n of [2,3]){
    const h=harness(),id=h.game.GAME_IDS[n];
    h.app.mapHashID=h.nav.MISSIONS[n].map;
    h.player.storage=JSON.stringify({museumJourney:{completed:h.game.GAME_IDS.slice(0,n)}});
    h.api.openMuseumGame(h.player,id,h.open);
    assert.equal(h.widgets.length,0);
    assert.equal(h.opened.at(-1),'npc:'+h.nav.MISSIONS[n].npc+':quiz');
    h.api.handleMuseumAction(h.player,'quiz-complete:'+id,h.open);
    assert.equal(h.nav.journey(h.player).completed.length,n);
    for(const answer of [0,-1,999,1.5]){
      h.api.handleMuseumDialogueChoice(h.player,id,answer);
      h.api.handleMuseumAction(h.player,'quiz-complete:'+id,h.open);
      assert.equal(h.nav.journey(h.player).completed.length,n);
    }
    h.api.handleMuseumDialogueChoice(h.player,id,1);
    assert.equal(h.nav.journey(h.player).completed.length,n);
    h.api.leaveMuseumExperience(h.player);
    h.api.handleMuseumAction(h.player,'quiz-complete:'+id,h.open);
    assert.equal(h.nav.journey(h.player).completed.length,n);
    h.api.handleMuseumDialogueChoice(h.player,id,1);
    h.api.handleMuseumAction(h.player,'quiz-complete:'+id,h.open);
    h.api.handleMuseumAction(h.player,'quiz-complete:'+id,h.open);
    assert.equal(h.nav.journey(h.player).completed.length,n+1);
    assert.equal(h.moves.length,0);
  }
});
test('brick drag swaps atomically and rejects invalid destinations', () => {
  const {game}=harness(), id=game.GAME_IDS[1], initial=game.createGameState();
  initial.selected=4;
  const swapped=game.applyGameAction(id,initial,{kind:'swap',index:0,target:7});
  assert.equal(swapped.order[0],initial.order[7]);
  assert.equal(swapped.order[7],initial.order[0]);
  assert.equal(swapped.selected,-1);
  assert.equal(swapped.done,false);
  for(const target of [-1,8,1.5,'2',undefined]) {
    const result=game.applyGameAction(id,initial,{kind:'swap',index:0,target});
    assert.deepEqual(Array.from(result.order),Array.from(initial.order));
  }
  let state=initial;
  for(let i=0;i<8;i++)if(state.order[i]!==i)state=game.applyGameAction(id,state,{kind:'swap',index:i,target:state.order.indexOf(i)});
  assert.equal(state.done,false);
  assert.equal(game.applyGameAction(id,state,{kind:'submit'}).done,true);
});
test('brick artwork covers every label and follows reordered game items', () => {
  const html = fs.readFileSync(path.resolve(base, '../../res/html/museum-game-v1.html'), 'utf8');
  const match = html.match(/const BRICK_ASSETS = (\{[^\n]+\});/);
  assert.ok(match);
  const assets = JSON.parse(match[1]);
  const { game } = harness();
  assert.deepEqual(Object.keys(assets), Array.from(game.BRICKS, name => name + '무늬'));
  assert.equal(new Set(Object.values(assets)).size, 8);
  for (const value of Object.values(assets)) assert.ok(value.startsWith('data:image/png;base64,'));
  let state = game.createGameState();
  const before = game.gameView(game.GAME_IDS[1], state).items;
  state = game.applyGameAction(game.GAME_IDS[1], state, { kind: 'pick', index: 0 });
  state = game.applyGameAction(game.GAME_IDS[1], state, { kind: 'pick', index: 1 });
  const after = game.gameView(game.GAME_IDS[1], state).items;
  assert.equal(after[0], before[1]);
  assert.equal(after[1], before[0]);
  for (const label of after) assert.ok(assets[label]);
});
function harness() {
  const cache = {}, moves = [], opened = [], widgets = [], timers = [];
  const app = { spaceHashID: 'nLP9zE', mapHashID: '0EAV9k' };
  const player = { tag: {}, storage: JSON.stringify({ other: 'keep' }), isMobile: false, sendUpdated() {}, save() {}, showCenterLabel() {}, spawnAtMap: (...args) => moves.push(args),
    showWidget(file,align,width,height) { const w = { file, align, width, height, destroyed: false, messages: [], destroy() { this.destroyed = true; }, sendMessage(m) { this.messages.push(m); }, onMessage: { Add(fn) { w.receive = fn; } } }; widgets.push(w); return w; } };
  const utils = { preparePlayerTag: p => p.tag, loadPlayerStorage: p => JSON.parse(p.storage), savePlayerStorage: (p, s) => p.storage = JSON.stringify(s), preparePlayerStorage: p => JSON.parse(p.storage) };
  function load(name) {
    if (cache[name]) return cache[name];
    const exports = {}; cache[name] = exports;
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(base, name + '.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS } }).outputText,
      { exports, ScriptApp: app, setTimeout: fn => timers.push(fn), require: id => id.includes('utils/player') ? utils : load(id.replace('./', '')) });
    return exports;
  }
  return { game: load('games'), nav: load('navigation'), api: load('gameplay'), exploration: load('exploration'), progress: load('progress'), player, app, moves, opened, widgets, timers, open: (_p, s) => opened.push(s) };
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
    if(n===2||n===3){h.api.handleMuseumDialogueChoice(h.player,mission.id,1);h.api.handleMuseumAction(h.player,'quiz-complete:'+mission.id,h.open);}
    if(n===5)[1,3,5].forEach(index=>act({kind:'pick',index}));
    if(n===6){const deck=state().deck;for(let i=0;i<5;i++){act({kind:'pick',index:deck.indexOf(i*2)});act({kind:'pick',index:deck.indexOf(i*2+1)});}}
    if(n!==2&&n!==3)assert.equal(w.destroyed,true);assert.equal(h.nav.journey(h.player).completed.length,n+1);
    if(n<6){assert.equal(h.nav.journey(h.player).pendingCompletion,mission.id);h.api.handleMuseumAction(h.player,mission.id,h.open);}
  }
  assert.deepEqual(h.moves.at(-1),['nLP9zE','XWA4Aj']);h.app.mapHashID='XWA4Aj';h.nav.handleMuseumArrival(h.player,h.open);h.timers.shift()();assert.match(h.opened.at(-1),/:ending$/);
  h.api.handleMuseumAction(h.player,'ending',h.open);assert.equal(h.nav.journey(h.player).endingSeen,true);
});
test('mission guide never teleports or opens dialogue and rejects out of order games',()=>{
  const h=harness();h.app.mapHashID='r7aeam';h.api.openMuseumGame(h.player,h.game.GAME_IDS[3],h.open);assert.equal(h.widgets.length,0);
  h.player.storage=JSON.stringify({museumJourney:{completed:h.game.GAME_IDS.slice(0,3)}});h.app.mapHashID='eXY3Yx';h.api.continueMuseum(h.player,h.open);assert.equal(h.moves.length,0);assert.equal(h.opened.length,0);
});
test('lobby two robot gives walking directions without automatic travel',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.lobby2;
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-guide-robot','intro'),'baekje-guide');
  h.api.handleMuseumAction(h.player,'baekje-guide',h.open);
  assert.equal(h.moves.length,0);assert.equal(h.opened.length,0);
  h.app.mapHashID=h.nav.MUSEUM_MAPS.lobby1;
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-guide-robot','intro'),'intro');
});
test('lobby three robot gives Gaya walking directions without automatic travel',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.lobby3;
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-guide-robot','intro'),'gaya-guide');
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-guide-robot','gaya-guide'),'gaya-guide');
  h.api.handleMuseumAction(h.player,'gaya-guide',h.open);
  assert.equal(h.moves.length,0);assert.equal(h.opened.length,0);
});
test('lobby four robot gives Silla walking directions without automatic travel',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.lobby4;
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-guide-robot','intro'),'silla-guide');
  h.api.handleMuseumAction(h.player,'silla-guide',h.open);
  assert.equal(h.moves.length,0);assert.equal(h.opened.length,0);
});
test('Goguryeo bowl intro branches on discovered clue count',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.goguryeo;
  h.player.storage=JSON.stringify({museumClues:['gwang']});
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-hou-bronze-bowl','intro'),'clues-incomplete');
  h.player.storage=JSON.stringify({museumClues:['gwang','gae','to']});
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-hou-bronze-bowl','intro'),'quiz');
  h.player.storage=JSON.stringify({});
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-hou-bronze-bowl','intro'),'intro');
});
test('ending remains resumable until its last page; no custom HUD is created',()=>{
  const h=harness();h.app.mapHashID='XWA4Aj';h.player.storage=JSON.stringify({other:'keep',inventory:['existing'],museumJourney:{completed:h.game.GAME_IDS,pendingEnding:true},museumGames:{}});
  h.nav.handleMuseumArrival(h.player,h.open);h.timers.shift()();assert.equal(h.nav.journey(h.player).pendingEnding,true);
  h.api.startMuseumExperience(h.player,h.open);assert.equal(h.widgets.length,0);
  const saved=JSON.parse(h.player.storage);assert.deepEqual(saved.inventory,['existing']);assert.equal(saved.other,'keep');assert.equal(saved.museumJourney.completed.length,7);
});
test('progress uses the unchanged tomb widget and counts only genuine museum missions',()=>{
  const h=harness();h.player.storage=JSON.stringify({museumJourney:{completed:[h.game.GAME_IDS[0],h.game.GAME_IDS[0],'unknown']}});
  h.progress.showMuseumProgress(h.player);const w=h.widgets.at(-1);assert.equal(w.file,'html/mission-progress-widget.html');assert.equal(w.width,390);assert.equal(w.height,450);
  const p=w.messages.at(-1).payload;assert.equal(p.detail,'1/7');assert.equal(p.percent,14);assert.equal(p.title,'전체 미션 진행률');
  const hash=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.resolve(base,'../../res/html/mission-progress-widget.html'))).digest('hex');assert.equal(hash,'8b03f3ba369c3ac8ec8371f90fd357a1bf3729bf56fc07c13f39e855bcf280be');
  h.progress.closeMuseumProgress(h.player);h.player.isMobile=true;h.progress.showMuseumProgress(h.player);assert.equal(h.widgets.at(-1).width,330);
});
test('travel unlocks only after actual dialogue completion or cleared mission success dialogue',()=>{
  const h=harness();h.app.mapHashID='LB6MNd';assert.equal(h.progress.travelFromMuseumProgress(h.player),false);
  h.nav.runMuseumSceneTransition(h.player,'goguryeo',h.open);assert.equal(h.nav.journey(h.player).travel.includes('0EAV9k'),true);
  h.app.mapHashID='LB6MNd';h.moves.length=0;assert.equal(h.progress.travelFromMuseumProgress(h.player),true);assert.deepEqual(h.moves[0],['nLP9zE','0EAV9k']);
  h.app.mapHashID='0EAV9k';h.nav.handleMuseumMissionCompletion(h.player,h.game.GAME_IDS[0],h.open);h.moves.length=0;assert.equal(h.progress.travelFromMuseumProgress(h.player),false);assert.equal(h.moves.length,0);
  h.nav.runMuseumSceneTransition(h.player,h.game.GAME_IDS[0],h.open);h.app.mapHashID='pnNepx';h.moves.length=0;
  h.progress.showMuseumProgress(h.player);const w=h.widgets.at(-1);assert.equal(w.messages.at(-1).payload.museumButtonLabel,'백제실로 이동하기');
  w.receive(h.player,{type:'mission-progress:open-museum'});assert.deepEqual(h.moves[0],['nLP9zE','kP0x5B']);assert.equal(w.destroyed,true);
  h.moves.length=0;w.receive(h.player,{type:'mission-progress:open-museum'});assert.equal(h.moves.length,0);
});
test('travel is rechecked after UI rendering and cannot leave an unfinished active mission',()=>{
  const h=harness();h.player.storage=JSON.stringify({museumJourney:{completed:h.game.GAME_IDS.slice(0,3)}});h.app.mapHashID='eXY3Yx';h.progress.showMuseumProgress(h.player);const w=h.widgets.at(-1);assert.equal(w.messages.at(-1).payload.museumUnlocked,true);
  h.player.tag.museumGame={};w.receive(h.player,{type:'mission-progress:open-museum'});assert.equal(h.moves.length,0);
  delete h.player.tag.museumGame;h.player.storage=JSON.stringify({museumJourney:{completed:[]}});w.receive(h.player,{type:'mission-progress:open-museum'});assert.equal(h.moves.length,0);
});
test('real text input receives synchronous touch focus, remains mounted, and ignores IME Enter',()=>{
  const html=fs.readFileSync(path.resolve(base,'../../res/html/museum-game-v1.html'),'utf8');
  const elements={}, messages=[], timers=[];
  function element(){return {value:'',children:[],focus(){this.focused=true;},append(...items){this.children.push(...items);for(const item of items)if(item.id)elements[item.id]=item;},replaceChildren(){this.children=[];},setAttribute(){},classList:{add(){}}};}
  for(const id of ['title','number','prompt','hint','note','feedback','board','submit','close'])elements[id]=element();
  const parent={postMessage:m=>messages.push(m)};
  const context={document:{getElementById:id=>elements[id],createElement:element},parent,window:{addEventListener(){}},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}};
  vm.createContext(context);vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1],context);
  const payload={type:'museum:game',token:'t',revision:0,mission:1,kind:'answer',title:'test'};
  context.render(payload);
  elements.submit.onclick();assert.equal(messages.filter(m=>m.type==='museum:action').length,0);
  const originalInput=elements.answer;originalInput.ontouchend();assert.equal(originalInput.focused,true);assert.equal(originalInput.inputMode,'text');
  originalInput.value='교류';originalInput.oninput();
  elements.answer.oncompositionstart();elements.answer.onkeydown({key:'Enter',isComposing:true,keyCode:229});assert.equal(messages.filter(m=>m.type==='museum:action').length,0);
  elements.answer.oncompositionend();elements.submit.onclick();assert.equal(messages.at(-1).action.text,'교류');
  context.render({...payload,revision:1,feedback:'다시 도전'});assert.equal(elements.answer.value,'교류');assert.equal(elements.answer,originalInput);
  assert.doesNotMatch(html,/키보드가 안 뜨나요|정답 글자/);
});
test('arriving in every ordinary map stays in world; NPC interaction requires proximity',()=>{
  const h=harness();for(const map of Object.values(h.nav.MUSEUM_MAPS).filter(map=>map!==h.nav.MUSEUM_MAPS.night)){h.app.mapHashID=map;h.api.startMuseumExperience(h.player,h.open);while(h.timers.length)h.timers.shift()();assert.equal(h.opened.length,0,map);assert.equal(h.moves.length,0,map);}
  h.app.mapHashID='0EAV9k';h.player.tileX=2;h.player.tileY=2;assert.equal(h.api.interactMuseumNearby(h.player,h.open),false);
  h.player.tileX=31;h.player.tileY=30;assert.equal(h.api.interactMuseumNearby(h.player,h.open),true);assert.equal(h.opened.at(-1),'npc:museum-hou-bronze-bowl:intro');
  h.player.storage=JSON.stringify({museumJourney:{completed:[h.game.GAME_IDS[0]],pendingCompletion:h.game.GAME_IDS[0]}});assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-hou-bronze-bowl','intro'),'success');
});
test('first entry narration opens once, persists across rejoin, and never chains or teleports',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.night;
  h.api.startMuseumExperience(h.player,h.open);h.api.startMuseumExperience(h.player,h.open);
  while(h.timers.length)h.timers.shift()();
  assert.deepEqual(h.opened,['npc:museum-pensive-1:prologue']);
  assert.equal(h.nav.journey(h.player).prologueSeen,true);
  h.api.handleMuseumAction(h.player,'prologue',h.open);
  h.api.leaveMuseumExperience(h.player);h.player.tag={};h.api.startMuseumExperience(h.player,h.open);
  while(h.timers.length)h.timers.shift()();
  assert.equal(h.opened.length,1);assert.equal(h.moves.length,0);
  assert.equal(JSON.parse(h.player.storage).other,'keep');
  h.app.mapHashID=h.nav.MUSEUM_MAPS.pensive;
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-pensive-1','intro'),'intro');
});
test('museum reset clears narrative, missions and games, preserves unrelated data and restarts narration',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.night;
  h.player.storage=JSON.stringify({other:'keep',inventory:['keep'],missionProgress:{missions:{tomb:true}},museumJourney:{completed:h.game.GAME_IDS,prologueSeen:true,story:'ending',endingSeen:true,pendingEnding:true,travel:['0EAV9k']},museumGames:{saved:{done:true}},missionNpc:{seenSceneKeys:['museum-pensive-1:prologue','other:intro']}});
  let destroyed=false;h.player.tag.missionNpcWidget={destroy(){destroyed=true;}};h.player.tag.missionNpcId='museum-guide-robot';
  h.api.resetMuseumExperience(h.player,h.open);
  const data=JSON.parse(h.player.storage);
  assert.deepEqual(data.museumJourney,{completed:[]});assert.deepEqual(data.museumGames,{});
  assert.deepEqual(data.inventory,['keep']);assert.deepEqual(data.missionProgress,{missions:{tomb:true}});assert.equal(data.other,'keep');
  assert.deepEqual(data.missionNpc.seenSceneKeys,['other:intro']);assert.equal(destroyed,true);assert.equal(h.player.tag.missionNpcId,undefined);
  while(h.timers.length)h.timers.shift()();assert.deepEqual(h.opened,['npc:museum-pensive-1:prologue']);
  h.api.startMuseumExperience(h.player,h.open);while(h.timers.length)h.timers.shift()();assert.equal(h.opened.length,1);
});
test('museum reset returns other rooms to entrance and invalidates the old game widget',()=>{
  const h=harness();h.api.openMuseumGame(h.player,h.game.GAME_IDS[0],h.open);const w=h.widgets.at(-1), m=w.messages.at(-1);
  h.api.resetMuseumExperience(h.player,h.open);assert.equal(w.destroyed,true);assert.deepEqual(h.moves,[['nLP9zE','R57laZ']]);
  w.receive(h.player,{type:'museum:action',token:m.token,revision:m.revision,action:{kind:'answer',text:'교류'}});
  assert.deepEqual(JSON.parse(h.player.storage).museumGames,{});
  h.app.mapHashID='R57laZ';h.api.startMuseumExperience(h.player,h.open);while(h.timers.length)h.timers.shift()();assert.equal(h.opened.at(-1),'npc:museum-pensive-1:prologue');
  h.app.spaceHashID='other';const before=h.player.storage;h.api.resetMuseumExperience(h.player,h.open);assert.equal(h.player.storage,before);
});
test('entry narration skips existing progress and cancels when leaving before its timer',()=>{
  for(const state of [{story:'introduced',completed:[]},{completed:['museum-hou-relations']},{completed:[],prologueSeen:true}]){
    const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.night;h.player.storage=JSON.stringify({museumJourney:state});
    h.api.startMuseumExperience(h.player,h.open);while(h.timers.length)h.timers.shift()();assert.equal(h.opened.length,0);
  }
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.night;h.api.startMuseumExperience(h.player,h.open);
  h.app.mapHashID=h.nav.MUSEUM_MAPS.pensive;while(h.timers.length)h.timers.shift()();
  assert.equal(h.opened.length,0);assert.equal(h.nav.journey(h.player).prologueSeen,false);
});
test('mobile field opens ZEP text prompt, keeps answer as draft and ignores stale callbacks',()=>{
  const h=harness();h.player.isMobile=true;let callback;let prompts=0;h.player.showPrompt=(_text,fn)=>{callback=fn;prompts++;};
  h.player.storage=JSON.stringify({museumGames:{'museum-hou-relations':{...h.game.createGameState(),stage:1,collected:[1,4,7]}}});
  h.api.openMuseumGame(h.player,h.game.GAME_IDS[0],h.open);const w=h.widgets.at(-1);const m=w.messages.at(-1);assert.equal(m.mobile,true);
  w.receive(h.player,{type:'museum:input',token:'invalid'});assert.equal(prompts,0);
  w.receive(h.player,{type:'museum:input',token:m.token});assert.equal(prompts,1);callback('교류');assert.equal(w.messages.at(-1).type,'museum:answer-draft');assert.equal(w.messages.at(-1).text,'교류');assert.equal(h.nav.journey(h.player).completed.length,0);
  w.receive(h.player,{type:'museum:input',token:m.token});const count=w.messages.length;h.api.closeMuseumGame(h.player);callback('교류');assert.equal(w.messages.length,count);
});

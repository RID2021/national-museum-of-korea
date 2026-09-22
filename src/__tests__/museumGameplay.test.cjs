const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const base = path.resolve(__dirname, '../nationalMuseum');
test('lobby five entry smoothly visits 52,40, holds, and returns to the player', () => {
  const source = fs.readFileSync(path.resolve(base, '../utils/camera.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018 } }).outputText;
  const timers = [];
  const calls = [];
  const sandbox = { module: { exports: {} }, exports: {}, require: () => ({}), setTimeout: (fn, ms) => { timers.push({ fn, ms }); } };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(output, sandbox);
  const player = { tileX: 12, tileY: 34, setCameraTarget: (...args) => calls.push(args), sendUpdated: () => calls.push(['updated']) };
  sandbox.module.exports.cameraMoveByMapName(player, '로비(5)');
  assert.deepEqual(calls, [[52, 40, 0.8], ['updated']]);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 3800);
  timers[0].fn();
  assert.deepEqual(calls, [[52, 40, 0.8], ['updated'], [12, 34, 0.8], ['updated']]);
  assert.equal(timers.length, 2);
  assert.equal(timers[1].ms, 800);
  timers[1].fn();
  assert.deepEqual(calls, [[52, 40, 0.8], ['updated'], [12, 34, 0.8], ['updated'], [''], ['updated']]);
});
test('Gaya dialogue quiz validates answers and waits for explanation completion',()=>{
  for(const n of [2]){
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
test('map puzzle drag swaps pieces atomically and keeps click fallback', () => {
  const {game}=harness(), id=game.GAME_IDS[4];
  let state=game.createGameState();
  state.order=[3,0,5,1,2,4];
  const swapped=game.applyGameAction(id,state,{kind:'swap',index:0,target:5});
  assert.deepEqual(Array.from(swapped.order),[4,0,5,1,2,3]);
  assert.equal(swapped.selected,-1);
  for(const target of [-1,6,1.5,'2',undefined]) {
    const result=game.applyGameAction(id,state,{kind:'swap',index:0,target});
    assert.deepEqual(Array.from(result.order),Array.from(state.order));
  }
  const selected=game.applyGameAction(id,state,{kind:'pick',index:0});
  assert.equal(selected.selected,0);
  assert.match(game.gameView(id,state).hint,/드래그/);
  const html=fs.readFileSync(path.resolve(base,'../../res/html/museum-game-v1.html'),'utf8');
  assert.match(html,/b\.dataset\.swapIndex=String\(i\);bindBrickDrag\(b,b,i\)/);
  assert.match(html,/touch-action:none;cursor:grab/);
  assert.match(html,/aspect-ratio:100\/99/);
  assert.match(html,/preserveAspectRatio="none"/);
  assert.match(html,/const SILLA_MAP_ASSET = "data:image\/webp;base64,/);
  assert.match(html,/pieceWidth=400\/2,pieceHeight=594\/3/);
  assert.match(html,/className='location-shell'/);
  assert.match(html,/className='map-pin'/);
  assert.match(html,/className='location-list'/);
  assert.match(html,/지도 위 번호나 아래 목록을 누르면 설명을 확인할 수 있어요/);
  assert.doesNotMatch(html,/const shape='<path/);
});
test('brick artwork covers every label and follows reordered game items', () => {
  const html = fs.readFileSync(path.resolve(base, '../../res/html/museum-game-v1.html'), 'utf8');
  const match = html.match(/const BRICK_ASSETS = (\{[^\n]+\});/);
  assert.ok(match);
  const assets = JSON.parse(match[1]);
  const { game } = harness();
  assert.deepEqual(Array.from(game.BRICKS), ['산수문전','산수봉황문전','산수귀문전','연대귀문전','연화문전','와운문전','반룡문전','봉황문전']);
  assert.deepEqual(Object.keys(assets), Array.from(game.BRICKS));
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
test('bag check artwork covers all seven belongings in game order', () => {
  const html = fs.readFileSync(path.resolve(base, '../../res/html/museum-game-v1.html'), 'utf8');
  const match = html.match(/const BAG_ITEM_ASSETS = (\{[^\n]+\});/);
  assert.ok(match);
  const assets = JSON.parse(match[1]);
  const { game } = harness();
  assert.deepEqual(Object.keys(assets), Array.from(game.ETIQUETTE_ITEMS));
  assert.equal(new Set(Object.values(assets)).size, 7);
  for (const value of Object.values(assets)) assert.ok(value.startsWith('data:image/png;base64,'));
  assert.match(html, /v\.kind==='conveyor'&&BAG_ITEM_ASSETS\[item\]/);
  assert.match(html, /className='bag-item-art'/);
  assert.match(html, /@keyframes bag-flow\{from\{left:-92px\}to\{left:calc\(100% \+ 10px\)\}\}/);
  assert.match(html, /const BAG_FLOW=\(\(\)=>\{/);
  assert.match(html, /Math\.random\(\)/);
  assert.match(html, /dataset\.bagLane=String\(BAG_FLOW\.lanes\[i\]\)/);
  assert.match(html, /const BAG_FLOW_DURATION=10,BAG_FLOW_STARTED_AT=Date\.now\(\)/);
  assert.match(html, /function bagFlowDelay\(index\)/);
  assert.match(html, /setProperty\('--bag-delay',String\(bagFlowDelay\(i\)\)\+'s'\)/);
  assert.match(html, /\.conveyor\{position:relative;display:block;height:320px/);
  assert.match(html, /\.conveyor button\[data-bag-lane="2"\]\{top:206px\}/);
  assert.match(html, /@keyframes mission-clear/);
  assert.match(html, /animation:mission-clear 2s ease-out both/);
  assert.match(html, /\.mission-complete\.artifact/);
  assert.match(html, /id="completion-copy"/);
  assert.match(html, /class="mission-complete"/);
  assert.match(html, /if\(e\.data\?\.type==='museum:complete'\)showCompletion\(e\.data\)/);
  assert.doesNotMatch(html, /animation-play-state:paused/);
  assert.doesNotMatch(html, /className='bag-item-name'/);
});
test('artifact memory game renders themed museum cards instead of plain text', () => {
  const html = fs.readFileSync(path.resolve(base, '../../res/html/museum-game-v1.html'), 'utf8');
  for (const label of ['호우총 청동 그릇','고구려·신라 관계','산수무늬 벽돌','백제 미술','판갑옷과 투구','가야 철기 문화','황남대총 금관','신라 황금 문화','진흥왕 순수비','신라 영토 확장']) assert.ok(html.includes(label));
  assert.match(html, /const MEMORY_CARD_ART=/);
  assert.match(html, /className='memory-card'/);
  assert.match(html, /classList\.add\('memory-back'\)/);
  assert.match(html, /dataset\.memoryTheme=art\[0\]/);
  assert.match(html, /@keyframes card-reveal/);
  assert.match(html, /\.memory\{grid-template-columns:repeat\(5/);
});
test('Goguryeo glyphs and Baekje bricks render as museum-style cards', () => {
  const html = fs.readFileSync(path.resolve(base, '../../res/html/museum-game-v1.html'), 'utf8');
  assert.match(html, /const HANJA_READINGS=/);
  assert.match(html, /classList\.add\('hanja-grid'\)/);
  assert.match(html, /classList\.add\('hanja-card'\)/);
  assert.match(html, /className='hanja-glyph'/);
  assert.match(html, /className='hanja-reading'/);
  assert.match(html, /\.hanja-card:disabled::after\{content:"✓ 찾음"/);
  assert.match(html, /className='brick-position'/);
  assert.match(html, /className='brick-name'/);
  assert.match(html, /const BRICK_THEMES=/);
  assert.match(html, /dataset\.brickTheme=BRICK_THEMES\[item\]/);
  assert.match(html, /className='order-guide'/);
  assert.match(html, /className='order-guide-step'/);
  assert.match(html, /\.order button\{--brick-accent:#496d72;--brick-soft:#dce9e5/);
  assert.match(html, /\.brick-frame\{display:block;position:relative;overflow:hidden;width:64px;height:86px/);
});
test('sparse answer and choice stages use dense museum card layouts', () => {
  const html = fs.readFileSync(path.resolve(base, '../../res/html/museum-game-v1.html'), 'utf8');
  assert.match(html, /id="content"/);
  assert.match(html, /content\.className='stage-'\+v\.kind/);
  assert.match(html, /className='answer-card'/);
  assert.match(html, /className='answer-evidence'/);
  assert.match(html, /className='answer-entry'/);
  assert.match(html, /찾아낸 전시 단서/);
  assert.match(html, /\.stage-answer,\.stage-choices\{display:grid;align-content:center/);
  assert.match(html, /\.choices:not\(\.hanja-grid\)/);
});
test('pensive room guide advances immediately when each indicated NPC is interacted with', () => {
  const h = harness();
  h.app.mapHashID = h.nav.MUSEUM_MAPS.pensive;

  h.api.startMuseumExperience(h.player, h.open);
  assert.deepEqual(h.mapObjects.at(-1).slice(0, 2), [40, 25]);
  assert.match(h.mapObjects.at(-1)[2].path, /guide-arrows\/up\.png$/);
  assert.equal(h.mapObjects.at(-1)[2].anims.idle.length, 58);
  assert.equal(h.mapObjects.at(-1)[2].frameRate, 25);

  h.player.tileX = 19;
  h.player.tileY = 14;
  assert.equal(h.api.interactMuseumNearby(h.player, h.open), true);
  assert.equal(h.opened.length, 0);
  assert.equal(JSON.parse(h.player.storage).museumPensiveGuideStage ?? 0, 0);
  assert.equal(h.centerLabels.at(-1), '먼저 반가사유상 1과 대화해 주세요.');
  h.api.handleMuseumAction(h.player, 'introduction', h.open);
  assert.equal(h.moves.length, 0);

  h.player.tileX = 45;
  h.player.tileY = 14;
  assert.equal(h.api.interactMuseumNearby(h.player, h.open), true);
  assert.equal(h.opened.at(-1), 'npc:museum-pensive-1:intro');
  assert.equal(JSON.parse(h.player.storage).museumPensiveGuideStage, 1);
  assert.equal(h.mapObjects.at(-2)[2], null);
  assert.deepEqual(h.mapObjects.at(-1).slice(0, 2), [18, 25]);

  h.player.tileX = 19;
  h.player.tileY = 14;
  assert.equal(h.api.interactMuseumNearby(h.player, h.open), true);
  assert.equal(h.opened.at(-1), 'npc:museum-pensive-2:intro');
  assert.equal(JSON.parse(h.player.storage).museumPensiveGuideStage, 1);

  h.api.handleMuseumAction(h.player, 'introduction', h.open);
  assert.equal(JSON.parse(h.player.storage).museumPensiveGuideStage, 2);
  assert.equal(h.mapObjects.at(-1)[2], null);
  assert.deepEqual(h.moves.at(-1), ['nLP9zE', h.nav.MUSEUM_MAPS.lobby1]);

  h.api.resetMuseumExperience(h.player, h.open);
  assert.equal(JSON.parse(h.player.storage).museumPensiveGuideStage, 0);
  assert.deepEqual(h.mapObjects.at(-1).slice(0, 2), [40, 25]);
});
test('pensive statue object triggers also require statue one before statue two',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.pensive;
  let npcCalls=0;
  const handleNpc=()=>{npcCalls+=1;return true;};
  assert.equal(h.api.handleMuseumObjectKey(h.player,'npc:반가사유상2',h.open,handleNpc),true);
  assert.equal(npcCalls,0);
  assert.equal(JSON.parse(h.player.storage).museumPensiveGuideStage??0,0);
  assert.equal(h.api.handleMuseumObjectKey(h.player,'npc:반가사유상1',h.open,handleNpc),true);
  assert.equal(npcCalls,1);
  assert.equal(JSON.parse(h.player.storage).museumPensiveGuideStage,1);
  assert.equal(h.api.handleMuseumObjectKey(h.player,'npc:museum-pensive-2:intro',h.open,handleNpc),true);
  assert.equal(npcCalls,2);
  assert.equal(JSON.parse(h.player.storage).museumPensiveGuideStage,1);
});
function harness() {
  const cache = {}, moves = [], localSpawns = [], opened = [], widgets = [], timers = [], mapObjects = [], objectMoves = [], cameraEffects = [], centerLabels = [];
  const keyedObjects = new Map();
  const editorArrow = { tileX: 40, tileY: 25, param1: 'guide-arrow:pensive' };
  const app = {
    spaceHashID: 'nLP9zE',
    mapHashID: '0EAV9k',
    loadSpritesheet: (path, frameWidth, frameHeight, anims, frameRate) => ({ int: 7123, path, frameWidth, frameHeight, anims, frameRate }),
    runLater: fn => timers.push(fn),
  };
  const scriptMap = {
    getObjectsByType: type => type === 21 ? [editorArrow] : [],
    getTopObjectsByType: () => [],
    putObjectWithKey: (...args) => {
      mapObjects.push(args);
      const key = args[3]?.key;
      if (key && args[2] === null) keyedObjects.delete(key);
      else if (key) keyedObjects.set(key, { tileX: args[0], tileY: args[1] });
    },
    getObjectWithKey: key => keyedObjects.get(key) || null,
    playObjectAnimationWithKey() {},
    moveObjectWithKey() { return true; },
    moveObject: (...args) => {
      objectMoves.push(args);
      if (editorArrow.tileX === args[0] && editorArrow.tileY === args[1]) {
        editorArrow.tileX = args[2];
        editorArrow.tileY = args[3];
      }
    },
  };
  const player = { tag: {}, storage: JSON.stringify({ other: 'keep' }), isMobile: false, sendUpdated() {}, save() {}, showCenterLabel: message => centerLabels.push(message), setCameraEffectParam: (...args) => cameraEffects.push(args), spawnAt: (...args) => localSpawns.push(args), spawnAtMap: (...args) => moves.push(args),
    showWidget(file,align,width,height) { const w = { file, align, width, height, destroyed: false, messages: [], destroy() { this.destroyed = true; }, sendMessage(m) { this.messages.push(m); }, onMessage: { Add(fn) { w.receive = fn; } } }; widgets.push(w); return w; } };
  const utils = { preparePlayerTag: p => p.tag, loadPlayerStorage: p => JSON.parse(p.storage), savePlayerStorage: (p, s) => p.storage = JSON.stringify(s), preparePlayerStorage: p => JSON.parse(p.storage) };
  function load(name) {
    if (cache[name]) return cache[name];
    const exports = {}; cache[name] = exports;
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(base, name + '.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS } }).outputText,
      { exports, ScriptApp: app, ScriptMap: scriptMap, setTimeout: fn => timers.push(fn), require: id => id.includes('utils/player') ? utils : load(id.replace('./', '')) });
    return exports;
  }
  return { game: load('games'), nav: load('navigation'), api: load('gameplay'), exploration: load('exploration'), progress: load('progress'), guideArrows: load('guideArrows'), player, app, moves, localSpawns, opened, widgets, timers, mapObjects, objectMoves, cameraEffects, centerLabels, open: (_p, s) => opened.push(s) };
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
  if (n===5)[0,2,4,6].forEach(index=>act({kind:'pick',index}));
  if (n===6)for(let p=0;p<5;p++){act({kind:'pick',index:state.deck.indexOf(p*2)});act({kind:'pick',index:state.deck.indexOf(p*2+1)});}
  return state;
}
test('Goguryeo relation prompt appears only after matching Gwanggaeto letters',()=>{
  const {game}=harness(), id='museum-hou-relations';
  let state=game.createGameState();
  let view=game.gameView(id,state);
  assert.doesNotMatch(view.prompt,/ㄱ ㄹ/);
  for(const index of [1,4])state=game.applyGameAction(id,state,{kind:'pick',index});
  view=game.gameView(id,state);
  assert.doesNotMatch(view.prompt,/ㄱ ㄹ/);
  state=game.applyGameAction(id,state,{kind:'pick',index:7});
  view=game.gameView(id,state);
  assert.match(view.prompt,/ㄱ ㄹ/);
});
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
test('lobby five bag check collects only allowed belongings',()=>{
  const {game}=harness(),id=game.GAME_IDS[5];
  let state=game.createGameState();
  for(const index of [1,3,5])state=game.applyGameAction(id,state,{kind:'pick',index});
  assert.equal(state.done,false);
  assert.deepEqual(Array.from(state.removed),[]);
  for(const index of [0,2,4,6])state=game.applyGameAction(id,state,{kind:'pick',index});
  assert.equal(state.done,true);
  assert.deepEqual(Array.from(state.removed),[0,2,4,6]);
  assert.match(game.gameView(id,state).prompt,/4\/4 획득/);
});
test('unfinished exhibition missions cannot show keeper success or move outside',()=>{
  const h=harness(),finalId=h.game.GAME_IDS[6];
  h.app.mapHashID=h.nav.MUSEUM_MAPS.lobby5;
  h.player.storage=JSON.stringify({museumJourney:{completed:h.game.GAME_IDS.slice(0,4),story:'emergency'},museumGames:{[finalId]:{...h.game.createGameState(),done:true}}});
  h.api.openMuseumGame(h.player,finalId,h.open);
  assert.equal(h.widgets.length,0);
  assert.equal(h.opened.at(-1),'npc:museum-guide-robot:missions-incomplete');
  assert.equal(h.moves.length,0);
  h.api.handleMuseumAction(h.player,'ending',h.open);
  assert.equal(h.nav.journey(h.player).endingSeen,false);
  assert.equal(h.moves.length,0);
});
test('stale completed final-game data is reset before a legitimate new attempt',()=>{
  const h=harness(),finalId=h.game.GAME_IDS[6];
  h.app.mapHashID=h.nav.MUSEUM_MAPS.lobby5;
  h.player.storage=JSON.stringify({museumJourney:{completed:h.game.GAME_IDS.slice(0,6),story:'emergency'},museumGames:{[finalId]:{...h.game.createGameState(),done:true}}});
  h.api.openMuseumGame(h.player,finalId,h.open);
  assert.equal(h.widgets.length,1);
  assert.equal(JSON.parse(h.player.storage).museumGames[finalId].done,false);
  assert.equal(h.moves.length,0);
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
test('completed Goguryeo mission can be replayed and returns to lobby two after success',()=>{
  const h=harness(),id=h.game.GAME_IDS[0];
  h.app.mapHashID=h.nav.MUSEUM_MAPS.goguryeo;
  h.player.storage=JSON.stringify({
    museumJourney:{completed:[id]},
    museumGames:{[id]:solve(h.game,id,h.game.createGameState())},
    museumHouIntroComplete:true,
    museumClues:['gwang','gae','to'],
  });
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-hou-bronze-bowl','intro'),'quiz');
  h.api.openMuseumGame(h.player,id,h.open);
  const w=h.widgets.at(-1);
  assert.ok(w);
  assert.equal(JSON.parse(h.player.storage).museumGames[id].done,false);
  function act(action){const m=w.messages.at(-1);w.receive(h.player,{type:'museum:action',token:m.token,revision:m.revision,action});}
  [1,4,7].forEach(index=>act({kind:'pick',index}));
  act({kind:'answer',text:'교류'});
  assert.equal(w.destroyed,true);
  assert.equal(h.opened.at(-1),'npc:museum-hou-bronze-bowl:success');
  assert.equal(h.nav.journey(h.player).pendingCompletion,id);
  assert.deepEqual(Array.from(h.nav.journey(h.player).completed),[id]);
  h.api.handleMuseumAction(h.player,id,h.open);
  assert.deepEqual(h.moves.at(-1),['nLP9zE',h.nav.MUSEUM_MAPS.lobby2]);
  assert.equal(h.nav.journey(h.player).pendingCompletion,undefined);
});
test('widget-driven full journey completes seven missions, dialogues, moves and ending',()=>{
  const h=harness();
  for(let n=0;n<7;n++){
    const mission=h.nav.MISSIONS[n];h.app.mapHashID=mission.map;
    if(n===6)h.nav.saveMuseumStory(h.player,'emergency');
    if(n===3)h.api.handleMuseumAction(h.player,'hwangnam-crown:correct',h.open);
    else h.api.openMuseumGame(h.player,mission.id,h.open);
    const w=h.widgets.at(-1);
    function act(action){const m=w.messages.at(-1);w.receive(h.player,{type:'museum:action',token:m.token,revision:m.revision,action});}
    const state=()=>JSON.parse(h.player.storage).museumGames[mission.id];
    if(n===0){[1,4,7].forEach(index=>act({kind:'pick',index}));act({kind:'answer',text:'교류'});}
    if(n===1||n===4){for(let i=0;i<state().order.length;i++){const j=state().order.indexOf(i);if(i!==j){act({kind:'pick',index:i});act({kind:'pick',index:j});}}act({kind:'submit'});if(n===4){for(let i=0;i<5;i++)act({kind:'pick',index:i});act({kind:'submit'});}}
    if(n===2){h.api.handleMuseumDialogueChoice(h.player,mission.id,1);h.api.handleMuseumAction(h.player,'quiz-complete:'+mission.id,h.open);}
    if(n===5){[0,2,4,6].forEach(index=>act({kind:'pick',index}));assert.equal(w.messages.at(-1).type,'museum:complete');assert.equal(w.destroyed,false);h.timers.shift()();}
    if(n===6){const deck=state().deck;for(let i=0;i<5;i++){act({kind:'pick',index:deck.indexOf(i*2)});act({kind:'pick',index:deck.indexOf(i*2+1)});}assert.equal(w.messages.at(-1).type,'museum:complete');assert.equal(w.messages.at(-1).theme,'artifact');assert.equal(w.destroyed,false);h.timers.shift()();}
    if(n!==2&&n!==3)assert.equal(w.destroyed,true);assert.equal(h.nav.journey(h.player).completed.length,n+1);
    if(n===5)assert.deepEqual(h.localSpawns.at(-1),[52,40]);
    if(n<6){assert.equal(h.nav.journey(h.player).pendingCompletion,mission.id);h.api.handleMuseumAction(h.player,mission.id,h.open);}
  }
  assert.deepEqual(h.moves.at(-1),['nLP9zE','XWA4Aj']);h.app.mapHashID='XWA4Aj';h.nav.handleMuseumArrival(h.player,h.open);h.timers.shift()();assert.match(h.opened.at(-1),/:ending$/);
  h.api.handleMuseumAction(h.player,'ending',h.open);assert.equal(h.nav.journey(h.player).endingSeen,true);
});
test('mission guide never teleports, while direct room URLs allow their own games',()=>{
  const h=harness();h.app.mapHashID='dJzqzn';h.api.openMuseumGame(h.player,h.game.GAME_IDS[4],h.open);assert.equal(h.widgets.length,1);
  h.api.leaveMuseumExperience(h.player);h.app.mapHashID='r7aeam';h.api.openMuseumGame(h.player,h.game.GAME_IDS[4],h.open);assert.equal(h.widgets.length,1);
  h.player.storage=JSON.stringify({museumJourney:{completed:h.game.GAME_IDS.slice(0,3)}});h.app.mapHashID='eXY3Yx';h.api.continueMuseum(h.player,h.open);assert.equal(h.moves.length,0);assert.equal(h.opened.length,0);
});
test('Jinheung dialogue unlocks a separate map-puzzle object trigger',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.silla2;
  const trigger='npc:museum-jinheung-stele:map-puzzle';
  assert.equal(h.api.handleMuseumSpecialObjectKey(h.player,trigger,h.open),true);
  assert.equal(h.widgets.length,0);
  assert.notEqual(JSON.parse(h.player.storage).museumJinheungIntroComplete,true);
  h.api.handleMuseumAction(h.player,'jinheung-intro-complete',h.open);
  assert.equal(JSON.parse(h.player.storage).museumJinheungIntroComplete,true);
  assert.equal(h.widgets.length,0,'intro completion must not open the map puzzle');
  assert.equal(h.api.handleMuseumSpecialObjectKey(h.player,trigger,h.open),true);
  assert.equal(h.widgets.length,1,'only the second object opens the map puzzle');
  h.api.resetMuseumExperience(h.player,h.open);
  assert.equal(JSON.parse(h.player.storage).museumJinheungIntroComplete,false);
});
test('Jinheung map-puzzle trigger never falls through to the generic NPC dialogue',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.silla2;
  const trigger='npc:museum-jinheung-stele:map-puzzle';
  h.api.handleMuseumAction(h.player,'jinheung-intro-complete',h.open);
  let npcCalls=0;
  assert.equal(h.api.handleMuseumObjectKey(h.player,trigger,h.open,()=>{npcCalls+=1;return true;}),true);
  assert.equal(h.widgets.length,1);
  assert.equal(npcCalls,0,'the generic NPC handler must not replace the game widget');
  assert.equal(h.api.handleMuseumObjectKey(h.player,'npc:museum-jinheung-stele',h.open,()=>{npcCalls+=1;return true;}),true);
  assert.equal(npcCalls,1,'the normal stele trigger must still use the NPC handler');
});
test('Silla two relies on its two editor objects instead of an overlapping NPC proximity fallback',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.silla2;
  h.player.tileX=39;h.player.tileY=27;
  assert.equal(h.exploration.nearbyMuseumNpc(h.player),undefined);
});
test('a directly opened exhibition can complete and show its success dialogue',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.baekje;
  assert.equal(h.nav.handleMuseumMissionCompletion(h.player,h.game.GAME_IDS[1],h.open),true);
  assert.deepEqual(h.nav.journey(h.player).completed,[h.game.GAME_IDS[1]]);
  assert.equal(h.opened.at(-1),'npc:museum-baekje-landscape-brick:success');
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
test('Goguryeo bowl requires intro completion, all three clues, and a return visit',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.goguryeo;
  h.player.storage=JSON.stringify({});
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-hou-bronze-bowl','intro'),'intro');
  h.api.handleMuseumAction(h.player,'hou-intro-complete',h.open);
  assert.equal(JSON.parse(h.player.storage).museumHouIntroComplete,true);
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-hou-bronze-bowl','intro'),'clues-incomplete');
  h.player.storage=JSON.stringify({museumHouIntroComplete:true,museumClues:['gwang']});
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-hou-bronze-bowl','intro'),'clues-incomplete');
  h.player.storage=JSON.stringify({museumHouIntroComplete:true,museumClues:['gwang','gae']});
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-hou-bronze-bowl','intro'),'clues-incomplete');
  h.player.storage=JSON.stringify({museumHouIntroComplete:true,museumClues:['gwang','gae','to']});
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-hou-bronze-bowl','intro'),'quiz');
});
test('Goguryeo relation game starts only after the return-visit quiz dialogue completes',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.goguryeo;
  h.player.storage=JSON.stringify({museumHouIntroComplete:true,museumClues:['gwang','gae','to']});
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-hou-bronze-bowl','intro'),'quiz');
  assert.equal(h.widgets.length,0);
  h.api.handleMuseumAction(h.player,'game:museum-hou-relations',h.open);
  assert.equal(h.widgets.length,1);
});
test('Gaya armor requires its intro and all three exhibit clues before the quiz',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.gaya;
  h.player.storage=JSON.stringify({});
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-gaya-armor-helmet','intro'),'intro');
  h.api.handleMuseumAction(h.player,'gaya-intro-complete',h.open);
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-gaya-armor-helmet','intro'),'clues-incomplete');
  for(const [index,clue] of ['iron-plate','rivet','helmet'].entries()){
    h.api.handleMuseumAction(h.player,'gaya-clue:'+clue,h.open);
    assert.equal(JSON.parse(h.player.storage).museumGayaClues.length,index+1);
    assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-gaya-armor-helmet','intro'),index===2?'quiz':'clues-incomplete');
  }
  h.api.handleMuseumAction(h.player,'gaya-clue:helmet',h.open);
  assert.deepEqual(JSON.parse(h.player.storage).museumGayaClues,['iron-plate','rivet','helmet']);
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
  h.nav.runMuseumSceneTransition(h.player,'goguryeo',h.open);assert.equal(h.nav.journey(h.player).travel.includes('0EAV9k'),false);
  h.app.mapHashID='LB6MNd';h.moves.length=0;assert.equal(h.progress.travelFromMuseumProgress(h.player),false);assert.equal(h.moves.length,0);
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
test('arriving in ordinary maps stays in world; NPC interaction requires proximity',()=>{
  const h=harness();for(const map of Object.values(h.nav.MUSEUM_MAPS).filter(map=>map!==h.nav.MUSEUM_MAPS.night&&map!==h.nav.MUSEUM_MAPS.pensive&&map!==h.nav.MUSEUM_MAPS.baekje&&map!==h.nav.MUSEUM_MAPS.silla1&&map!==h.nav.MUSEUM_MAPS.day)){h.app.mapHashID=map;h.api.startMuseumExperience(h.player,h.open);while(h.timers.length)h.timers.shift()();assert.equal(h.opened.length,0,map);assert.equal(h.moves.length,0,map);}
  h.app.mapHashID='0EAV9k';h.player.tileX=2;h.player.tileY=2;assert.equal(h.api.interactMuseumNearby(h.player,h.open),false);
  h.player.tileX=31;h.player.tileY=30;assert.equal(h.api.interactMuseumNearby(h.player,h.open),true);assert.equal(h.opened.at(-1),'npc:museum-hou-bronze-bowl:intro');
  h.player.storage=JSON.stringify({museumJourney:{completed:[h.game.GAME_IDS[0]],pendingCompletion:h.game.GAME_IDS[0]}});assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-hou-bronze-bowl','intro'),'success');
});
test('night entry opens the two-page prologue once without moving the player',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.night;
  h.api.startMuseumExperience(h.player,h.open);h.api.startMuseumExperience(h.player,h.open);
  while(h.timers.length)h.timers.shift()();
  assert.deepEqual(h.opened,['npc:museum-pensive-1:entry-prologue']);
  assert.equal(h.nav.journey(h.player).entryPrologueSeen,true);
  assert.deepEqual(h.moves,[]);
  h.api.leaveMuseumExperience(h.player);h.player.tag={};h.api.startMuseumExperience(h.player,h.open);
  while(h.timers.length)h.timers.shift()();assert.equal(h.opened.length,1);
});
test('Baekje intro opens once on room entry and all eight brick dialogues unlock the puzzle',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.baekje;
  h.player.storage=JSON.stringify({museumJourney:{completed:[h.game.GAME_IDS[0]]}});
  h.api.startMuseumExperience(h.player,h.open);h.api.startMuseumExperience(h.player,h.open);
  while(h.timers.length)h.timers.shift()();
  assert.deepEqual(h.opened,['npc:museum-baekje-landscape-brick:intro']);
  assert.equal(h.nav.journey(h.player).baekjeIntroSeen,true);
  h.api.leaveMuseumExperience(h.player);h.player.tag={};h.api.startMuseumExperience(h.player,h.open);
  while(h.timers.length)h.timers.shift()();assert.equal(h.opened.length,1);
  const ids=['yeondaegwi','sansu','waun','sansubonghwang','bonghwang','sansugwi','banryong','yeonhwa'];
  for(let i=0;i<ids.length;i++){
    h.api.handleMuseumAction(h.player,'baekje-brick:'+ids[i],h.open);
    assert.equal(h.widgets.length,i===ids.length-1?1:0);
  }
  assert.deepEqual(JSON.parse(h.player.storage).museumBaekjeBricks,ids);
});
test('Silla crown hunt opens once on entry and only the Hwangnam north crown completes',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.silla1;
  h.player.storage=JSON.stringify({museumJourney:{completed:h.game.GAME_IDS.slice(0,3)}});
  h.api.startMuseumExperience(h.player,h.open);h.api.startMuseumExperience(h.player,h.open);
  while(h.timers.length)h.timers.shift()();
  assert.deepEqual(h.opened,['npc:museum-hwangnam-gold-crown:intro']);
  assert.equal(h.nav.journey(h.player).sillaCrownIntroSeen,true);
  h.api.leaveMuseumExperience(h.player);h.player.tag={};h.api.startMuseumExperience(h.player,h.open);
  while(h.timers.length)h.timers.shift()();assert.equal(h.opened.length,1);
  h.api.handleMuseumAction(h.player,'hwangnam-crown:wrong',h.open);
  assert.equal(h.nav.journey(h.player).completed.length,3);
  h.app.mapHashID=h.nav.MUSEUM_MAPS.silla2;
  h.api.handleMuseumAction(h.player,'hwangnam-crown:correct',h.open);
  assert.equal(h.nav.journey(h.player).completed.length,3);
  h.app.mapHashID=h.nav.MUSEUM_MAPS.silla1;
  h.api.handleMuseumAction(h.player,'hwangnam-crown:correct',h.open);
  assert.equal(h.nav.journey(h.player).completed.length,4);
  assert.equal(h.opened.at(-1),'npc:museum-hwangnam-gold-crown:success');
  const openedBeforeRetry=h.opened.length;
  h.api.handleMuseumAction(h.player,'hwangnam-crown:correct',h.open);
  assert.equal(h.nav.journey(h.player).completed.length,4);
  assert.equal(h.opened.length,openedBeforeRetry+1);
  assert.equal(h.opened.at(-1),'npc:museum-hwangnam-gold-crown:success');
  const openedBeforeTravel=h.opened.length;
  h.nav.runMuseumSceneTransition(h.player,h.game.GAME_IDS[3],h.open);
  assert.deepEqual(h.moves.at(-1),['nLP9zE',h.nav.MUSEUM_MAPS.silla2]);
  assert.equal(h.nav.journey(h.player).pendingCompletion,undefined);
  h.app.mapHashID=h.nav.MUSEUM_MAPS.silla1;
  h.api.handleMuseumAction(h.player,'hwangnam-crown:correct',h.open);
  assert.equal(h.opened.length,openedBeforeTravel+1);
  assert.equal(h.opened.at(-1),'npc:museum-hwangnam-gold-crown:success');
  assert.equal(h.nav.journey(h.player).pendingCompletion,h.game.GAME_IDS[3]);
});
test('pensive-room closing broadcast stays bright, then darkens after its final page without chaining or teleporting',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.pensive;
  h.api.startMuseumExperience(h.player,h.open);h.api.startMuseumExperience(h.player,h.open);
  while(h.timers.length)h.timers.shift()();
  assert.deepEqual(h.opened,['npc:museum-pensive-1:prologue']);
  assert.equal(h.nav.journey(h.player).pensiveBroadcastSeen,true);
  assert.deepEqual(h.cameraEffects.at(0),[0,0]);
  // ZEP may initialize the same player again while page 1/3 is still open.
  // A started broadcast must remain bright until its final page completes.
  h.api.startMuseumExperience(h.player,h.open);
  assert.deepEqual(h.cameraEffects.at(-1),[0,0]);
  h.api.handleMuseumAction(h.player,'prologue',h.open);
  assert.deepEqual(h.cameraEffects.at(-1),[1,650]);
  assert.equal(h.nav.journey(h.player).pensiveLightsOut,true);
  h.api.leaveMuseumExperience(h.player);h.player.tag={};h.api.startMuseumExperience(h.player,h.open);
  while(h.timers.length)h.timers.shift()();
  assert.equal(h.opened.length,1);assert.equal(h.moves.length,0);
  assert.deepEqual(h.cameraEffects.at(-1),[1,650]);
  assert.equal(JSON.parse(h.player.storage).other,'keep');
  h.app.mapHashID=h.nav.MUSEUM_MAPS.pensive;
  assert.equal(h.exploration.resolveMuseumSceneId(h.player,'museum-pensive-1','intro'),'intro');
});
test('museum reset clears narrative, missions and games, preserves unrelated data and restarts narration',()=>{
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.pensive;
  h.player.storage=JSON.stringify({other:'keep',inventory:['keep'],missionProgress:{missions:{tomb:true}},museumJourney:{completed:h.game.GAME_IDS,prologueSeen:true,story:'ending',endingSeen:true,pendingEnding:true,travel:['0EAV9k']},museumGames:{saved:{done:true}},missionNpc:{seenSceneKeys:['museum-pensive-1:prologue','other:intro']}});
  let destroyed=false;h.player.tag.missionNpcWidget={destroy(){destroyed=true;}};h.player.tag.missionNpcId='museum-guide-robot';
  h.api.resetMuseumExperience(h.player,h.open);
  const data=JSON.parse(h.player.storage);
  assert.deepEqual(data.museumJourney,{completed:[]});assert.deepEqual(data.museumGames,{});
  assert.deepEqual(data.museumClues,[]);assert.equal(data.museumHouIntroComplete,false);assert.deepEqual(data.museumBaekjeBricks,[]);
  assert.equal(data.museumGayaIntroComplete,false);assert.deepEqual(data.museumGayaClues,[]);
  assert.deepEqual(data.inventory,['keep']);assert.deepEqual(data.missionProgress,{missions:{tomb:true}});assert.equal(data.other,'keep');
  assert.deepEqual(data.missionNpc.seenSceneKeys,['other:intro']);assert.equal(destroyed,true);assert.equal(h.player.tag.missionNpcId,undefined);
  while(h.timers.length)h.timers.shift()();assert.deepEqual(h.opened,[]);
  h.api.startMuseumExperience(h.player,h.open);while(h.timers.length)h.timers.shift()();assert.equal(h.opened.length,1);
});
test('museum reset stays in place and invalidates the old game widget',()=>{
  const h=harness();h.api.openMuseumGame(h.player,h.game.GAME_IDS[0],h.open);const w=h.widgets.at(-1), m=w.messages.at(-1);
  h.api.resetMuseumExperience(h.player,h.open);assert.equal(w.destroyed,true);assert.deepEqual(h.moves,[]);
  w.receive(h.player,{type:'museum:action',token:m.token,revision:m.revision,action:{kind:'answer',text:'교류'}});
  assert.deepEqual(JSON.parse(h.player.storage).museumGames,{});
  h.app.mapHashID=h.nav.MUSEUM_MAPS.pensive;h.api.startMuseumExperience(h.player,h.open);while(h.timers.length)h.timers.shift()();assert.equal(h.opened.at(-1),'npc:museum-pensive-1:prologue');
  h.app.spaceHashID='other';const before=h.player.storage;h.api.resetMuseumExperience(h.player,h.open);assert.equal(h.player.storage,before);
});
test('pensive broadcast skips only after it was seen and cancels when leaving before its timer',()=>{
  const seen=harness();seen.app.mapHashID=seen.nav.MUSEUM_MAPS.pensive;seen.player.storage=JSON.stringify({museumJourney:{completed:[],pensiveBroadcastSeen:true}});
  seen.api.startMuseumExperience(seen.player,seen.open);while(seen.timers.length)seen.timers.shift()();assert.equal(seen.opened.length,0);
  const h=harness();h.app.mapHashID=h.nav.MUSEUM_MAPS.pensive;h.api.startMuseumExperience(h.player,h.open);
  h.app.mapHashID=h.nav.MUSEUM_MAPS.lobby1;while(h.timers.length)h.timers.shift()();
  assert.equal(h.opened.length,0);assert.equal(h.nav.journey(h.player).pensiveBroadcastSeen,false);
});
test('mobile field opens ZEP text prompt, keeps answer as draft and ignores stale callbacks',()=>{
  const h=harness();h.player.isMobile=true;let callback;let prompts=0;h.player.showPrompt=(_text,fn)=>{callback=fn;prompts++;};
  h.player.storage=JSON.stringify({museumGames:{'museum-hou-relations':{...h.game.createGameState(),stage:1,collected:[1,4,7]}}});
  h.api.openMuseumGame(h.player,h.game.GAME_IDS[0],h.open);const w=h.widgets.at(-1);const m=w.messages.at(-1);assert.equal(m.mobile,true);
  w.receive(h.player,{type:'museum:input',token:'invalid'});assert.equal(prompts,0);
  w.receive(h.player,{type:'museum:input',token:m.token});assert.equal(prompts,1);callback('교류');assert.equal(w.messages.at(-1).type,'museum:answer-draft');assert.equal(w.messages.at(-1).text,'교류');assert.equal(h.nav.journey(h.player).completed.length,0);
  w.receive(h.player,{type:'museum:input',token:m.token});const count=w.messages.length;h.api.closeMuseumGame(h.player);callback('교류');assert.equal(w.messages.length,count);
});

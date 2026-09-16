const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");
function navigationHarness() {
  const exports = {}, moves = [], opened = [], timers = [];
  const player = { storage: JSON.stringify({ keep: "existing" }), tag: {}, spawnAtMap: (...args) => moves.push(args) };
  const context = { exports, ScriptApp: { spaceHashID: "nLP9zE", mapHashID: "R57laZ" },
    setTimeout: fn => timers.push(fn), require: () => ({
      loadPlayerStorage: p => JSON.parse(p.storage),
      savePlayerStorage: (p, data) => { p.storage = JSON.stringify(data); },
    }) };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, "src/nationalMuseum/navigation.ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  const open = (_p, trigger) => opened.push(trigger);
  return { api: exports, context, player, moves, opened, timers, open };
}

test("dialogue completion routes match live map portals and reject wrong source maps", () => {
  const h = navigationHarness();
  h.context.ScriptApp.mapHashID = "R57laZ";
  h.api.runMuseumSceneTransition(h.player, "prologue", h.open);
  assert.equal(h.moves.length, 0, "Entry narration leaves the player free to explore");
  for (const [id, source, target] of [["introduction", "WarEng", "LB6MNd"], ["goguryeo", "LB6MNd", "0EAV9k"]]) {
    h.context.ScriptApp.mapHashID = "wrong";
    const before = h.moves.length;
    h.api.runMuseumSceneTransition(h.player, id, h.open);
    assert.equal(h.moves.length, before);
    h.context.ScriptApp.mapHashID = source;
    h.api.runMuseumSceneTransition(h.player, id, h.open);
    assert.deepEqual(h.moves.at(-1), ["nLP9zE", target]);
  }
});

test("all seven mission transitions require correct-room completion and are idempotent", () => {
  const h = navigationHarness();
  const routes = [
    ["museum-hou-relations", "0EAV9k", "pnNepx"], ["museum-baekje-bricks", "kP0x5B", "xEOeqz"],
    ["museum-gaya-iron", "7RE0Ea", "eXY3Yx"], ["museum-hwangnam-crown", "r7aeam", "dJzqzn"],
    ["museum-jinheung-locations", "dJzqzn", "pnNeN3"], ["museum-etiquette", "pnNeN3", null],
    ["museum-artifact-cards", "pnNeN3", "XWA4Aj"],
  ];
  h.context.ScriptApp.mapHashID = "wrong";
  h.api.handleMuseumMissionCompletion(h.player, "museum-artifact-cards", h.open);
  assert.equal(h.moves.length, 0);
  for (const [id, source, target] of routes) {
    h.context.ScriptApp.mapHashID = source;
    let before = h.moves.length;
    h.api.runMuseumSceneTransition(h.player, id, h.open);
    assert.equal(h.moves.length, before, "preview must not teleport");
    h.api.handleMuseumMissionCompletion(h.player, id, h.open);
    if (id !== "museum-artifact-cards") {
      assert.equal(h.moves.length, before, "wait for success dialogue completion");
      h.api.runMuseumSceneTransition(h.player, id, h.open);
    }
    if (target) assert.deepEqual(h.moves.at(-1), ["nLP9zE", target]);
    else assert.equal(h.opened.at(-1), "npc:museum-guide-robot:meeting");
    before = h.moves.length;
    h.api.handleMuseumMissionCompletion(h.player, id, h.open);
    h.api.runMuseumSceneTransition(h.player, id, h.open);
    assert.equal(h.moves.length, before);
  }
  h.context.ScriptApp.mapHashID = "XWA4Aj";
  h.api.handleMuseumArrival(h.player, h.open);
  h.timers.shift()();
  assert.equal(h.opened.at(-1), "npc:museum-guide-robot:ending");
  assert.equal(JSON.parse(h.player.storage).keep, "existing");
});

test("closing a dialogue has no completion side effects; pending success survives reconnect", () => {
  const source = fs.readFileSync(path.join(root, "src/missionNpc/index.ts"), "utf8");
  const close = source.slice(source.indexOf('if (type === "mission-npc:close")'), source.indexOf('if (type === "mission-npc:complete")'));
  assert.doesNotMatch(close, /runSceneAfterAction|runMuseumSceneTransition/);
  const h = navigationHarness();
  h.context.ScriptApp.mapHashID = "0EAV9k";
  h.api.handleMuseumMissionCompletion(h.player, "museum-hou-relations", h.open);
  h.player.tag = {};
  h.api.handleMuseumArrival(h.player, h.open);
  assert.equal(h.timers.length, 0, "arrival must not reopen an NPC remotely");
  assert.equal(JSON.parse(h.player.storage).museumJourney.pendingCompletion, "museum-hou-relations");
  assert.equal(h.moves.length, 0);
  h.api.runMuseumSceneTransition(h.player, "museum-hou-relations", h.open);
  assert.deepEqual(h.moves[0], ["nLP9zE", "pnNepx"]);
});
test("maps without task artwork do not create invisible widgets", () => {
  const source = fs.readFileSync(path.join(root, "src/task/index.ts"), "utf8");
  const exports = {};
  let created = 0, destroyed = 0;
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: () => ({
    debugMessage() {}, doubleTaskMap: {}, loadPlayerStorage: () => ({}),
    preparePlayerTag: p => p.tag, savePlayerStorage() {},
  }) });
  const player = { tag: { taskWidget: { destroy() { destroyed++; } } },
    showWidget() { created++; } };
  assert.equal(exports.loadTaskWidget("신라실(1)", player), null);
  assert.equal(destroyed, 1);
  assert.equal(created, 0);
  assert.equal(player.tag.taskWidget, null);
});
test("editor F with no key resolves exact coordinates on the correct layer", () => {
  const source = fs.readFileSync(path.join(root, "src/nationalMuseum/editorInteraction.ts"), "utf8");
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, ScriptMap: {
    getObjectsByType: () => [{ tileX: 39, tileY: 27, param1: "npc:object" }],
    getTopObjectsByType: () => [{ tileX: 39, tileY: 27, param1: " npc:museum-jinheung-stele " }],
  } });
  assert.equal(exports.getEditorInteractionValue(5, 39, 27), "npc:museum-jinheung-stele");
  assert.equal(exports.getEditorInteractionValue(3, 39, 27), "npc:object");
  assert.equal(exports.getEditorInteractionValue(5, 40, 27), null);
  assert.equal(exports.getEditorInteractionValue(2, 39, 27), null);
});
test("portal map lookup uses the ZEP-compatible direct global property", () => {
  const source = fs.readFileSync(path.join(root, "src/portal/portalGates.ts"), "utf8");
  assert.doesNotMatch(source, /=\s*ScriptApp\s+as/);
  assert.match(source, /const mapHashId: unknown = ScriptApp\.mapHashID/);
});

test("museum diagnostic positioning is restricted to opted-in museum administrators", () => {
  const source = fs.readFileSync(path.join(root, "src/nationalMuseum/diagnostics.ts"), "utf8");
  const exports = {};
  const moves = [];
  const context = {
    exports,
    require: () => ({ debugMessage() {}, preparePlayerTag: p => p.tag }),
    ScriptApp: { spaceHashID: "nLP9zE", mapHashID: "test" },
    ScriptMap: { name: "test", width: 50, height: 50, getTile: (_l, x) => x === 5 ? 1 : -1,
      getObjectsByType: () => [], getTopObjectsByType: () => [] },
  };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  const player = { role: 100, tag: {}, spawnAt: (x, y) => moves.push([x, y]) };
  const run = text => exports.handleMuseumDiagnosticCommand(player, text);
  assert.equal(run("#museum-check"), false);
  player.role = 3000;
  assert.equal(run("#museum-at 3 4"), false);
  run("#museum-check");
  run("#museum-at 3 4");
  run("#museum-at 5 4");
  run("#museum-at 99 4");
  context.ScriptApp.spaceHashID = "other";
  assert.equal(run("#museum-at 3 4"), false);
  assert.deepEqual(moves, [[3, 4]]);
  assert.throws(() => exports.runMuseumDiagnosticPhase("test", () => { throw new Error("failure"); }), /failure/);
});
const dataSource = fs.readFileSync(path.join(root, "src/nationalMuseum/npcs.ts"), "utf8");
const data = {};
const gameData = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/nationalMuseum/games.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS },
}).outputText, { exports: gameData });
vm.runInNewContext(ts.transpileModule(dataSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS },
}).outputText, { exports: data, require: () => gameData });

// Exercise the registered museum data against the actual existing router.
const engineSource = fs.readFileSync(path.join(root, "src/missionNpc/index.ts"), "utf8");
const file = ts.createSourceFile("engine.ts", engineSource, ts.ScriptTarget.Latest, true);
const names = new Set([
  "normalizeTrigger", "normalizeAliasKey", "resolveNpcIdAlias", "resolveSceneIdAlias",
  "doesNpcMatchCurrentMap", "parseSceneOnlyTrigger", "isGenericSceneOnlyAlias",
  "getNpcLocationAliases", "getSceneLocationAliases", "parseNpcTrigger",
  "getNpcDefinition", "getNpcScene", "handleMissionNpcTrigger",
  "handleMissionNpcObjectKey", "addNpcLocationTrigger", "registerMissionNpcLocations",
  "buildNpcPayload", "runSceneAfterAction",
]);
const functions = file.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name.text))
  .map(node => node.getText(file).replace(/^export /, "")).join("\n");

function setup() {
  const opened = [];
  const entered = new Map();
  const touched = new Map();
  const timers = [];
  const player = { tag: {}, storage: "unchanged" };
  const context = {
    NPC_TRIGGER_PREFIXES: ["npc:", "dialog:"], DEFAULT_SCENE_ID: "intro",
    NPC_ID_ALIASES: data.NATIONAL_MUSEUM_NPC_ALIASES,
    NPC_SCENE_ALIASES: data.NATIONAL_MUSEUM_SCENE_ALIASES,
    MISSION_NPCS: data.NATIONAL_MUSEUM_NPCS,
    registeredMissionNpcLocationNames: new Set(),
    ScriptMap: { name: "국립중앙박물관" },
    ScriptApp: {
      addOnLocationEnter: (key, fn) => entered.set(key, fn),
      addOnLocationTouched: (key, fn) => touched.set(key, fn),
    },
    preparePlayerTag: p => p.tag,
    resolveMuseumSceneId: (_p, _npc, id) => id,
    resolveProgressScene: (_p, _n, scene) => scene,
    isSceneOpenOrPending: (tag, n, s) => tag.missionNpcId === n.id && tag.missionNpcSceneId === s.id,
    areSceneRequirementsComplete: () => true,
    hasSeenOncePerPlayerScene: () => false,
    markOncePerPlayerSceneSeen: () => {},
    runSceneImmediateAction: () => false,
    runScenePreDialogueCamera: () => false,
    requestMissionNpcAdvance: () => { context.advances++; return true; },
    buildDynamicSceneForPlayer: (_p, scene) => scene,
    advances: 0,
    openMissionNpc(p, n, s) {
      p.tag.missionNpcId = n.id;
      p.tag.missionNpcSceneId = s.id;
      p.tag.missionNpcWidget = {};
      opened.push({ npc: n, scene: s });
    },
    setTimeout: fn => timers.push(fn),
  };
  vm.runInNewContext(ts.transpileModule(functions, {
    compilerOptions: { target: ts.ScriptTarget.ES2019 },
  }).outputText, context);
  return { context, player, opened, entered, touched, timers };
}

test("the script has eight distinct speakers and 49 nonempty dialogue scenes", () => {
  const npcs = data.NATIONAL_MUSEUM_NPCS;
  assert.equal(npcs.length, 8);
  assert.equal(new Set(npcs.map(n => n.id)).size, 8);
  assert.equal(npcs.flatMap(n => n.scenes).length, 49);
  for (const n of npcs) {
    assert.ok(n.scenes.some(s => s.id === "intro"));
    assert.equal(new Set(n.scenes.map(s => s.id)).size, n.scenes.length);
    for (const s of n.scenes) {
      const lines = s.speakerLines?.map(l => l.text) ?? s.lines;
      assert.ok(lines.length > 0);
      assert.ok(lines.every(line => typeof line === "string" && line.trim()));
    }
  }
});

test("all 49 fully qualified object triggers route to the intended NPC and scene", () => {
  for (const npc of data.NATIONAL_MUSEUM_NPCS) {
    for (const scene of npc.scenes) {
      const { context, player, opened } = setup();
      assert.equal(context.handleMissionNpcObjectKey(player, `npc:${npc.id}:${scene.id}`), true);
      assert.equal(opened[0].npc.id, npc.id);
      assert.equal(opened[0].scene.id, scene.id);
    }
  }
});

test("Baekje has eight distinct brick triggers with completion actions", () => {
  const baekje = data.NATIONAL_MUSEUM_NPCS.find(n => n.id === "museum-baekje-landscape-brick");
  const ids = ["yeondaegwi", "sansu", "waun", "sansubonghwang", "bonghwang", "sansugwi", "banryong", "yeonhwa"];
  assert.deepEqual(Array.from(baekje.scenes.filter(s => s.id.startsWith("brick-")).map(s => s.id)), ids.map(id => `brick-${id}`));
  assert.deepEqual(Array.from(baekje.scenes.filter(s => s.id.startsWith("brick-")).map(s => s.museumTransitionId)), ids.map(id => `baekje-brick:${id}`));
  const intro = baekje.scenes.find(s => s.id === "intro");
  assert.equal(intro.oncePerPlayer, true);
  assert.equal(intro.lines.length, 6);
});
test("Gaya has three lightweight exhibit clues before its dialogue quiz", () => {
  const gaya = data.NATIONAL_MUSEUM_NPCS.find(n => n.id === "museum-gaya-armor-helmet");
  const clues = gaya.scenes.filter(scene => scene.id.startsWith("clue-"));
  assert.deepEqual(Array.from(clues.map(scene => scene.id)), ["clue-iron-plate", "clue-rivet", "clue-helmet"]);
  assert.deepEqual(Array.from(clues.map(scene => scene.museumTransitionId)), ["gaya-clue:iron-plate", "gaya-clue:rivet", "gaya-clue:helmet"]);
  assert.equal(gaya.scenes.find(scene => scene.id === "intro").museumTransitionId, "gaya-intro-complete");
  assert.equal(gaya.scenes.find(scene => scene.id === "quiz").choices.length, 3);
});

test("Goguryeo clue triggers persist the exact gwang, gae and to identifiers", () => {
  const { context, player } = setup();
  player.storage = JSON.stringify({ museumClues: [] });
  for (const clue of ["gwang", "gae", "to"]) {
    player.tag = {};
    assert.equal(context.handleMissionNpcTrigger(player, `npc:museum-hou-bronze-bowl:clue-${clue}`), true);
  }
  assert.deepEqual(JSON.parse(player.storage).museumClues, ["gwang", "gae", "to"]);
});

test("Korean aliases, default intros, and dialog prefix resolve correctly", () => {
  const { context, player, opened } = setup();
  for (const [alias, npcId] of Object.entries(data.NATIONAL_MUSEUM_NPC_ALIASES)) {
    player.tag = {};
    assert.equal(context.handleMissionNpcTrigger(player, `dialog:${alias}`), true);
    assert.equal(opened.at(-1).npc.id, npcId);
    assert.equal(opened.at(-1).scene.id, "intro");
  }
  player.tag = {};
  assert.equal(context.handleMissionNpcTrigger(player, "npc:판갑옷과투구:성공|label"), true);
  assert.equal(opened.at(-1).scene.id, "success");
  assert.equal(opened.at(-1).npc.id, "museum-gaya-armor-helmet");
});

test("location entry/touch registration is idempotent and opens the same dialogue", () => {
  const { context, player, opened, entered, touched } = setup();
  context.registerMissionNpcLocations();
  const count = entered.size;
  context.registerMissionNpcLocations();
  assert.equal(entered.size, count);
  assert.equal(touched.size, count);
  for (const npc of data.NATIONAL_MUSEUM_NPCS) {
    const key = `npc:${npc.id}:intro`;
    player.tag = {};
    entered.get(key)(player);
    assert.equal(opened.at(-1).npc.id, npc.id);
    player.tag = {};
    touched.get(key)(player);
    assert.equal(opened.at(-1).npc.id, npc.id);
  }
});

test("repeated F advances the current dialogue; another NPC switches speaker", () => {
  const { context, player, opened } = setup();
  context.handleMissionNpcObjectKey(player, "npc:반가사유상1");
  context.handleMissionNpcObjectKey(player, "npc:반가사유상1");
  assert.equal(opened.length, 1);
  assert.equal(context.advances, 1);
  context.handleMissionNpcObjectKey(player, "npc:안내로봇");
  assert.equal(opened.length, 2);
  assert.equal(opened.at(-1).npc.name, "안내 로봇");
});

test("unknown NPCs and unknown scenes do not open a substitute dialogue", () => {
  const { context, player, opened } = setup();
  for (const key of [null, "", "npc:missing", "npc:안내로봇:missing", "npc:진흥왕", "npc:김정희"]) {
    assert.equal(context.handleMissionNpcTrigger(player, key), false);
  }
  assert.equal(opened.length, 0);
});

test("intro and meeting switch names and portraits in original script order", () => {
  const { context, player } = setup();
  const statue = data.NATIONAL_MUSEUM_NPCS[0];
  const intro = context.buildNpcPayload(player, statue, statue.scenes.find(s => s.id === "intro"));
  assert.equal(intro.speakerLines[0].speakerless, true);
  assert.deepEqual(Array.from(intro.speakerLines.slice(1).map(l => l.speakerName)), [
    "반가사유상 ①", "반가사유상 ②", "반가사유상 ①", "반가사유상 ②", "반가사유상 ①", "반가사유상 ②",
  ]);
  const robot = data.NATIONAL_MUSEUM_NPCS.find(n => n.id === "museum-guide-robot");
  const meeting = context.buildNpcPayload(player, robot, robot.scenes.find(s => s.id === "meeting"));
  assert.deepEqual(Array.from(meeting.speakerLines.map(l => l.speakerName)), [
    "안내 로봇", "호우총 청동 그릇", "산수문전 벽돌", "진흥왕 순수비", "황남대총 금관", "판갑옷과 투구",
  ]);
  const ending = context.buildNpcPayload(player, robot, robot.scenes.find(s => s.id === "ending"));
  assert.equal(ending.speakerlessLineTexts.length, 3);
});

test("Goguryeo NPC dialogue does not reveal the relation answer prompt", () => {
  const bowl = data.NATIONAL_MUSEUM_NPCS.find(n => n.id === "museum-hou-bronze-bowl");
  const quiz = bowl.scenes.find(s => s.id === "quiz");
  assert.equal(quiz.lines.some(line => line.includes("[ ㄱ ㄹ ]")), false);
});

test("meeting completion queues the emergency dialogue and resolves its target", () => {
  const { context, player, opened, timers } = setup();
  const robot = data.NATIONAL_MUSEUM_NPCS.find(n => n.id === "museum-guide-robot");
  context.runSceneAfterAction(player, robot.scenes.find(s => s.id === "meeting"));
  assert.equal(opened.length, 0);
  timers.shift()();
  assert.equal(opened[0].npc.id, robot.id);
  assert.equal(opened[0].scene.id, "emergency");
});

test("all linked portraits exist; dialogue previews cannot grant puzzle completion", () => {
  for (const npc of data.NATIONAL_MUSEUM_NPCS) {
    const urls = [npc.profileImageUrl];
    for (const scene of npc.scenes) {
      for (const field of ["missionId", "stepId", "stepIds", "rewardItems", "afterGameTrigger", "afterTeleport", "afterMapTeleport"]) {
        assert.equal(scene[field], undefined);
      }
      urls.push(...(scene.speakerLines ?? []).map(l => l.profileImageUrl).filter(Boolean));
    }
    for (const url of urls) {
      assert.equal(fs.existsSync(path.resolve(root, "res/html", url)), true, url);
    }
  }
});

test("the separate museum app registers the new NPCs and targets the confirmed app", () => {
  assert.match(engineSource, /from ["']\.\.\/nationalMuseum/);
  assert.match(engineSource, /\.\.\.NATIONAL_MUSEUM_NPCS/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "zep-script.json"), "utf8")).appId, "53Xe2L");
  const target = JSON.parse(fs.readFileSync(path.join(root, "zep-space.json"), "utf8"));
  assert.equal(target.spaceHashId, "nLP9zE");
  assert.equal(target.entryMapHashId, "R57laZ");
});

test("actual lobby and Silla map labels match the museum map editor", () => {
  const robot = data.NATIONAL_MUSEUM_NPCS.find(n => n.id === "museum-guide-robot");
  for (let i = 1; i <= 5; i++) assert.ok(robot.mapNames.includes(`로비(${i})`));
  assert.ok(data.NATIONAL_MUSEUM_NPCS.find(n => n.id === "museum-hwangnam-gold-crown").mapNames.includes("신라실(1)"));
  assert.ok(data.NATIONAL_MUSEUM_NPCS.find(n => n.id === "museum-jinheung-stele").mapNames.includes("신라실(2)"));
});

test("generated widget embeds all eight original PNGs without relative-image requests", () => {
  const html = fs.readFileSync(path.join(root, "res/html/museum-npc-widget-v1.html"), "utf8");
  const match = html.match(/const MUSEUM_PORTRAITS = (\{[^\n]+\});/);
  assert.ok(match);
  const portraits = JSON.parse(match[1]);
  assert.equal(Object.keys(portraits).length, 8);
  for (const npc of data.NATIONAL_MUSEUM_NPCS) {
    const uri = portraits[npc.profileImageUrl];
    assert.ok(uri.startsWith("data:image/png;base64,"));
    assert.deepEqual(Buffer.from(uri.split(",")[1], "base64"), fs.readFileSync(path.resolve(root, "res/html", npc.profileImageUrl)));
  }
  assert.match(html, /profileImageElement.src = MUSEUM_PORTRAITS\[portraitUrl\] \|\| portraitUrl/);
  assert.doesNotMatch(html, /data:video\/mp4;base64/);
});

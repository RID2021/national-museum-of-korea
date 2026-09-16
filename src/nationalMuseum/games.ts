// MVP rule engine. Only this server module decides completion; the widget sends actions.
export const GAME_IDS = ["museum-hou-relations", "museum-baekje-bricks", "museum-gaya-iron", "museum-hwangnam-crown", "museum-jinheung-locations", "museum-etiquette", "museum-artifact-cards"];
export const GAME_TITLES = ["광개토의 글자와 교류", "백제 문양전 복원", "가야 철 문화 퀴즈", "황남대총 금관 찾기", "신라의 발자취", "관람 예절 가방 검사", "유물의 빛 돌려보내기"];
export const BRICKS = ["산수문전", "산수봉황문전", "산수귀문전", "연대귀문전", "연화문전", "와운문전", "반룡문전", "봉황문전"];
export const CROWNS = ["교동 금관", "황남대총 북분 금관", "금관총 금관", "천마총 금관", "금령총 금관", "서봉총 금관"];
export const PLACES = [
  { name: "북한산 순수비", description: "서울 북한산 비봉. 한강 유역으로 넓어진 신라의 세력을 보여 줍니다.", x: 33, y: 58 },
  { name: "창녕 척경비", description: "경남 창녕. 진흥왕 때 신라의 영역에 편입된 낙동강 유역을 살펴볼 수 있습니다.", x: 59, y: 81 },
  { name: "황초령 순수비", description: "함경남도 황초령. 신라의 세력이 동북쪽으로 뻗었음을 보여 줍니다.", x: 62, y: 29 },
  { name: "마운령 순수비", description: "함경남도 마운령. 황초령비와 함께 동북 지역 진출을 알려 줍니다.", x: 78, y: 22 },
  { name: "단양 적성비", description: "충북 단양. 새로 확보한 지역의 주민을 포상한 기록이 남아 있습니다. 순수비와 구분해 보세요.", x: 48, y: 66 },
];
export const PAIRS = [
  ["호우총 청동 그릇", "고구려·신라 관계"], ["산수무늬 벽돌", "백제 미술"],
  ["판갑옷과 투구", "가야 철기 문화"], ["황남대총 금관", "신라 황금 문화"], ["진흥왕 순수비", "신라 영토 확장"],
];
export type GameState = { stage: number; collected: number[]; order: number[]; selected: number; visited: number[]; removed: number[]; deck: number[]; face: number[]; matched: number[]; moves: number; done: boolean; feedback: string };
export type GameAction = { kind?: string; index?: number; target?: number; text?: string };
export function createGameState(random: () => number = Math.random): GameState {
  const deck = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return { stage: 0, collected: [], order: [3, 0, 5, 1, 7, 2, 6, 4], selected: -1, visited: [], removed: [], deck, face: [], matched: [], moves: 0, done: false, feedback: "" };
}
function toggleSwap(state: GameState, index: number): void {
  if (state.selected < 0) state.selected = index;
  else { const first = state.selected; [state.order[first], state.order[index]] = [state.order[index], state.order[first]]; state.selected = -1; }
}
export function applyGameAction(id: string, state: GameState, action: GameAction): GameState {
  if (state.done || !GAME_IDS.includes(id) || !action || typeof action !== "object") return state;
  const s: GameState = JSON.parse(JSON.stringify(state));
  const i = action.index;
  const valid = (length: number): boolean => Number.isInteger(i) && i! >= 0 && i! < length;
  s.feedback = "";
  if (id === GAME_IDS[0]) {
    if (s.stage === 0 && action.kind === "pick" && valid(9)) {
      if ([1, 4, 7].includes(i!)) { if (!s.collected.includes(i!)) s.collected.push(i!); s.feedback = "빛나는 글자를 찾았어요!"; }
      else s.feedback = "힌트: 廣(광), 開(개), 土(토)를 찾아보세요.";
      if (s.collected.length === 3) { s.stage = 1; s.feedback = "세 글자를 모두 찾았어요. 이제 두 나라의 관계를 추론해 보세요."; }
    }
    if (s.stage === 1 && action.kind === "answer") {
      s.done = typeof action.text === "string" && action.text.replace(/\s/g, "").normalize("NFC") === "교류";
      if (!s.done) s.feedback = "다시 생각해 보세요. 서로 오가며 관계를 맺는 것을 뜻하는 두 글자, ㄱㄹ입니다.";
    }
  } else if (id === GAME_IDS[1]) {
    if (action.kind === "swap" && valid(8) && Number.isInteger(action.target) && action.target! >= 0 && action.target! < 8 && action.target !== i) {
      [s.order[i!], s.order[action.target!]] = [s.order[action.target!], s.order[i!]];
      s.selected = -1;
    }
    if (action.kind === "pick" && valid(8)) toggleSwap(s, i!);
    if (action.kind === "submit") { s.done = s.order.every((value, index) => value === index); if (!s.done) s.feedback = "아직 다른 자리가 있어요. 복원 안내의 이름과 위→아래, 왼쪽→오른쪽 순서를 비교하세요."; }
  } else if (id === GAME_IDS[2] || id === GAME_IDS[3]) {
    if (action.kind === "pick" && valid(id === GAME_IDS[2] ? 3 : 6)) {
      s.done = i === 1;
      if (!s.done) s.feedback = id === GAME_IDS[2] ? "판갑옷은 여러 철판을 이어 만들었어요. 다시 골라 보세요." : "출토 장소가 황남대총 북분인 금관을 찾아보세요. 이름과 특징을 함께 살펴보세요.";
    }
  } else if (id === GAME_IDS[4]) {
    if (s.stage === 0 && action.kind === "pick" && valid(6)) {
      if (s.order.length !== 6) s.order = [3, 0, 5, 1, 2, 4];
      toggleSwap(s, i!);
    }
    if (s.stage === 0 && action.kind === "submit") {
      if (s.order.length === 6 && s.order.every((value, index) => value === index)) { s.stage = 1; s.selected = -1; s.feedback = "지도를 복원했어요! 비석 5곳을 모두 눌러 설명을 읽어 보세요."; }
      else s.feedback = "지도 조각을 다시 살펴보세요. 참고 그림과 같은 위치로 맞춰 주세요.";
    }
    if (s.stage === 1 && action.kind === "pick" && valid(5)) { if (!s.visited.includes(i!)) s.visited.push(i!); s.selected = i!; s.feedback = PLACES[i!].description; }
    if (s.stage === 1 && action.kind === "submit") { s.done = s.visited.length === 5; if (!s.done) s.feedback = "아직 확인하지 않은 비석이 있어요. 다섯 곳의 설명을 모두 읽어 주세요."; }
  } else if (id === GAME_IDS[5]) {
    if (action.kind === "pick" && valid(7)) {
      if ([1, 3, 5].includes(i!)) { if (!s.removed.includes(i!)) s.removed.push(i!); s.feedback = "음식물은 전시실 밖에 두어요."; }
      else s.feedback = "이 물건은 가져갈 수 있어요. 촬영 가능 구역에서는 플래시를 끄고, 필기구는 정해진 공간에서 조심해서 사용해요.";
      s.done = s.removed.length === 3;
    }
  } else if (id === GAME_IDS[6]) {
    if (action.kind === "pick" && valid(10) && !s.matched.includes(i!)) {
      if (s.face.length === 2) s.face = [];
      if (!s.face.includes(i!)) s.face.push(i!);
      if (s.face.length === 2) {
        s.moves++;
        if (Math.floor(s.deck[s.face[0]] / 2) === Math.floor(s.deck[s.face[1]] / 2)) {
          s.matched.push(...s.face); s.face = []; s.feedback = "짝을 찾았어요! 유물의 빛이 제자리로 돌아갑니다.";
        } else s.feedback = "다른 짝이에요. 위치를 기억하고 다음 카드를 눌러 보세요.";
      }
      s.done = s.matched.length === 10;
    }
  }
  return s;
}
export function gameView(id: string, s: GameState): Record<string, unknown> {
  const n = GAME_IDS.indexOf(id);
  const view: Record<string, unknown> = { title: GAME_TITLES[n], mission: n + 1, stage: s.stage, feedback: s.feedback, selected: s.selected, kind: "choices" };
  if (n === 0) Object.assign(view, s.stage === 0 ? { prompt: "전시 단서 속 廣(광)·開(개)·土(토)를 찾아 누르세요.", items: ["王", "廣", "山", "川", "開", "月", "日", "土", "水"], disabled: s.collected } : { kind: "answer", prompt: "고구려와 신라 사이에 정치적 관계와 [ ㄱ ㄹ ]가 있었음을 보여 준다.", hint: "광개토대왕은 고구려 왕이고 호우총은 신라 무덤이에요. 고구려는 왜의 침략을 받은 신라를 도왔어요." });
  if (n === 1) Object.assign(view, { kind: "order", prompt: "벽돌 그림을 다른 자리로 끌어 놓으세요. 두 번 눌러 교환해도 돼요. 8개를 맞춘 뒤 복원 확인!", reference: BRICKS.join(" → "), hint: "모바일: 벽돌 그림을 끌어 이동하고, 이름·빈 여백에서 위아래로 스크롤하세요.", note: "학습용 복원 배열입니다. 실제 출토 배열을 재현한 것은 아닙니다.", items: s.order.map(i => BRICKS[i]), submit: "복원 확인" });
  if (n === 2) Object.assign(view, { prompt: "고령 지산동 고분군에서 출토된 가야 판갑옷은 무엇을 이어 만들었을까요?", items: ["나무판", "철판", "돌판"] });
  if (n === 3) Object.assign(view, { prompt: "회의에 참석할 황남대총의 금관을 찾아 주세요.", hint: "나무 모양 세움 장식·사슴뿔 모양 장식·굽은옥. 출토 장소도 확인하세요.", note: "MVP는 실물 사진 대신 이름·특징 카드로 식별합니다.", items: CROWNS });
  if (n === 4) Object.assign(view, s.stage === 0 ? { kind: "mapPuzzle", prompt: "지도 조각 두 개를 눌러 교환하세요. 참고 지도처럼 복원해 주세요.", items: s.order.length === 6 ? s.order : [3, 0, 5, 1, 2, 4], submit: "지도 복원 확인" } : { kind: "locations", prompt: `비석 설명 확인 ${s.visited.length}/5 — 다섯 곳을 모두 확인하세요.`, places: PLACES, visited: s.visited, submit: "위치 확인 완료" });
  if (n === 5) Object.assign(view, { kind: "conveyor", prompt: `반입 금지 음식물만 눌러 수거하세요. ${s.removed.length}/3 수거`, items: ["수첩", "음료수", "펜", "빵", "휴대폰", "과자", "카메라"], disabled: s.removed, note: "MVP: 시간 제한 없이 지나가는 물품을 선택합니다." });
  if (n === 6) Object.assign(view, { kind: "memory", prompt: `유물과 키워드의 짝을 찾아주세요. ${s.matched.length / 2}/5쌍 · ${s.moves}회 시도`, items: s.deck.map((value, index) => s.face.includes(index) || s.matched.includes(index) ? PAIRS[Math.floor(value / 2)][value % 2] : "?"), disabled: s.matched, note: "앞면을 본 뒤 다른 카드를 선택하세요. 틀린 두 장은 다음 선택 때 뒤집힙니다." });
  return view;
}

import type {
  MuseumNpcDefinition as MissionNpcDefinition,
  MuseumNpcScene as MissionNpcScene,
} from "./types";
import { CROWNS } from "./games";

// Source: user-provided museum synopsis, storyboard pp. 3-8.
// These are dialogue scenes, not puzzle-completion or reward triggers.
const PORTRAIT_BASE = "../images/npc/national-museum/night-guard";
const MUSEUM_MAP_NAMES = ["국립중앙박물관", "National Museum of Korea"];

export const MUSEUM_CAST = {
  "pensive-1": "반가사유상 ①",
  "pensive-2": "반가사유상 ②",
  "guide-robot": "안내 로봇",
  "hou-bronze-bowl": "호우총 청동 그릇",
  "baekje-landscape-brick": "산수무늬 벽돌",
  "gaya-armor-helmet": "판갑옷과 투구",
  "hwangnam-gold-crown": "황남대총 금관",
  "jinheung-stele": "진흥왕 순수비",
};

type MuseumCharacterId = keyof typeof MUSEUM_CAST;

function spoken(id: MuseumCharacterId, text: string): {
  speakerName: string;
  profileImageUrl: string;
  text: string;
} {
  return {
    speakerName: MUSEUM_CAST[id],
    profileImageUrl: `${PORTRAIT_BASE}/${id}-portrait-v1.png`,
    text,
  };
}

function narrator(text: string): { text: string; speakerless: boolean } {
  return { text, speakerless: true };
}

function npc(
  id: MuseumCharacterId,
  room: string,
  role: string,
  scenes: MissionNpcScene[]
): MissionNpcDefinition {
  return {
    id: `museum-${id}`,
    name: MUSEUM_CAST[id],
    kind: "main",
    mapNames: [
      ...MUSEUM_MAP_NAMES,
      room,
      ...(id === "guide-robot" ? ["로비(1)", "로비(2)", "로비(3)", "로비(4)", "로비(5)", "외부맵(낮)"] : []),
      ...(id === "pensive-1" ? ["외부맵(밤)"] : []),
    ],
    profileImageUrl: `${PORTRAIT_BASE}/${id}-portrait-v1.png`,
    role,
    scenes: scenes.map(function (scene) {
      return { playerRole: "예비 박물관 지키미", ...scene };
    }),
  };
}

const MEETING_LINES = {
  "hou-bronze-bowl": "전시실을 뛰어다니는 관람객이 있으면 깜짝 놀라곤 합니다. 오늘도 몇몇 친구들이 내 앞을 뛰어다녀서 얼마나 놀랐는지 몰라요.",
  "baekje-landscape-brick": "휴, 정말 놀랐겠어요. 오늘 백제실에서는 천천히 내 문양을 감상해 주는 관람객을 만나서 기뻤어요.",
  "jinheung-stele": "저도 오늘은 인기 좀 있었습니다. 특히 설명문을 읽으며 궁금한 점을 찾아보는 외국인 관람객들도 있었어요.",
  "hwangnam-gold-crown": "저는 오늘 조금 힘들었네요. 어떤 관람객이 유리관에 손을 대더라고요. 아무리 유리관이 저를 보호하고 있다고 해도 그렇게 가까이 다가와 유리관을 건드리면 두렵더라고요.",
  "gaya-armor-helmet": "저는 오늘 진지하게 관람하는 어린이들이 많아서 즐거웠어요. 어린이들이 유독 저를 좋아하더라고요. 가야 사람들이 입은 멋있는 갑옷이 눈앞에 펼쳐져 있으니 그럴 만도 하겠죠?",
};

function meetingScene(id: keyof typeof MEETING_LINES): MissionNpcScene {
  return { id: "meeting", title: "밤의 유물 회의", lines: [MEETING_LINES[id]] };
}

const GWANGGAETO_LINES = [
  "각 전시실을 방문해 유물들을 만나고 회의장으로 모셔 와야 하는데요. 먼저 제 옆에 있는 디지털로 구현된 광개토대왕릉비부터 보실까요?",
  "광개토대왕릉비는 중국 지린성 집안시에 있는 비석입니다.",
  "광개토대왕은 영토를 크게 넓힌 고구려의 정복 군주로, 그의 업적을 기리기 위해 아들 장수왕이 이 비석을 세웠다고 해요.",
  "광개토대왕릉비는 당시 고구려의 모습과 한반도와 만주 지역 여러 나라들의 관계를 알려 주는 매우 중요한 사료입니다.",
  "그런데 광개토대왕릉비만큼이나 광개토왕과 관련된 중요한 유물이 또 하나 있습니다. 바로 당신이 첫 번째로 만나러 갈 호우총 청동 그릇입니다. 그러면 고구려실로 이동하시죠.",
];

export const NATIONAL_MUSEUM_NPCS: MissionNpcDefinition[] = [
  npc("pensive-1", "사유의 방", "지키미 후보 선정과 밤의 회의 안내", [
    {
      id: "prologue",
      museumTransitionId: "prologue",
      title: "국립중앙박물관: 밤의 지키미",
      lines: [],
      speakerLines: [
        narrator("역사를 좋아하는 나는 오늘도 국립중앙박물관을 찾았다. 내가 가장 좋아하는 공간은 2층 사유의 방."),
        narrator("오늘은 반가사유상과 함께 있는 공간을 온전히 즐기며 조금 더 오래 생각에 잠겨 있다."),
      ],
    },
    {
      id: "intro",
      title: "반가사유상과의 첫 만남",
      museumTransitionId: "introduction",
      lines: [],
      // Existing speakerLines support switches name and portrait per line.
      speakerLines: [
        narrator("관람객 여러분, 오늘의 관람이 종료되었습니다."),
        spoken("pensive-1", "안녕하십니까. 놀라셨나요?"),
        spoken("pensive-2", "걱정하지 마세요. 모든 사람이 우리가 움직이는 모습을 볼 수 있는 것은 아닙니다."),
        spoken("pensive-1", "당신은 새로운 박물관 지키미 후보로 선택받았습니다."),
        spoken("pensive-2", "지키미는 밤마다 깨어나는 유물들의 이야기를 듣고, 관람객들이 더 즐겁고 안전하게 박물관을 이용할 수 있도록 돕는 존재입니다."),
        spoken("pensive-1", "오늘 밤 회의에 참석할 유물들의 빛을 모아 로비로 데려와 주세요."),
        spoken("pensive-2", "전시실마다 우리 친구들이 기다리고 있을 것입니다."),
      ],
      nextAction: "상설전시관 로비에서 안내 로봇을 만나세요.",
    },
  ]),
  npc("pensive-2", "사유의 방", "지키미 역할과 전시실 친구들 안내", [
    {
      id: "intro",
      title: "박물관 지키미의 역할",
      lines: [
        "걱정하지 마세요. 모든 사람이 우리가 움직이는 모습을 볼 수 있는 것은 아닙니다.",
        "지키미는 밤마다 깨어나는 유물들의 이야기를 듣고, 관람객들이 더 즐겁고 안전하게 박물관을 이용할 수 있도록 돕는 존재입니다.",
        "전시실마다 우리 친구들이 기다리고 있을 것입니다.",
      ],
      nextAction: "상설전시관 로비에서 안내 로봇을 만나세요.",
    },
  ]),
  npc("guide-robot", "상설전시관 로비", "전시실 안내, 관람 예절, 회의와 긴급 상황", [
    {
      id: "intro",
      title: "오늘의 회의 참석 명단",
      museumTransitionId: "goguryeo",
      lines: [
        "안녕하세요! 예비 박물관 지키미님. 오늘 회의에 참석할 유물 명단입니다.",
        "호우총 청동 그릇, 산수무늬 벽돌, 판갑옷과 투구, 황남대총 금관, 진흥왕 순수비",
        ...GWANGGAETO_LINES,
      ],
      nextAction: "고구려실에서 호우총 청동 그릇을 만나세요.",
    },
    { id: "gwanggaeto", title: "디지털 광개토대왕릉비", lines: GWANGGAETO_LINES, museumTransitionId: "goguryeo" },
    {
      id: "baekje-guide",
      title: "백제실 안내",
      lines: ["다음은 백제실입니다. 백제실은 1층에 위치해 있습니다. 화살표를 따라가세요."],
    },
    {
      id: "gaya-guide",
      title: "가야실 안내",
      lines: ["다음은 가야실입니다. 가야실은 1층에 위치해 있습니다. 화살표를 따라가세요."],
    },
    {
      id: "etiquette-intro",
      title: "관람 예절 미션 안내",
      lines: ["회의를 시작하기 전에 예비 지키미님은 관람객 기초 상식 미션을 통과해야 회의에 참석하실 수 있습니다."],
    },
    {
      id: "etiquette-success",
      museumTransitionId: "museum-etiquette",
      title: "관람 예절 미션 후 안내",
      lines: [
        "특히 음식물은 유물 보존을 위해 전시실에 반입할 수 없다는 것, 기본 중의 기본이죠.",
        "휴대폰과 카메라는 전시실 내부로 가져올 수는 있지만 사진 촬영이 가능한 곳에 한해서 플래시를 끄고 촬영해야 합니다.",
        "또한, 필기구를 비롯해 전시실에 가져와도 되는 물건들도 정해진 공간에서 아주 조심해서 사용해야 한다는 점 명심해 주세요.",
      ],
    },
    {
      id: "meeting",
      title: "밤의 유물 회의",
      lines: [],
      speakerLines: [
        spoken("guide-robot", "그러면 본격적으로 회의를 시작해볼까요? 오늘 회의 안건은 ‘관람객과 더욱 즐겁게 만나는 방법’입니다."),
        spoken("hou-bronze-bowl", MEETING_LINES["hou-bronze-bowl"]),
        spoken("baekje-landscape-brick", MEETING_LINES["baekje-landscape-brick"]),
        spoken("jinheung-stele", MEETING_LINES["jinheung-stele"]),
        spoken("hwangnam-gold-crown", MEETING_LINES["hwangnam-gold-crown"]),
        spoken("gaya-armor-helmet", MEETING_LINES["gaya-armor-helmet"]),
      ],
      afterNpcTrigger: "npc:museum-guide-robot:emergency",
    },
    {
      id: "emergency",
      title: "긴급 상황 발생",
      lines: [
        "긴급 상황 발생! 박물관 반경 100m 이내에 외부인이 접근 중입니다.",
        "곧 마법이 해제됩니다. 모든 유물의 빛을 원래 자리로 돌려보내야 합니다.",
      ],
    },
    {
      id: "ending",
      title: "정식 박물관 지키미",
      lines: [],
      speakerLines: [
        narrator("축하합니다. 당신은 오늘 밤 모든 임무를 완수했습니다. 이제 정식 박물관 지키미입니다."),
        narrator("앞으로도 많은 사람들이 우리 문화유산을 사랑하도록 도와주세요."),
        narrator("평범한 관람객으로 시작한 하루. 하지만 오늘 나는 박물관 지키미가 되었다. 다음 밤에도 유물들의 이야기는 계속될 것이다."),
      ],
    },
  ]),
  npc("hou-bronze-bowl", "고구려실", "광개토 글자와 고구려·신라 관계 안내", [
    {
      id: "intro",
      title: "호우총 청동 그릇의 비밀",
      lines: [
        "반갑구나. 나는 경주에서 발견된 고구려 청동 그릇 ‘호우’라고 해.",
        "내가 발견된 무덤은 호우라는 그릇이 발견되었기 때문에 ‘호우총’이라 불리게 되었지. 여기서 ‘총’은 무덤을 뜻한단다.",
        "왜 고구려 그릇이 신라 무덤에서 나왔을까? 내 바닥에는 ‘을묘년국강상광개토지호태왕호우십’이라는 글자가 새겨져 있지.",
        "‘광’, ‘개’, ‘토’ 글자를 찾으면 내가 가진 숨은 비밀을 알려줄게.",
      ],
    },
    {
      id: "quiz",
      title: "고구려와 신라의 관계 추론",
      lines: [
        "내가 왜 신라의 무덤에서 발견되었는지 사람들은 오랫동안 궁금해했단다.",
        "내 몸에 새겨진 글자와 단서를 보고 고구려와 신라의 관계를 추론해 줄 수 있겠니?",
        "고구려와 신라 사이에 정치적 관계와 [ ㄱ ㄹ ]가 있었음을 보여준다.",
      ],
    },
    {
      id: "hint",
      title: "관계 추론 힌트",
      lines: [],
      speakerLines: [
        narrator("광개토대왕은 고구려왕이다."),
        narrator("호우총은 ‘호우’라 불리는 그릇이 발견된 신라 무덤이다."),
        narrator("고구려 광개토대왕은 왜의 침략을 받던 신라를 도와주었다."),
      ],
    },
    {
      id: "success",
      title: "호우총 청동 그릇 미션 후 대화",
      museumTransitionId: "museum-hou-relations",
      lines: [
        "고구려의 그릇이 신라의 무덤에서 발견되었다는 점에서 고구려와 신라 사이의 정치적 관계와 교류가 있었음을 알 수 있어.",
        "이제 내 소개를 했으니 나는 회의장으로 가볼게.",
      ],
    },
    meetingScene("hou-bronze-bowl"),
  ]),
  npc("baekje-landscape-brick", "백제실", "백제 문양전 배열과 미술 안내", [
    {
      id: "intro",
      title: "산수무늬 벽돌의 부탁",
      lines: [
        "나는 백제 사비시대를 대표하는 산수무늬 벽돌이야. 산과 나무, 물과 바위, 그리고 구름이 표현되어 있지.",
        "하지만 지금은 전시된 벽돌의 배열이 흐트러져 있어. 밤이 되면서 마법에 오류가 생긴 것 같아.",
        "원래 위치로 맞춰주면 8개 벽돌을 대표해서 내가 오늘 회의에 참석할 수 있을 것 같아.",
      ],
    },
    {
      id: "success",
      title: "산수무늬 벽돌 미션 후 대화",
      museumTransitionId: "museum-baekje-bricks",
      lines: ["잘했어! 벽돌에 담긴 산과 물, 구름과 봉황 무늬는 백제인의 자연관과 세련된 미술 감각을 보여준다고!"],
    },
    meetingScene("baekje-landscape-brick"),
  ]),
  npc("gaya-armor-helmet", "가야실", "판갑옷과 가야 철기 제작 기술 안내", [
    {
      id: "intro",
      title: "판갑옷과 투구의 이야기",
      lines: [
        "나는 고령 지산동 고분군에서 출토된 판갑옷과 투구다.",
        "가야 사람들은 뛰어난 철기 제작 기술을 가지고 있었어. 여러 철판을 이어 만든 판갑옷은 가야 기술의 정수를 보여준단다.",
        "내가 준비한 문제를 맞혀 보겠니?",
      ],
    },
    {
      id: "quiz",
      title: "가야 철 문화 퀴즈 안내",
      museumQuizId: "museum-gaya-iron",
      museumTransitionId: "quiz-complete:museum-gaya-iron",
      lines: [
        "고령 지산동 고분군에서 출토된 가야 판갑옷은 무엇을 이어 만들어졌을까요?",
      ],
      choices: ["나무판", "철판", "돌판"].map((label, index) => ({
        id: `answer-${index}`, label, museumQuizIndex: index,
        repeatOnComplete: index !== 1,
        lines: [index === 1 ? "맞았어! 여러 철판을 이어 만든 판갑옷은 가야의 뛰어난 철기 제작 기술을 보여준단다." : "다시 생각해 보렴. 가야는 뛰어난 철기 제작 기술을 가지고 있었어. 무엇을 이어 만들었을까?"],
      })),
    },
    { id: "success", title: "판갑옷과 투구 미션 후 대화", lines: ["훌륭해! 이제 회의에 참석할 준비가 되었어."], museumTransitionId: "museum-gaya-iron" },
    meetingScene("gaya-armor-helmet"),
  ]),
  npc("hwangnam-gold-crown", "신라실(1)", "황남대총 금관의 특징과 식별 안내", [
    {
      id: "quiz", title: "황남대총 금관 찾기",
      museumQuizId: "museum-hwangnam-crown",
      museumTransitionId: "quiz-complete:museum-hwangnam-crown",
      lines: ["나무 모양 세움 장식, 사슴뿔 모양 장식, 굽은옥을 떠올려 보렴. 회의에 참석할 황남대총의 금관은 어느 것일까? 출토 장소도 확인해 봐."],
      choices: CROWNS.map((label, index) => ({
        id: `answer-${index}`, label, museumQuizIndex: index,
        repeatOnComplete: index !== 1,
        lines: [index === 1 ? "정답이야! 황남대총 북분에서 출토된 금관을 정확히 찾았구나." : "출토 장소가 황남대총 북분인 금관을 찾아보렴. 이름을 다시 살펴보고 골라 봐."],
      })),
    },
    {
      id: "intro",
      title: "황남대총 금관 찾기",
      lines: [
        "나는 황남대총에서 발견된 신라 금관이다.",
        "머리띠 위에는 나무를 닮은 장식과 사슴뿔 모양 장식이 세워져 있어. 푸른빛 굽은옥이 수십 개 달려 있어 매우 화려하지.",
        "신라 금관의 전형적인 모습을 잘 보여주는 유물로 알려져 있단다. 나뿐만 아니라 유명한 신라 금관들이 정말 많거든.",
        "회의에 참석하려면 나를 정확히 찾아낼 수 있어야 해.",
      ],
    },
    {
      id: "hint",
      title: "금관 찾기 힌트",
      lines: [],
      speakerLines: [narrator("나무 모양 세움 장식, 사슴뿔 모양 장식, 굽은옥")],
    },
    { id: "success", title: "황남대총 금관 미션 후 대화", lines: ["정답! 역시 박물관 예비 지키미답게 나를 세심하게 알아보는구나."], museumTransitionId: "museum-hwangnam-crown" },
    meetingScene("hwangnam-gold-crown"),
  ]),
  npc("jinheung-stele", "신라실(2)", "진흥왕 순수비와 신라 영토 확장 안내", [
    {
      id: "intro",
      title: "진흥왕 순수비의 이야기",
      lines: [
        "나는 북한산에 세워졌던 진흥왕 순수비야. 내가 있던 자리는 비석이 있었다고 해서 ‘비봉’이라 불리지.",
        "진흥왕은 새롭게 확보한 영토를 돌아보며 나를 비롯한 여러 순수비를 세웠어. ‘순수’란 왕이 직접 자신의 영토를 돌아보는 일을 말하지.",
        "나는 진흥왕대 세워지고 나서 천 년도 넘는 시간이 흐른 뒤에 조선 후기 학자 추사 김정희가 발견하고 판독하여 세상에 알려졌어.",
        "나와 함께 진흥왕 시기 세워진 다른 비석들의 위치를 찾아보겠니?",
      ],
    },
    { id: "success", title: "한반도 지도 퍼즐 후 대화", lines: ["진흥왕 때 세워진 여러 비석의 위치를 보며 신라가 어느 방향으로 세력을 넓혔는지 살펴보자."], museumTransitionId: "museum-jinheung-locations" },
    meetingScene("jinheung-stele"),
  ]),
];

// Finishing an introduction starts its playable MVP. Closing never starts it.
const GAME_SCENES: Record<string, Record<string, string>> = {
  "museum-hou-bronze-bowl": { intro: "game:museum-hou-relations", quiz: "game:museum-hou-relations", hint: "game:museum-hou-relations" },
  "museum-baekje-landscape-brick": { intro: "game:museum-baekje-bricks" },
  "museum-gaya-armor-helmet": { intro: "game:museum-gaya-iron" },
  "museum-hwangnam-gold-crown": { intro: "game:museum-hwangnam-crown", hint: "game:museum-hwangnam-crown" },
  "museum-jinheung-stele": { intro: "game:museum-jinheung-locations" },
  "museum-guide-robot": { "etiquette-intro": "game:museum-etiquette", emergency: "emergency", ending: "ending" },
};
NATIONAL_MUSEUM_NPCS.forEach(character => character.scenes.forEach(scene => {
  const action = GAME_SCENES[character.id]?.[scene.id];
  if (action) scene.museumTransitionId = action;
}));

export const NATIONAL_MUSEUM_NPC_ALIASES: Record<string, string> = {};
const KOREAN_ALIASES: Record<MuseumCharacterId, string[]> = {
  "pensive-1": ["반가사유상1", "반가사유상①"],
  "pensive-2": ["반가사유상2", "반가사유상②"],
  "guide-robot": ["안내로봇", "박물관로봇"],
  "hou-bronze-bowl": ["호우총청동그릇", "호우"],
  "baekje-landscape-brick": ["산수무늬벽돌"],
  "gaya-armor-helmet": ["판갑옷과투구"],
  "hwangnam-gold-crown": ["황남대총금관"],
  "jinheung-stele": ["진흥왕순수비"],
};

(Object.keys(MUSEUM_CAST) as MuseumCharacterId[]).forEach(function (id) {
  [id, `museum-${id}`, ...KOREAN_ALIASES[id]].forEach(function (alias) {
    NATIONAL_MUSEUM_NPC_ALIASES[alias] = `museum-${id}`;
  });
});

const SCENE_ALIASES: Record<string, string[]> = {
  intro: ["1", "인사", "소개"],
  prologue: ["프롤로그"],
  gwanggaeto: ["광개토대왕릉비"],
  "etiquette-intro": ["관람예절"],
  "etiquette-success": ["관람예절성공"],
  quiz: ["퀴즈"],
  hint: ["힌트"],
  success: ["성공"],
  meeting: ["회의"],
  emergency: ["긴급상황"],
  ending: ["엔딩"],
};

export const NATIONAL_MUSEUM_SCENE_ALIASES: Record<string, Record<string, string>> = {};
NATIONAL_MUSEUM_NPCS.forEach(function (character) {
  const aliases: Record<string, string> = {};
  character.scenes.forEach(function (scene) {
    (SCENE_ALIASES[scene.id] ?? []).forEach(function (alias) {
      aliases[alias] = scene.id;
    });
  });
  NATIONAL_MUSEUM_SCENE_ALIASES[character.id] = aliases;
});

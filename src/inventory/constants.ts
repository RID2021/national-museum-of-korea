// TODO: 얻을 아이템을 맵이름 / 아이템이름  /주소 를 아래 포맷에 맞춰 넣어주세요
export interface EarnedItemConfig {
  name: string;
  url: string;
  description?: string;
  quantity?: number;
}

export interface EarnedItemEntry {
  earnItemList: EarnedItemConfig[];
  mobileMessage: string;
  pcMessage: string;
  removeItemList?: string[];
}

export const earnItemMap: Record<string, EarnedItemEntry> = {
  광화문1: {
    earnItemList: [
      {
        name: "회고록표지",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/retrospect_0.png",
      },
    ],
    mobileMessage: "회고록 표지를 획득하였습니다.",
    pcMessage: "회고록 표지를 획득하였습니다.",
  },
  흥례문: {
    earnItemList: [
      {
        name: "회고록1",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/retrospect_1.png",
      },
    ],
    mobileMessage: "회고록 1을 획득하였습니다.",
    pcMessage: "회고록 1을 획득하였습니다.",
  },
  근정전내부: {
    earnItemList: [
      {
        name: "회고록2",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/retrospect_2.png",
      },
    ],
    mobileMessage: "회고록 2를 획득하였습니다.",
    pcMessage: "회고록 2를 획득하였습니다.",
  },
  향원지불x: {
    earnItemList: [
      {
        name: "회고록3",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/retrospect_3.png",
      },
    ],
    mobileMessage: "회고록 3을 획득하였습니다.",
    pcMessage: "회고록 3을 획득하였습니다.",
  },
  건청궁외부: {
    earnItemList: [
      {
        name: "회고록4",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/retrospect_4.png",
      },
    ],
    mobileMessage: "회고록 4를 획득하였습니다.",
    pcMessage: "회고록 4를 획득하였습니다.",
  },
  강녕전외부1: {
    earnItemList: [
      {
        name: "회고록5",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/retrospect_5.png",
      },
    ],
    mobileMessage: "회고록 5를 획득하였습니다.",
    pcMessage: "회고록 5를 획득하였습니다.",
  },
  경회루: {
    earnItemList: [
      {
        name: "회고록완성본",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/retrospect.png",
      },
    ],
    mobileMessage: "회고록 완성본을 획득하였습니다.",
    pcMessage: "회고록 완성본을 획득하였습니다.",
  },
};

/*
Example configuration with multiple rewards:
const sample = {
  경공장_작업장: {
    earnItemList: [
      {
        name: "쌀",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/rice.png",
      },
      {
        name: "비단",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/officialseal.png",
      },
    ],
    mobileMessage: "쌀을\n얻었습니다.",
    pcMessage: "쌀을 얻었습니다",
    removeItemList: [],
  },
};
*/

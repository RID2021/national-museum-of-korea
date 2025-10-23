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
  경공장_작업장: {
    earnItemList: [
      {
        name: "쌀",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/rice.png",
      },
    ],
    mobileMessage: "경공장 작업장에서\n쌀을 얻었습니다.",
    pcMessage: "경공장 작업장에서 쌀을 얻었습니다.",
  },
  종이상점: {
    earnItemList: [
      {
        name: "조선통보",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/joseoncurrency.png",
      },
    ],
    mobileMessage: "쌀을 건네고\n조선통보를 받았습니다.",
    pcMessage: "쌀을 건네고 조선통보를 받았습니다.",
    removeItemList: ["쌀"],
  },
  종로시전3: {
    earnItemList: [
      {
        name: "비단",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/silk.png",
      },
    ],
    mobileMessage: "조선통보를 내고\n비단을 받았습니다.",
    pcMessage: "조선통보를 내고 비단을 받았습니다.",
    removeItemList: ["조선통보"],
  },
  경시서: {
    earnItemList: [
      {
        name: "납부확인서",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/payment.png",
      },
      {
        name: "편지",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/letter.png",
      },
    ],
    mobileMessage: "경시서에서\n납부확인서와 편지를 받았습니다.",
    pcMessage: "경시서에서 납부확인서와 편지를 받았습니다.",
  },
  종로시전4: {
    earnItemList: [],
    mobileMessage: "종로시전에\n편지를 전달했습니다.",
    pcMessage: "종로시전에 편지를 전달했습니다.",
    removeItemList: ["편지"],
  },
  비단상점2: {
    earnItemList: [
      {
        name: "나무패",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/woodenboard.png",
      },
    ],
    mobileMessage: "납부확인서를 맡기고\n나무패를 받았습니다.",
    pcMessage: "납부확인서를 맡기고 나무패를 받았습니다.",
    removeItemList: ["납부확인서"],
  },
  경공장2: {
    earnItemList: [
      {
        name: "먹물과 붓",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/brush.png",
      },
    ],
    mobileMessage: "비단을 내고\n먹물과 붓을 받았습니다.",
    pcMessage: "비단을 내고 먹물과 붓을 받았습니다.",
    removeItemList: ["비단"],
  },
  시전귀퉁이: {
    earnItemList: [
      {
        name: "끈",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/string.png",
      },
    ],
    mobileMessage: "시전 귀퉁이에서\n끈을 얻었습니다.",
    pcMessage: "시전 귀퉁이에서 끈을 얻었습니다.",
  },
  제생원: {
    earnItemList: [
      {
        name: "털",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/fur.png",
      },
    ],
    mobileMessage: "제생원에서\n털을 얻었습니다.",
    pcMessage: "제생원에서 털을 얻었습니다.",
  },
  혜정교: {
    earnItemList: [
      {
        name: "관인",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/officialseal.png",
      },
    ],
    mobileMessage: "혜정교에서\n관인을 받았습니다.",
    pcMessage: "혜정교에서 관인을 받았습니다.",
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

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
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/task_allocation.png",
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
  종이상점: {
    earnItemList: [
      {
        name: "조선통보",
        url: "https://igbrtjdwfvvv11213562.cdn.ntruss.com/zep-script/history_josun/task_allocation.png",
      },
    ],
    mobileMessage: "쌀로 조선통보를\n얻었습니다.",
    pcMessage: "쌀로 조선통보를 얻었습니다",
    removeItemList: ["쌀"],
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

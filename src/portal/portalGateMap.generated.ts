// portalX와 Y는 좌상단 기준으로 PortalSize 만큼 확장한다. N x N 크기로₩

export const portalGateMap = {
  "시간 광장": [
    {
      portalX: 87,
      portalY: 54,
      portalSize: 3,
      requiredItems: [
        "사후 세계 가방",
      ],
      missingMessage: "시간 할아버지에게 사후 세계 가방을 받은 뒤 이동하세요.",
    },
  ],
  "가평교육원": [
    {
      portalX: 42,
      portalY: 36,
      portalSize: 2,
      requiredItems: [
        "여권",
      ],
    },
  ],
  "중국": [
    {
      portalX: 84,
      portalY: 26,
      portalSize: 2,
      requiredItems: [
        "용의 머리",
        "용의 몸통",
        "용의 꼬리",
      ],
    },
  ],
  "남아프리카공화국": [
    {
      portalX: 83,
      portalY: 30,
      portalSize: 2,
      requiredItems: [
        "표범조각",
        "사자조각",
        "코끼리조각",
      ],
    },
  ],
} as const;

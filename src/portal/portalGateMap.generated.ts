// portalX와 Y는 좌상단 기준으로 PortalSize 만큼 확장한다. N x N 크기로₩

export const portalGateMap = {
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
  ]
} as const;

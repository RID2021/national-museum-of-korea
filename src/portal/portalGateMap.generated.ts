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
      portalX: 94,
      portalY: 19,
      portalSize: 2,
      requiredItems: [
        "금화1",
        "금화2",
        "금화3",
      ],
    },
  ]
} as const;

export interface MapTileMessageEntry {
  message: string;
  key?: string;
}

export const tileMessageMap: Record<string, MapTileMessageEntry> = {
  광화문1: {
    message: "20XX년, 서울",
  },
  흥례문: {
    message: "1895년, 한양",
  },
  근정전외부1: {
    message: "<Mission : 사절 맞이 의전 절차>",
  },
  근정전내부: {
    message: "<Mission : 전등 점등 체험>",
  },
  근정전외부2: {
    message: "<Mission : 홍범 14조 찾기(근정전 바깥 품계석)>",
  },
  향원지불x: {
    message: "<Mission : 궁녀와 대화히기>",
  },
  영훈당: {
    message: "<Mission : 전선을 고쳐라>",
  },
  향원정불o: {
    message: "<Mission : 사건의 진상 알아보기>",
  },
  향원정: {
    message: "<Mission : 퀴즈 풀기>",
  },
  건청궁외부: {
    message: "<Mission : 모스부호 구조 알아보기>",
  },
  강녕전외부1: {
    message: "<Mission : 강녕전으로 이동하기>",
  },
  강녕전내부: {
    message: "<Mission : 무관과 대화 후 스탬프 획득하기>",
  },
  강녕전외부2: {
    message: "<Mission : 경회루로 이동하기>",
  },
  경회루: {
    message: "<Mission : 완성된 회고록 획득하기>",
  },
  광화문2: {
    message: "<Mission : 회고록 전달하기>",
  },
  광화문포토존: {
    message: "<Mission Complete>",
  },
};

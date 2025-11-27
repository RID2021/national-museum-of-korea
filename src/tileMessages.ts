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
    message: "&lt;Mission : 사절 맞이 의전 절차&gt;",
  },
  근정전내부: {
    message: "&lt;Mission : 전등 점등 체험&gt;",
  },
  근정전외부2: {
    message: "&lt;Mission : 홍범 14조 찾기(근정전 바깥 품계석)&gt;",
  },
  향원지불x: {
    message: "&lt;Mission : 궁녀와 대화히기&gt;",
  },
  영훈당: {
    message: "&lt;Mission : 전선을 고쳐라&gt;",
  },
  향원정불o: {
    message: "&lt;Mission : 사건의 진상 알아보기&gt;",
  },
  향원정: {
    message: "&lt;Mission : 퀴즈 풀기&gt;",
  },
  건청궁외부: {
    message: "&lt;Mission : 모스부호 구조 알아보기&gt;",
  },
  강녕전외부1: {
    message: "&lt;Mission : 강녕전으로 이동하기&gt;",
  },
  강녕전내부: {
    message: "&lt;Mission : 무관과 대화 후 스탬프 획득하기&gt;",
  },
  강녕전외부2: {
    message: "&lt;Mission : 경회루로 이동하기&gt;",
  },
  경회루: {
    message: "&lt;Mission : 완성된 회고록 획득하기&gt;",
  },
  광화문2: {
    message: "&lt;Mission : 회고록 전달하기&gt;",
  },
  광화문포토존: {
    message: "&lt;Mission Complete&gt;",
  },
};

# 국립중앙박물관 NPC 대화 트리거

대본의 NPC 8종, 대화 장면 29개가 박물관 전용 앱의 기존 대화 엔진에 등록되어 있습니다. 원문 대사는 긴 문장의 화면 분할과 인용부호·띄어쓰기 정리만 적용했습니다.

## 연결 대상

- 프로젝트: `/Users/rid/Documents/GitHub/national-museum-of-korea`
- GitHub: `RID2021/national-museum-of-korea`
- 앱: `seoul2_ museum` / `53Xe2L` / https://zep.us/me/apps/53Xe2L
- 스페이스: `nLP9zE`
- 입장 맵: `R57laZ` / https://zep.us/play/R57laZ
- 편집 화면: https://zep.us/edit/nLP9zE/R57laZ

`R57laZ`는 스페이스 ID가 아니라 입장 맵 ID입니다. 위 ID는 사용자 캡처와 실제 앱 관리·맵 편집 화면에서 대조했습니다. 이전 앱 ID `5Jk3dL`은 현재 배포 대상이 아닙니다. 고분 앱 `jkR1DL`도 수정하거나 배포하지 않습니다.

## 현재 구현과 검증 범위

- 완료: 8종·29장면 등록, 한글/영문 별칭, 화자 이름·프로필 전환, 회의 완료 후 긴급 대화 연결, 앱 빌드·게시.
- 검증: 자동 테스트 25개와 TypeScript 검사·배포 빌드 통과. 실제 맵에서 8종·29장면·77페이지와 NPC F/영역 상호작용을 확인했습니다. 시작 오류와 보이지 않는 위젯의 입력 방해는 수정했습니다. [현장 대사 검수](walkthrough-audit-2026-09-14.md) 참고.
- 맵 설정 완료 (2026-09-14): NPC 7개 오브젝트와 로비 안내 로봇 영역을 연결했습니다. 추가로 외부 낮/밤과 로비(2)~(5)까지 연결하여 13개 맵 모두 `seoul2_ museum` 앱을 사용합니다.
- 전체 흐름: 프롤로그부터 7개 미션을 직접 풀고 성공 대화·회의·긴급 상황·외부 낮 맵 엔딩까지 실제 플레이로 통과했습니다. 미션 성공 전에는 성공 대사 미리보기만으로 이동하지 않습니다. [최신 MVP 검수](mvp-audit-2026-09-14.md) 참고. 이전 [이동 검수](navigation-2026-09-14.md)의 미구현 표기는 과거 상태입니다.
- MVP 구현: 글자 수집 및 교류 입력, 8개 문양전 배열, 가야 철판 퀴즈, 6개 금관 이름 카드 식별, 지도 조각 교환 및 비석 5곳 확인, 음식물 3개 수거, 유물·키워드 카드 5쌍 맞추기. 안내/퀴즈 대화가 끝나면 해당 게임이 열립니다.
- 단순화 범위: 맵에 흩어진 글자 대신 위젯 수집판, 실물 사진 대신 텍스트 카드, 문양전 학습용 배열, 개략 지도, 시간 제한 없는 컨베이어 UI입니다. 사진·실물 배치·빛/영토 확장 연출까지 완성한 정식판은 아닙니다.

오른쪽 위 **현재 임무 이어하기**는 닫은 게임을 재개하거나 다음 전시실로 이동합니다. 로비(4)에서도 신라실(1)로 이어집니다. **처음부터 다시 → 초기화하고 시작**은 본인의 박물관 진행만 초기화하고 밤 입장 맵으로 돌아갑니다. 인벤토리와 다른 저장 데이터는 유지합니다.

## 먼저 확인하기

앱이 실행 중인 맵에서 **관리자 계정**으로 다음 채팅 명령을 사용하면, 맵 오브젝트 배치 전에도 대화를 확인할 수 있습니다.

- `#npc 반가사유상1`
- `#npc 안내로봇`
- `#npc 안내로봇 회의`
- `#npc 호우총청동그릇 힌트`

이 명령은 기존 `main.ts`의 관리자 전용 테스트 기능을 사용합니다. 일반 방문자에게 테스트 권한을 추가하지 않았습니다. 오래 열린 탭은 맵 재입장/새로고침 후 확인하세요. 앱 게시와 각 맵에서의 앱 설치·실행은 별도 상태입니다.

## 오브젝트/영역에 넣을 첫 대화 키

| 위치 | NPC | 트리거 키 | 영문 식별자 |
| --- | --- | --- | --- |
| 사유의 방 | 반가사유상 ① | `npc:반가사유상1` | `museum-pensive-1` |
| 사유의 방 | 반가사유상 ② | `npc:반가사유상2` | `museum-pensive-2` |
| 로비(1) | 안내 로봇 | `npc:안내로봇` | `museum-guide-robot` |
| 고구려실 | 호우총 청동 그릇 | `npc:호우총청동그릇` | `museum-hou-bronze-bowl` |
| 백제실 | 산수무늬 벽돌 | `npc:산수무늬벽돌` | `museum-baekje-landscape-brick` |
| 가야실 | 판갑옷과 투구 | `npc:판갑옷과투구` | `museum-gaya-armor-helmet` |
| 신라실(1) | 황남대총 금관 | `npc:황남대총금관` | `museum-hwangnam-gold-crown` |
| 신라실(2) | 진흥왕 순수비 | `npc:진흥왕순수비` | `museum-jinheung-stele` |

영문은 `npc:<영문 식별자>:intro`입니다. 기존 엔진은 오브젝트 F 상호작용(`onTriggerObject`), 오브젝트 접촉(`onObjectTouched`), 같은 이름의 영역 진입/접촉 콜백을 처리합니다. 맵에 어떤 방식을 쓸지 정해서 해당 키를 지정해야 합니다. `intro`나 `회의`만 쓰면 NPC가 모호해지므로 항상 NPC 이름까지 넣으세요.

현재 에디터에서 오브젝트는 **ZEP Script 상호작용 → 값(선택 사항)**에 위 트리거 또는 동일한 영문 별칭을 넣었습니다. **번호** 필드는 트리거 문자열을 넣는 곳이 아닙니다. 로비 안내 로봇은 **지정 영역의 이름**에 `npc:안내로봇`을 사용합니다.

## 추가 장면 목록

`npc:<NPC 한글 이름 또는 영문 식별자>:<장면 ID>` 형식입니다.

| NPC | 장면 ID | 내용 |
| --- | --- | --- |
| 반가사유상 ① | `prologue`, `intro` | 도입 내레이션 / 방송과 두 불상의 대화 전체 |
| 반가사유상 ② | `intro` | 두 번째 불상의 원문 대사 다시 듣기 |
| 안내 로봇 | `intro`, `gwanggaeto` | 명단과 전시실 안내 / 디지털 광개토대왕릉비 설명 다시 듣기 |
| 안내 로봇 | `etiquette-intro`, `etiquette-success` | 관람 예절 미션 전후 안내 |
| 안내 로봇 | `meeting`, `emergency`, `ending` | 유물 회의 전체 / 긴급 상황 / 엔딩 |
| 호우총 청동 그릇 | `intro`, `quiz`, `hint`, `success`, `meeting` | 소개 / 추론 문제 / 힌트 / 성공 대사 / 회의 발언 |
| 산수무늬 벽돌 | `intro`, `success`, `meeting` | 소개 / 성공 대사 / 회의 발언 |
| 판갑옷과 투구 | `intro`, `quiz`, `success`, `meeting` | 소개 / 철 문화 문제 / 성공 대사 / 회의 발언 |
| 황남대총 금관 | `intro`, `hint`, `success`, `meeting` | 소개 / 식별 힌트 / 성공 대사 / 회의 발언 |
| 진흥왕 순수비 | `intro`, `success`, `meeting` | 소개 / 지도 퍼즐 후 대사 / 회의 발언 |

한글 별칭: `인사`, `소개`, `프롤로그`, `광개토대왕릉비`, `관람예절`, `관람예절성공`, `퀴즈`, `힌트`, `성공`, `회의`, `긴급상황`, `엔딩`.

예: `npc:안내로봇:회의`, `npc:판갑옷과투구:성공`, `npc:안내로봇:엔딩`.

반가사유상 ①의 첫 대화는 두 불상의 이름과 프로필이 번갈아 나옵니다. 로봇의 회의 장면은 로봇→청동 그릇→벽돌→순수비→금관→갑옷 순서입니다. 끝까지 읽으면 긴급 대화로 이어지며, 닫기만 누르면 이어지지 않습니다.

`success`와 `ending`은 게임 성공 판정에서 호출할 대본입니다. 관리자 미리보기 자체는 미션을 완료하지 않습니다. 실제 서버 성공 콜백으로 저장한 대기 상태가 있을 때만 성공 대화 완료 후 이동합니다. 공개 맵에 자유 접근 가능한 성공/엔딩 오브젝트를 배치하지 마세요.

## 파일 및 배포

- 대사: `src/nationalMuseum/npcs.ts`
- 조건부 맵 이동: `src/nationalMuseum/navigation.ts`
- 게임 규칙·정답 판정: `src/nationalMuseum/games.ts`
- 게임 세션·저장·재개: `src/nationalMuseum/gameplay.ts`
- 게임/HUD: `res/html/museum-game-v1.html`, `res/html/museum-hud-v1.html`
- 기존 엔진 연결: `src/missionNpc/index.ts`
- 원본 프로필: `res/images/npc/national-museum/night-guard/`
- 위젯 빌더: `scripts/build-museum-widget.cjs`
- 버전 관리되는 위젯 원본: `res/html/museum-npc-widget.template.html`
- 생성 위젯: `res/html/museum-npc-widget-v1.html` (빌드 시 생성)
- 테스트: `src/__tests__/nationalMuseumDialogues.test.cjs`

ZEP 공식 [사이드바 위젯 예제](https://docs.zep.us/zep-script/zep-script-guide/explore-zep-script/zep-script-example-code/sidebar-app)의 내장 이미지 방식을 사용합니다. 원본 PNG를 변경하지 않고 위젯에 base64로 넣으므로 별도 CDN과 상대 이미지 요청이 필요하지 않습니다. 신규 위젯은 기존 대화창을 바탕으로 생성하며, 박물관에서 사용하지 않는 인라인 동영상은 넣지 않습니다. 고분용 원본 위젯은 유지합니다.

`npm run test:npc`, `npm run build`, `npm run archive`로 검증·생성합니다. `npm run deploy`와 `deploy.sh`는 테스트→빌드→패키징→대상 검사→게시 순서입니다. 대상 검사기는 앱·스페이스·입장 맵 ID, 단일 ZIP, 16 MiB 제한을 확인합니다. ZIP은 위젯에 이미 내장된 프로필 원본의 중복 복사만 제외하며, 소스 PNG 파일은 그대로 보존합니다.

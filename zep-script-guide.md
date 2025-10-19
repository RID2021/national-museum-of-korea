ZEP Script API의 공식 문서를 세부 링크까지 모두 크롤링하여, **ScriptApp, ScriptMap, ScriptPlayer, ScriptWidget** 네 가지 주요 클래스의 모든 필드·메서드·이벤트 리스너 등 API 정보를 아래와 같이 마크다운 표로 정리했습니다.

***

# ZEP Script API 정리

## 1. ScriptApp

### Lifecycle

| 함수명           | 설명                                                    |
| --------------- | ------------------------------------------------------- |
| onInit          | App 최초 시작 시 1회 호출                                |
| onJoinPlayer    | onInit 후, 모든 접속 플레이어 입장/새 입장시마다 호출   |
| onStart         | 모든 플레이어 입장 후 1회 호출                           |
| onUpdate        | 약 20ms마다 주기적으로 실행                              |
| onLeavePlayer   | 플레이어 퇴장 시마다 호출, App 종료시 전체 플레이어 호출 |
| onDestroy       | App 종료(게임 블록 파괴/다른 앱 실행) 시 호출           |

***

### Field

| 필드명           | 설명                                                            |
| ---------------- | --------------------------------------------------------------- |
| 🔒 spaceHashID   | App이 설치된 스페이스의 해쉬값                                  |
| 🔒 mapHashID     | App이 설치된 맵의 해쉬값                                        |
| 🔒 creatorID     | App을 실행한 플레이어 ID                                        |
| 🔒 players       | 맵 내 모든 플레이어 배열                                         |
| 🔒 playerCount   | 맵 내 플레이어 수                                               |
| cameraEffect    | 카메라 이펙트 종류                                               |
| cameraEffectParam | 카메라 이펙트 범위                                              |
| displayRatio    | 화면 줌(Zoom)                                                    |
| storage         | App 저장공간(스페이스 한정)                                      |
| followPlayer    | 따라가기 기능 활성화 여부                                        |
| showName        | 닉네임 숨김 여부                                                 |
| 🔒 appHashID     | 앱의 HashID                                                     |
| enableFreeView  | 맵 둘러보기 허용 여부                                            |

***

### Storage

`App.setStorage(string)` 권장,  
`App.getStorage(callback)` 동기화 후 활용

***

### Event Listeners

| 함수명              | 설명                                         |
| ------------------- | -------------------------------------------- |
| onSay               | 채팅 입력 시 동작                            |
| onPlayerTouched     | 캐릭터 간 충돌 시 동작                       |
| onObjectTouched     | 캐릭터-오브젝트 충돌 시 동작                 |
| onAppObjectTouched  | 키가 있는 오브젝트와 충돌 시 동작            |
| onUnitAttacked      | 공격(Z)로 캐릭터 공격 시 동작                |
| onObjectAttacked    | 공격(Z)로 오브젝트 공격 시 동작              |
| onSidebarTouched    | 사이드바 앱 클릭(터치) 시 동작               |
| onTriggerObject     | 오브젝트와 F 상호작용 시 동작                |
| onAppObjectAttacked | 키가 있는 오브젝트를 공격할 때 동작           |

***

### Callbacks

| 함수명                | 설명                                               |
| --------------------- | -------------------------------------------------- |
| runLater              | 지정 시간(초) 후 동작                              |
| addOnTileTouched      | x,y에 플레이어 도착 시                              |
| addOnLocationTouched  | 지정 영역 진입시 동작                              |
| addOnKeyDown          | 키 입력 시 동작                                     |
| setTimeout            | 지정 ms 후 함수 실행                                |
| setInterval           | 지정 ms마다 함수 반복 실행                          |
| addMobileButton       | 모바일 커스텀 버튼 추가                             |
| putMobilePunch        | 모바일 펀치 버튼 추가/제거                          |
| putMobilePunchWithIcon| 이미지로 펀치 버튼 추가                             |

***

### Methods

#### UI

| 메서드명              | 설명                                                         |
| --------------------- | ------------------------------------------------------------ |
| loadSpritesheet       | 스프라이트 이미지 객체화                                     |
| showCenterLabel       | 화면 중간에 라벨 3초간 표시                                 |
| showCustomLabel       | 커스텀 라벨 3초간 표시 (span 사용 가능)                      |
| sayToAll              | 모든 플레이어 채팅창에 메시지                                |
| sayToStaffs           | Staff~만 채팅창 메시지                                       |
| showWidget            | 모든 플레이어에게 위젯 표출                                  |
| showYoutubeWidget     | 모든 플레이어 YouTube 동영상 위젯 표출                       |

#### Control

| 메서드명        | 설명                                                |
| --------------- | --------------------------------------------------- |
| spawnPlayer     | 특정 ID 플레이어 좌표이동                            |
| kickPlayer      | 플레이어 강퇴                                        |
| forceDestroy    | 미니게임 앱 강제 종료                                |
| clearChat       | 전체 채팅 삭제                                       |
| getPlayerByID   | 지정 ID 플레이어 객체 반환                           |

#### Sound

| 메서드명         | 설명                          |
| ---------------- | ----------------------------- |
| playSound        | 사운드 재생                   |
| playSoundLink    | URL 사운드 재생               |
| stopSound        | 모든 사운드 정지              |

#### 통신

| 메서드명         | 설명                                   |
| ---------------- | -------------------------------------- |
| httpGet          | HTTP GET 요청                          |
| httpPost         | Form-Data POST 요청                    |
| httpPostJson     | JSON POST 요청                         |

#### 공통

| 메서드명         | 설명                |
| ---------------- | ------------------- |
| sendUpdated      | 값 변경시 갱신 적용 |

***

## 2. ScriptMap

### Field

| 필드명        | 설명                 |
| ------------- | ---------------------|
| 🔒 name       | 맵 이름               |
| 🔒 width      | 맵 너비               |
| 🔒 height     | 맵 높이               |

***

### Methods

| 메서드명                    | 설명                                                  |
| --------------------------- | ----------------------------------------------------- |
| putTileEffect               | 좌표에 타일 효과 적용                                 |
| putObject                   | 좌표에 오브젝트 설치                                 |
| putObjectMultiple           | 여러 좌표에 오브젝트 일괄 배치                       |
| putObjectWithKey            | 키 값이 있는 오브젝트 설치                            |
| getObjectWithKey            | 키가 있는 오브젝트 정보 조회                          |
| playObjectAnimation         | 좌표 오브젝트 애니메이션 실행                        |
| playObjectAnimationWithKey  | 키값 오브젝트 애니메이션 실행                        |
| moveObject                  | 오브젝트 좌표 이동                                   |
| moveObjectWithKey           | 키 값 오브젝트 이동                                  |
| clearAllObjects             | 스크립트 오브젝트 전체 제거                          |
| getTile                     | 레이어의 x,y 좌표 타일 타입 반환                     |
| hasLocation                 | 로케이션 존재 여부 체크                              |
| getObjectsByType            | Type별 오브젝트 배열 반환                            |
| getTopObjectsByType         | Type별 상단 오브젝트 배열 반환                       |
| sayObjectWithKey            | 오브젝트 위에 말풍선 표시                            |
| getLocation                 | 로케이션 설치 좌표 반환                              |
| getLocationRandom           | 여러 로케이션 중 임의 선택 좌표 반환                 |
| getLocationList             | 로케이션 정보 배열 반환                              |

***

## 3. ScriptPlayer

### Field

| 필드명           | 설명                                           |
| ---------------- | ---------------------------------------------- |
| 🔒 id            | 플레이어 id 값                                 |
| name             | 닉네임                                         |
| title            | 아바타 닉네임 위 노출 텍스트                   |
| 🔒 role          | 권한(숫자값)                                   |
| 🔒 tileX / tileY | 아바타 좌표                                    |
| 🔒 dir           | 아바타 방향                                    |
| moveSpeed        | 이동속도                                       |
| sprite           | 아바타 스프라이트 이미지                       |
| tag              | 커스텀 속성 저장 공간                          |
| hidden           | true면 안보임                                  |
| spotlight        | 스팟라이트 활성화 여부                         |
| attackType       | 공격(Z키) 타입                                 |
| attackSprite     | 공격 이미지                                    |
| attackParam1/2   | 공격 관련 거리/범위(원거리만 attackParam2)     |
| 🔒 walletAddress | 전자지갑 주소                                  |
| storage          | Player 값 저장 공간                            |
| 🔒 isMobile      | 모바일 접속 여부                               |
| displayRatio     | 화면 줌                                        |
| titleColor       | 타이틀 색상                                    |
| ... 기타         | (isMoving, isJumping, customData, isGuest 등)  |

***

### Methods

#### UI

| 메서드명              | 설명                                  |
| --------------------- | ------------------------------------- |
| showCenterLabel       | 3초간 메시지 표시                     |
| showCustomLabel       | 커스텀 라벨 메시지 표시(span 허용)     |
| showWidget            | 위치에 위젯 불러오기                  |
| showBuyAlert/hideBuyAlert | 구매 위젯 표시/숨김               |
| sendMessage           | 개인 채팅 메시지                      |
| showPrompt/showConfirm/showAlert | 입력/확인/경고창 표시    |
| showImageModal/showNoteModal | 이미지/텍스트 창               |
| showWidgetResponsive  | 여백%로 위젯 표시                    |
| openWebLink           | 웹URL 새창/팝업                       |
| showEmbed             | URL 임베드 표시                       |

#### 데이터

| 메서드명        | 설명                                   |
| --------------- | -------------------------------------- |
| isEmail         | 이메일 일치여부(bool)                  |
| getLocationName | 플레이어가 서있는 지정영역 이름        |

#### User Control

| 메서드명        | 설명                                   |
| --------------- | -------------------------------------- |
| spawnAt         | 좌표로 소환                             |
| spawnAtLocation | 구역 이름으로 소환                      |
| spawnAtMap      | 다른 스페이스/맵으로 이동               |
| setCameraTarget | 카메라 시점이동(좌표/오브젝트)          |
| setEffectSprite/playEffectSprite | 이펙트 배경/애니메이션 |
| disappearObject | 해당 키값 오브젝트 제거(개인화면만)     |
| putIndividualObject | 개인 오브젝트 설치                   |

#### Sound

| 메서드명         | 설명                         |
| ---------------- | ----------------------------|
| playSound        | 파일 사운드 재생             |
| playSoundLink    | URL 사운드 재생              |
| stopSound        | 사운드 중지                  |

#### 공통

| 메서드명      | 설명                    |
| ------------- | -----------------------|
| sendUpdated   | 플레이어 필드값 적용    |
| save          | storage값 저장          |

***

## 4. ScriptWidget

### Field

| 필드명     | 설명          |
| ---------- | -------------|
| 🔒 id      | 위젯의 id값   |

***

### Event Listeners

| 함수명     | 설명                                       |
| ---------- | ------------------------------------------ |
| onMessage  | 위젯 → App 메시지 전송시 콜백              |

***

### Methods

| 메서드명      | 설명                                 |
| ------------- | ------------------------------------|
| sendMessage   | App에서 위젯으로 데이터 전송          |
| destroy       | 위젯 제거                            |

***

**이 표는 ZEP Script 공식 가이드 문서의 각 항목(라이프사이클, 필드, 메서드, 콜백 등)을 모두 수집‧구조화한 form입니다.**  
추가 코드 예제나 상세 설명, 파라미터 세부 항목 등 구체적 활용 예가 궁금하면 원하는 영역을 요청하시면 추가로 뽑아드릴 수 있습니다.[1][2][3][4][5][6][7][8][9][10][11]

[1](https://docs-kr.zep.us/zep-script-api/zepscriptapi/scriptapp/lifecycle)
[2](https://docs-kr.zep.us/zep-script-api/zepscriptapi/scriptapp/field)
[3](https://docs-kr.zep.us/zep-script-api/zepscriptapi/scriptapp/callbacks)
[4](https://docs-kr.zep.us/zep-script-api/zepscriptapi/scriptapp/methods)
[5](https://docs-kr.zep.us/zep-script-api/zepscriptapi/scriptmap/field)
[6](https://docs-kr.zep.us/zep-script-api/zepscriptapi/scriptmap/methods)
[7](https://docs-kr.zep.us/zep-script-api/zepscriptapi/scriptplayer/field)
[8](https://docs-kr.zep.us/zep-script-api/zepscriptapi/scriptplayer/methods)
[9](https://docs-kr.zep.us/zep-script-api/zepscriptapi/scriptwidget/field)
[10](https://docs-kr.zep.us/zep-script-api/zepscriptapi/scriptwidget/event-listeners)
[11](https://docs-kr.zep.us/zep-script-api/zepscriptapi/scriptwidget/methods)
[12](https://docs-kr.zep.us/zep-script-api/zepscriptapi)
[13](https://docs-kr.zep.us/zep-script-api/zepscriptapi)
[14](https://docs-kr.zep.us/zep-script-api/zepscriptapi/scriptapp/event-listeners)
[15](https://docs-kr.zep.us/zep-script-api/zepscriptapi/scriptmap)
[16](https://docs-kr.zep.us/zep-script-api/zepscriptapi/scriptplayer)
[17](https://docs-kr.zep.us/zep-script-api/zepscriptapi/scriptwidget)
[18](https://docs-kr.zep.us/zep-script-api/zepscriptapi/scriptapp/storage)
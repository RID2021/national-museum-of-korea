# Mission NPC Trigger Spec

Use these trigger names on ZEP map locations or object keys to open an NPC dialogue widget.

## Trigger Formats

- Default NPC scene: `npc:<npc-id>`
- Explicit NPC scene: `npc:<npc-id>:<scene-id>`
- Alias: `dialog:<npc-id>` or `dialog:<npc-id>:<scene-id>`

When a scene has a linked mission step, opening that NPC scene completes the step automatically.

## NPC Triggers

### 시간 광장

- `npc:time-grandfather`
- `npc:time-grandfather:intro`
- `npc:time-grandfather:afterlife-bag`

Linked progress:

- `intro` -> `time-plaza` / `intro-dialog`
- `afterlife-bag` -> `time-plaza` / `mission-board`

Dialogue flow:

- `npc:time-grandfather` / `npc:time-grandfather:intro` includes the full scene 0-1 flow:
  intro lines -> choice `고분이 뭐예요?` or `바로 출발할게요!` -> selected branch lines -> common closing line.

### 안악 3호분

- `npc:eulssi`
- `npc:eulssi:intro`
- `npc:eulssi:intro-help`
- `npc:eulssi:kitchen`
- `npc:eulssi:meat-storage`
- `npc:eulssi:well`
- `npc:eulssi:inner-room`
- `npc:eulssi:wrong-seat`
- `npc:eulssi:correct-seat`
- `npc:eulssi:final-quiz`
- `npc:eulssi:final-quiz-correct`
- `npc:eulssi:final-quiz-wrong`
- `npc:eulssi:reward`

Linked progress:

- `npc:eulssi:intro` -> `anak-3` / `npc-dialog`
- `npc:eulssi:kitchen` -> `anak-3` / `kitchen-mural`
- `npc:eulssi:meat-storage` -> `anak-3` / `meat-storage-mural`
- `npc:eulssi:well` -> `anak-3` / `well-mural`
- `npc:eulssi:inner-room` -> `anak-3` / `inner-room-unlock`
- `npc:eulssi:correct-seat` -> `anak-3` / `horse-handler-position`
- `npc:eulssi:final-quiz` choice `무덤 주인` -> `anak-3` / `final-quiz`
- `npc:eulssi:final-quiz-correct` -> `anak-3` / `final-quiz` (direct fallback)

Dialogue flow:

- `npc:eulssi` / `npc:eulssi:intro` includes trigger 1:
  Eulssi intro lines -> choice `네, 살펴볼게요!` or `행렬이 뭐예요?` -> speakerless kitchen prompt.
- `npc:eulssi:kitchen` includes trigger 2:
  kitchen mural lines -> meat storage prompt.
- `npc:eulssi:meat-storage` includes trigger 3:
  meat storage lines -> speakerless well prompt.
- `npc:eulssi:well` includes trigger 4:
  well mural lines -> speakerless parade-map prompt.
- `npc:eulssi:inner-room` includes trigger 5:
  parade-map setup lines -> speakerless horse-handler position instruction.
- `npc:eulssi:wrong-seat` and `npc:eulssi:correct-seat` are separate tile triggers.
- `npc:eulssi:final-quiz` includes the final quiz choices:
  `무사`, `무덤 주인`, `노비`; only `무덤 주인` marks the quiz step complete.
- `npc:eulssi:reward` includes trigger 6:
  reward line -> speakerless summary line -> speakerless reflection line -> speakerless return line.

Reward return behavior:

- After the final reward-return line completes, return the player to 시간 광장 with `player.spawnAtMap(ScriptApp.spaceHashID, "7RbjZ7")`.
- Do not use widget `window.location`, `_top`, or `openWebLink` for this flow. Those approaches either get blocked by the widget iframe or open a new browser tab instead of moving the character in ZEP.

### 무용총

- `npc:godu`
- `npc:godu:intro`
- `npc:godu:intro-help`
- `npc:godu:hunting-game`
- `npc:godu:hunting-success`
- `npc:godu:dance-floor`
- `npc:godu:dance-fail`
- `npc:godu:dance-success`
- `npc:godu:reception-hint`
- `npc:godu:final-quiz`
- `npc:godu:final-quiz-correct`
- `npc:godu:final-quiz-wrong`
- `npc:godu:reward`
- `npc:dancer:ambient`
- `game:muyongchong-hunting`
- `game:muyongchong-dance`

Direct game aliases:

- Hunting: `game:muyongchong-hunting`, `game:muyongchong-archery`, `game:muyongchong-archery-game`, `game:godu-hunting`, `game:godu-hunting-game`, `game:hunting-game`, `game:archery-game`
- Dance: `game:muyongchong-dance`, `game:muyongchong-dance-floor`, `game:muyongchong-arrow-order`, `game:muyongchong-arrow-order-game`, `game:godu-dance`, `game:godu-dance-floor`, `game:dance-floor`, `game:arrow-order-game`

The same aliases also work without the `game:` prefix when a ZEP location/object field does not accept colon-form values.

Linked progress:

- `npc:godu:intro` -> `muyongchong` / `npc-dialog`
- `npc:godu:hunting-game` -> `muyongchong` / `hunting-mural`
- `game:muyongchong-hunting` success -> `muyongchong` / `archery-game`
- `npc:godu:hunting-success` -> `muyongchong` / `archery-game` (direct fallback)
- `npc:godu:dance-floor` -> `muyongchong` / `dance-mural`
- `game:muyongchong-dance` success -> `muyongchong` / `arrow-order-game`
- `npc:godu:dance-success` -> `muyongchong` / `arrow-order-game` (direct fallback)
- `npc:godu:reception-hint` -> `muyongchong` / `guest-mural`
- `npc:godu:final-quiz` choice `소수림왕` -> `muyongchong` / `final-quiz`
- `npc:godu:final-quiz-correct` -> `muyongchong` / `final-quiz` (direct fallback)
- `npc:dancer:ambient` has no progress step yet.

Dialogue and game flow:

- `npc:godu` / `npc:godu:intro` includes trigger 1:
  speakerless overview -> Godu intro lines -> choice `해 볼게요!` or `자신 없는데요...`.
- `npc:godu:hunting-game` includes trigger 2 setup:
  Godu hunting line -> speakerless left-trigger timing shot instruction.
- Completing `npc:godu:hunting-game` opens `game:muyongchong-hunting`.
- `game:muyongchong-hunting` opens the first-person archery web game.
  Players watch the left vertical trigger and shoot when the marker enters the dark zone.
- `npc:godu:hunting-success` shows the success line after the test game.
- `npc:godu:dance-floor` includes trigger 3 setup:
  Godu dance line -> speakerless 20-step arrow sequence instruction.
- Completing `npc:godu:dance-floor` opens `game:muyongchong-dance`.
- `game:muyongchong-dance` opens the dance-pad web game with the dancer image animation.
- `npc:godu:reception-hint` includes trigger 4 speakerless Buddhism hint.
- `npc:godu:final-quiz` includes trigger 5:
  monk explanation -> Buddhism question -> choices `광개토대왕`, `소수림왕`, `장수왕`.
- `npc:godu:reward` includes trigger 6:
  speakerless mission summary -> mirror piece and bow reward line.

### 무령왕릉

- `npc:jinmyosu`
- `npc:jinmyosu:intro`
- `npc:jinmyosu:intro-help`
- `npc:jinmyosu:epitaph`
- `npc:jinmyosu:exchange-map`
- `npc:jinmyosu:bronze-mirror`
- `npc:jinmyosu:pine-coffin`
- `npc:jinmyosu:ebony-pillow`
- `npc:jinmyosu:exchange-wrong`
- `npc:jinmyosu:exchange-correct`
- `npc:jinmyosu:final-quiz`
- `npc:jinmyosu:final-quiz-correct`
- `npc:jinmyosu:final-quiz-wrong`
- `npc:jinmyosu:reward`

Linked progress:

- `npc:jinmyosu:intro` -> `muryeong-tomb` / `npc-dialog`
- `npc:jinmyosu:epitaph` -> `muryeong-tomb` / `epitaph`
- `npc:jinmyosu:bronze-mirror` -> `muryeong-tomb` / `bronze-mirror`
- `npc:jinmyosu:pine-coffin` -> `muryeong-tomb` / `pine-coffin`
- `npc:jinmyosu:ebony-pillow` -> `muryeong-tomb` / `ebony-pillow`
- `npc:jinmyosu:exchange-correct` -> `muryeong-tomb` / `exchange-region-game`
- `npc:jinmyosu:final-quiz-correct` -> `muryeong-tomb` / `final-quiz`

### 천마총

- `npc:seoki`
- `npc:seoki:intro`
- `npc:seoki:intro-help`
- `npc:seoki:wooden-chamber`
- `npc:seoki:stone-mound`
- `npc:seoki:burial-mound`
- `npc:seoki:costume`
- `npc:seoki:costume-complete`
- `npc:seoki:glass-cup`
- `npc:seoki:final-quiz`
- `npc:seoki:final-quiz-correct`
- `npc:seoki:final-quiz-wrong`
- `npc:seoki:reward`

Linked progress:

- `npc:seoki:intro` -> `cheonmachong` / `npc-dialog`
- `npc:seoki:wooden-chamber` -> `cheonmachong` / `wooden-chamber`
- `npc:seoki:stone-mound` -> `cheonmachong` / `stone-mound`
- `npc:seoki:burial-mound` -> `cheonmachong` / `burial-mound`
- `npc:seoki:costume-complete` -> `cheonmachong` / `gold-accessory-game`
- `npc:seoki:glass-cup` -> `cheonmachong` / `glass-cup`
- `npc:seoki:final-quiz-correct` -> `cheonmachong` / `final-quiz`

### 대성동 고분군

- `npc:gwanghoek`
- `npc:gwanghoek:intro`
- `npc:gwanghoek:intro-help`
- `npc:gwanghoek:iron-production`
- `npc:gwanghoek:iron-processing`
- `npc:gwanghoek:iron-success`
- `npc:gwanghoek:artifact-match`
- `npc:gwanghoek:artifact-wrong`
- `npc:gwanghoek:artifact-correct`
- `npc:gwanghoek:trade-map`
- `npc:gwanghoek:final-quiz`
- `npc:gwanghoek:final-quiz-correct`
- `npc:gwanghoek:final-quiz-wrong`
- `npc:gwanghoek:reward`

Linked progress:

- `npc:gwanghoek:intro` -> `daeseongdong` / `npc-dialog`
- `npc:gwanghoek:iron-production` -> `daeseongdong` / `iron-process-game`
- `npc:gwanghoek:iron-success` -> `daeseongdong` / `iron-process-game`
- `npc:gwanghoek:artifact-correct` -> `daeseongdong` / `artifact-use-quiz`
- `npc:gwanghoek:trade-map` -> `daeseongdong` / `trade-map`
- `npc:gwanghoek:final-quiz-correct` -> `daeseongdong` / `final-quiz`

### 거울의 방

- `npc:time-grandfather:ending`
- `npc:time-grandfather:ending-summary`
- `npc:time-grandfather:ending-complete`
- `npc:eulssi:ending-review`
- `npc:godu:ending-review`
- `npc:jinmyosu:ending-review`
- `npc:seoki:ending-review`
- `npc:gwanghoek:ending-review`

Linked progress:

- `npc:time-grandfather:ending` -> `mirror-room` / `grandfather-dialog`
- `npc:time-grandfather:ending-summary` -> `mirror-room` / `exchange-map`
- `npc:time-grandfather:ending-complete` -> `mirror-room` / `completion-screen`
- guide `ending-review` scenes -> `mirror-room` / `mirror-pieces`

## Profile Images

NPC profile images use CDN assets under:

`https://rid.gcdn.ntruss.com/zep-script/seoul_2/npc/`

## NPC ID Reference

- `time-grandfather`: 시간 할아버지
- `eulssi`: 을씨
- `godu`: 고두
- `dancer`: 무희 NPC
- `jinmyosu`: 석수 진묘수
- `seoki`: 석이
- `gwanghoek`: 광획

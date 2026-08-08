# Mission Progress Trigger Spec

Use these trigger names on ZEP map locations or object keys to update the player's mission percent.

## Trigger Formats

- Current map mission step: `mission:<step-id>`
- Explicit mission step: `mission:<mission-id>:<step-id>`
- Complete current map mission: `mission:complete`
- Complete explicit mission: `mission:<mission-id>:complete`

The short alias `mp:` also works in place of `mission:`.

## Quiz Trigger Formats

Use these trigger names on ZEP map locations or object keys to open a multiple-choice quiz.

- `quiz:<quiz-id>`
- `qz:<quiz-id>`

When the player chooses the correct answer, the linked mission step is completed automatically.

## Admin Commands

- `!진행률`: show current mission progress.
- `!미션리셋`: reset all mission progress for the current player.

## Mission IDs And Step IDs

### 시간 광장 (`time-plaza`)

- `intro-dialog`
- `mission-board`
- `mirror-board`
- `tomb-portal`
- `mirror-room-unlock`

Final mirror-room portal:

- Use one of these location/object keys on the final gate trigger tile: `portal:mirror-room:gate`, `portal:mirror-room`, `portal:qnYlZ3`, `mirror-room-portal`, `final-portal`, `거울의방입장`.
- The player can move to `qnYlZ3` only after collecting all five bronze mirror fragments and all five afterlife items.
- If the final portal cannot share a trigger, place the gate trigger tile just before the portal. Players without every required item are bounced one tile below the trigger.

### 안악 3호분 (`anak-3`)

- `npc-dialog`
- `kitchen-mural`
- `meat-storage-mural`
- `well-mural`
- `inner-room-unlock`
- `horse-handler-position`
- `final-quiz`

Final quiz trigger: `quiz:anak-final`

### 무용총 (`muyongchong`)

- `npc-dialog`
- `hunting-mural`
- `archery-game`
- `dance-mural`
- `arrow-order-game`
- `guest-mural`
- `final-quiz`

Final quiz trigger: `quiz:muyongchong-final`

### 무령왕릉 (`muryeong-tomb`)

- `npc-dialog`
- `epitaph`
- `bronze-mirror`
- `pine-coffin`
- `ebony-pillow`
- `exchange-region-game`
- `final-quiz`

Final quiz trigger: `quiz:muryeong-tomb-final`

### 천마총 (`cheonmachong`)

- `npc-dialog`
- `wooden-chamber`
- `stone-mound`
- `burial-mound`
- `build-order-quiz`
- `gold-accessory-game`
- `glass-cup`
- `final-quiz`

Final quiz trigger: `quiz:cheonmachong-final`

### 대성동 고분군 (`daeseongdong`)

- `npc-dialog`
- `iron-ore`
- `charcoal`
- `bellows`
- `furnace`
- `iron-process-game`
- `artifact-use-quiz`
- `trade-map`
- `final-quiz`

Final quiz trigger: `quiz:daeseongdong-final`

### 거울의 방 (`mirror-room`)

- `entry-check`
- `grandfather-dialog`
- `mirror-pieces`
- `review-popup`
- `exchange-map`
- `completion-screen`

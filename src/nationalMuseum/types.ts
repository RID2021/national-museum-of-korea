// Structural subset of the existing missionNpc dialogue payload.
// Kept independent so this module can move to the separate museum app.
export interface MuseumSpeakerLine {
  text: string;
  speakerName?: string;
  profileImageUrl?: string;
  speakerless?: boolean;
}

export interface MuseumNpcScene {
  id: string;
  title: string;
  lines: string[];
  speakerLines?: MuseumSpeakerLine[];
  playerRole?: string;
  nextAction?: string;
  afterNpcTrigger?: string;
  museumTransitionId?: string;
}

export interface MuseumNpcDefinition {
  id: string;
  name: string;
  kind: "main";
  mapNames: string[];
  profileImageUrl: string;
  role: string;
  scenes: MuseumNpcScene[];
}

import type { PlayerStorageRecord } from "../utils/player";

export type ScriptPlayer = any;

export interface FixTarget {
  key: string;
  x: number;
  y: number;
}

export interface FixGameStorage {
  fixedKeys: string[];
}

export type FixGamePlayerStorage = PlayerStorageRecord & {
  fixGame?: FixGameStorage;
};

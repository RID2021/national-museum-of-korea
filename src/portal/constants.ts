import { portalGateMap as generatedPortalGateMap } from "./portalGateMap.generated";

export interface PortalGateEntry {
  portalX: number;
  portalY: number;
  /** Portal area size (NxN). 1 = 1x1, 2 = 2x2, etc. Coordinates are top-left corner. */
  portalSize: number;
  requiredItems: string[];
  missingMessage?: string;
}

export const portalGateMap: Record<string, PortalGateEntry[]> =
  generatedPortalGateMap as unknown as Record<string, PortalGateEntry[]>;

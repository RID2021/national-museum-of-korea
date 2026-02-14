// NOTE: 아래 매핑은 TSV 기반으로 자동 생성됩니다.
// - Source: `res/data/inventory_interactions.tsv`
// - Generator: `node scripts/generate-inventory-interactions.js`
// - Output: `src/inventory/inventoryInteractionMap.generated.ts`
import { inventoryInteractionMap as generatedInventoryInteractionMap } from "./inventoryInteractionMap.generated";
import { inventoryRemoveOnEnterMap as generatedInventoryRemoveOnEnterMap } from "./inventoryRemoveOnEnterMap.generated";

export interface EarnedItemConfig {
  name: string;
  url: string;
  description?: string;
  quantity?: number;
}

export interface EarnedItemEntry {
  earnItemList: EarnedItemConfig[];
  mobileMessage: string;
  pcMessage: string;
  missingMessage: string;
  prerequisiteItemList?: string[];
  removeItemList?: string[];
}

export const earnItemMap: Record<string, EarnedItemEntry> = {
  가평교육원: {
    earnItemList: [
      {
        name: "여권",
        url: "https://rid.gcdn.ntruss.com/countries/passport.png",
      },
    ],
    mobileMessage: "여권을 획득하였습니다.",
    pcMessage: "여권을 획득하였습니다.",
    missingMessage: "여권이 없습니다.",
    prerequisiteItemList: [],
    removeItemList: [],
  }
};
/**
 * Inventory interactions are keyed by an interactionId.
 *
 * - Tile/location: name the location `inv:<interactionId>`.
 * - Object (F interaction): set object key to `inv:<interactionId>`.
 */
export const inventoryInteractionMap: Record<string, EarnedItemEntry> =
  generatedInventoryInteractionMap as unknown as Record<string, EarnedItemEntry>;

export const inventoryRemoveOnEnterMap: Record<string, string[]> =
  generatedInventoryRemoveOnEnterMap as unknown as Record<string, string[]>;

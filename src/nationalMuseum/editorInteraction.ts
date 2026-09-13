type EditorObject = { tileX?: number; tileY?: number; param1?: string };

// Editor type-21 objects can emit an empty key. Resolve their value using the
// onTriggerObject layer and tile coordinates (3: object, 5: top object).
export function getEditorInteractionValue(layer: number, x: number, y: number): string | null {
  if (layer !== 3 && layer !== 5) return null;
  const objects: EditorObject[] = layer === 3
    ? ScriptMap.getObjectsByType(21)
    : ScriptMap.getTopObjectsByType(21);
  const object = objects.find(function (candidate) {
    return candidate.tileX === x && candidate.tileY === y;
  });
  return typeof object?.param1 === "string" && object.param1.trim()
    ? object.param1.trim()
    : null;
}

import type { Action, RichText, View } from "@fq/protocol";
import type { LayoutMode } from "../util/useLayout.js";

export interface SceneProps {
  view: View;
  layout: LayoutMode;
  /** The player pressed a button (mouse, touch or keys 1 to 5). */
  onPress: (buttonId: string) => void;
  onAction: (action: Action) => void;
  /** Changes with every answer to the player's own actions; restarts the typewriter. */
  revealKey: string;
  /** Earlier screens' text, for the wide layout's side log. */
  log: RichText[];
}

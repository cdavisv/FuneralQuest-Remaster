import type { OfficePanel, UpgradeRow, View } from "@fq/protocol";

/**
 * The parlor office (docs/expanded-rules.md 6, 7, 9.3, 11.5). Every office screen carries
 * `View.office`: the building level and its names, the stock, the markup and rivalry in force, the
 * security level and every upgrade with its state. The client reads nothing from the text and
 * keeps no list of levels or upgrades; a View without `office` (a Classic town, an older server)
 * is simply drawn as a plain screen.
 */
export function officeOf(view: View): OfficePanel | undefined {
  return view.office;
}

/** The contractor's catalogue is open: the buy cards are on screen. */
export function isUpgradeScreen(view: View): boolean {
  return view.office !== undefined && view.buttons.some((b) => b.id.startsWith("parlor:buy:"));
}

/** The office's home: the screen that offers the contractor, the markup and the rivalry. */
export function isOfficeHome(view: View): boolean {
  return view.office !== undefined && view.buttons.some((b) => b.id === "parlor:upgrades");
}

/** The markup or rivalry chooser: the cards are the choices, the current one `selected`. */
export function isChooserScreen(view: View): boolean {
  return (
    view.office !== undefined &&
    view.buttons.some(
      (b) => b.id.startsWith("parlor:markup:") || b.id.startsWith("parlor:rivalry:"),
    )
  );
}

/** Total caskets in the storeroom. */
export function stockTotal(stock: OfficePanel["stock"]): number {
  return stock.wood + stock.silver + stock.gold;
}

export type UpgradeState = UpgradeRow["state"];

/** The rows in one state, in the contractor's order. */
export function upgradesIn(office: OfficePanel, state: UpgradeState): UpgradeRow[] {
  return office.upgrades.filter((u) => u.state === state);
}

/** How many of the building's upgrades (the ones that raise its level) are owned. */
export function buildingUpgradesOwned(office: OfficePanel): number {
  return office.upgrades.filter((u) => u.building && u.state === "owned").length;
}

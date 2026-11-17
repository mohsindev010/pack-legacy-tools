import { createElement, type ComponentType, type ReactNode } from "react";
import { DimensionalWeightWidget } from "./DimensionalWeightWidget";
import { BoxFinderWidget } from "./BoxFinderWidget";
import { PaperWeightWidget } from "./PaperWeightWidget";
import { QrWidget } from "./QrWidget";
import { BarcodeWidget } from "./BarcodeWidget";
import { BoxVolumeWidget } from "./BoxVolumeWidget";
import { PalletWidget } from "./PalletWidget";
import { MylarWidget } from "./MylarWidget";
import { OxygenWidget } from "./OxygenWidget";

/**
 * One client widget per tool (step F). A widget receives the server-computed
 * default result so its first paint matches the prerendered HTML.
 *
 * Register as tools land, e.g.:
 *   import { DimensionalWeightWidget } from "./DimensionalWeightWidget";
 *   "dimensional-weight-calculator": DimensionalWeightWidget,
 */
export type WidgetProps = { slug: string; initialResult: unknown };

const widgets: Partial<Record<string, ComponentType<WidgetProps>>> = {
  "dimensional-weight-calculator": DimensionalWeightWidget,
  "standard-box-sizes": BoxFinderWidget,
  "paper-weight-converter": PaperWeightWidget,
  "qr-code-generator": QrWidget,
  "barcode-generator": BarcodeWidget,
  "box-volume-calculator": BoxVolumeWidget,
  "pallet-calculator": PalletWidget,
  "mylar-bag-size-finder": MylarWidget,
  "oxygen-absorber-calculator": OxygenWidget,
};

export const hasWidget = (slug: string) => slug in widgets;

/** Render the tool's widget, or null if it has none yet. */
export function renderWidget(props: WidgetProps): ReactNode {
  const W = widgets[props.slug];
  return W ? createElement(W, props) : null;
}

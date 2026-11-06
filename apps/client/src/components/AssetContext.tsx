import { createContext, useContext } from "react";
import { DEFAULT_ASSET_BASE } from "../util/assets.js";

export const AssetBaseContext = createContext<string>(DEFAULT_ASSET_BASE);
export const useAssetBase = () => useContext(AssetBaseContext);

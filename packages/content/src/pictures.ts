import { assetId } from "@fq/core";
import { z } from "zod";

/** An asset id in the normal form of the rule in CLAUDE.md (idempotent under `assetId`). */
export const pictureSchema = z.string().refine((v) => v !== "" && assetId(v) === v, {
  error:
    "must be an asset id: lowercase, forward slashes, no leading 'flash/', no '.swf' (for example 'places/bank')",
});

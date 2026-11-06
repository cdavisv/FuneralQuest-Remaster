/**
 * The Web Worker entry for Solo mode. Bundle it as a module worker:
 *
 *   new Worker(new URL("@fq/solo/worker", import.meta.url), { type: "module" })
 *
 * and talk to it with `SoloWorkerClient`. It runs the whole town (the player's actions and every
 * rival's day) off the UI thread, and carries the built-in content packs (`classic`, `vintage`, `expanded`),
 * so a page that only names a pack by id never has to load or send one.
 */
import { classicPack, expandedPack, vintagePack } from "@fq/content";
import { type PortLike, serveSolo } from "./serve.js";

serveSolo(globalThis as unknown as PortLike, [classicPack, vintagePack, expandedPack]);

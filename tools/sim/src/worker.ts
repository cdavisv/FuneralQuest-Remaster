import { parentPort, workerData } from "node:worker_threads";
import { simContent } from "./content.js";
import { type SimOptions, simulateTown } from "./town.js";

/** A simulator worker: plays the towns it is sent, one report per message. */
const port = parentPort;
if (port) {
  const options = (workerData as { options: SimOptions }).options;
  const content = simContent(options.rules);
  port.on("message", (index: number) => {
    port.postMessage(simulateTown(index, options, content));
  });
}

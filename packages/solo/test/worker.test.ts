import { workerDriver } from "./drivers.js";
import { hostSuite } from "./suite.js";

// The same suite as host.test.ts, through SoloWorkerClient and the real worker
// entry (src/worker.ts) running in a Node worker_threads Worker.
hostSuite("the worker proxy (Node worker_threads)", workerDriver);

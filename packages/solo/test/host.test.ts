import { directDriver } from "./drivers.js";
import { hostSuite } from "./suite.js";

hostSuite("the direct host", directDriver);

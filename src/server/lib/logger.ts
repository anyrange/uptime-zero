import { PinoTransport } from "@loglayer/transport-pino";
import { LogLayer } from "loglayer";
import pino from "pino/browser.js";
import { serializeError } from "serialize-error";

// Import pino's browser build explicitly: it writes each entry as an object
// through the matching `console[level]` method, which Workers Logs indexes by
// field and severity. The Node entry would write numeric-level JSON to stdout,
// and bundlers disagree on which entry a Worker gets.
const pinoLogger = pino({
  browser: {
    asObject: true,
    formatters: { level: (label) => ({ level: label }) },
  },
}).child({ service: "uptime-worker" });

export const logger = new LogLayer({
  errorSerializer: serializeError,
  transport: new PinoTransport({ logger: pinoLogger }),
});

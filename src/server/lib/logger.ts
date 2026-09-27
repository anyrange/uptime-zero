import { PinoTransport } from "@loglayer/transport-pino";
import { LogLayer } from "loglayer";
import pino from "pino";
import { serializeError } from "serialize-error";

// Workers bundles resolve pino's browser build, which writes each entry as an
// object through the matching `console[level]` method; Workers Logs indexes
// those fields and severities without a stdout stream.
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

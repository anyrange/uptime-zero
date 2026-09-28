// pino ships its console-based browser build without typings; it exposes the
// same factory and logger API as the Node entry.
declare module "pino/browser.js" {
  import pino from "pino";

  export default pino;
}

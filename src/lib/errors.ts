/**
 * An expected failure whose message is already translated for the user.
 * Server functions pass these through to the client unchanged; any other
 * error is logged and replaced with a generic message (`errorMiddleware`).
 */
export class AppError extends Error {
  override name = "AppError";
}

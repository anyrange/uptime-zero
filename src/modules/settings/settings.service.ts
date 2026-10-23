import "@tanstack/react-start/server-only";
import * as repo from "./settings.repository";

/** Installation-wide settings. */

export const current = repo.get;

export const updateRetention = repo.saveRetention;

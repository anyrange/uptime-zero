export interface BuildInfo {
  branch: string | null;
  sha: string | null;
  version: string;
}

declare const __BUILD_INFO__: BuildInfo;

export const buildInfo = __BUILD_INFO__;
export const appVersion = `v${buildInfo.version}`;

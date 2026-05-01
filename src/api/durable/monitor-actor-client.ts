import type { Bindings } from "@/ctx";

export function getMonitorActorStub(
  env: Pick<Bindings, "MONITOR_ACTOR">,
  monitorId: string,
) {
  const id = env.MONITOR_ACTOR.idFromName(monitorId);
  return env.MONITOR_ACTOR.get(id);
}

export function queueMonitorSync(
  ctx: {
    env: Bindings;
    executionCtx: { waitUntil(promise: Promise<unknown>): void };
  },
  monitorId: string,
  reason: string,
) {
  ctx.executionCtx.waitUntil(
    getMonitorActorStub(ctx.env, monitorId).syncConfig(reason, monitorId),
  );
}

export function runMonitorNow(
  env: Pick<Bindings, "MONITOR_ACTOR">,
  monitorId: string,
  reason: string,
) {
  return getMonitorActorStub(env, monitorId).runNow(reason, monitorId);
}

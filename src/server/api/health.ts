import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "./definition";

export const HealthLive = HttpApiBuilder.group(Api, "health", (handlers) => {
  return handlers.handle("check", () => {
    return Effect.succeed({ status: "ok" });
  });
});

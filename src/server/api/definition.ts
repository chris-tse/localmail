import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

export const Api = HttpApi.make("Localmail").add(
  HttpApiGroup.make("health").add(
    HttpApiEndpoint.get("check", "/health", {
      success: Schema.Struct({ status: Schema.String }),
    }),
  ),
);

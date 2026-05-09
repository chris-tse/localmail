import { Effect, Layer } from "effect";
import { BunHttpServer } from "@effect/platform-bun";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { Api } from "./api/definition";
import { HealthLive } from "./api/health";
import { SqliteLive } from "./db/client";

const ApiLive = HttpApiBuilder.layer(Api).pipe(Layer.provide(HealthLive));

// Compose app layer
const AppLayer = Layer.mergeAll(ApiLive, SqliteLive);

// Serve
const ServerLive = HttpRouter.serve(AppLayer).pipe(
  Layer.provide(BunHttpServer.layer({ hostname: "127.0.0.1", port: 4000 })),
);

const Main = Effect.gen(function* () {
  yield* Effect.logInfo("Localmail server listening on http://127.0.0.1:4000");
  yield* Layer.launch(ServerLive);
});

Effect.runFork(Main);

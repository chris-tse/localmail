import { BunHttpServer } from "@effect/platform-bun";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { Effect, Layer } from "effect";

// Routes
const HealthRoute = HttpRouter.add("GET", "/api/health", HttpServerResponse.json({ status: "ok" }));

// Compose app layer
const AppLayer = Layer.mergeAll(HealthRoute);

// Serve
const ServerLive = HttpRouter.serve(AppLayer).pipe(
  Layer.provide(BunHttpServer.layer({ port: 4000 })),
);

Effect.runFork(Layer.launch(ServerLive));

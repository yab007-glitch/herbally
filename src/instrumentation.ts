import * as Sentry from "@sentry/nextjs";

const HERBALLY_IMAGE_USER_AGENT =
  "HerbAlly/1.0 (https://herbally.app; info@herbally.app)";

type RequestModule = {
  request: typeof import("node:https").request;
};

/**
 * Next.js's built-in image optimizer defaults to `User-Agent: node`, which
 * Wikimedia Commons rejects with HTTP 429. Rewrite default `node` User-Agent
 * headers on outbound Node HTTP/HTTPS requests via the mutable builtin
 * CommonJS module (`process.getBuiltinModule`) so ESM namespace getters never
 * throw during server boot.
 */
function patchNodeUserAgent(mod: RequestModule | undefined) {
  if (!mod) return;
  const desc = Object.getOwnPropertyDescriptor(mod, "request");
  if (!desc || !desc.writable) return;

  const originalRequest = mod.request;
  type RequestArgs = Parameters<typeof originalRequest>;

  mod.request = function wrappedRequest(
    ...args: RequestArgs
  ): ReturnType<typeof originalRequest> {
    const optsIndex =
      args.length >= 2 &&
      typeof args[1] === "object" &&
      args[1] !== null &&
      typeof args[1] !== "function"
        ? 1
        : typeof args[0] === "object" &&
            args[0] !== null &&
            !(args[0] instanceof URL)
          ? 0
          : -1;

    if (optsIndex !== -1) {
      const options = args[optsIndex] as {
        headers?: Record<string, string | string[] | number | undefined>;
      };
      if (options.headers) {
        for (const key of Object.keys(options.headers)) {
          if (
            key.toLowerCase() === "user-agent" &&
            options.headers[key] === "node"
          ) {
            options.headers[key] = HERBALLY_IMAGE_USER_AGENT;
          }
        }
      }
    }

    return originalRequest.apply(mod, args);
  } as typeof originalRequest;
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const getBuiltin = (
        process as unknown as {
          getBuiltinModule?: (id: string) => RequestModule | undefined;
        }
      ).getBuiltinModule;
      if (typeof getBuiltin === "function") {
        patchNodeUserAgent(getBuiltin("node:http"));
        patchNodeUserAgent(getBuiltin("node:https"));
      }
    } catch {
      // Never block app startup if builtin request wrapping is unsupported
    }
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;

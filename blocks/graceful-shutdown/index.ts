/**
 * graceful-shutdown — a small, dependency-free utility for coordinated,
 * dependable application shutdown.
 *
 * Usage:
 * ```ts
 * import { GracefulShutdown, createHttpShutdownTask } from 'graceful-shutdown';
 *
 * const shutdown = new GracefulShutdown();
 * shutdown.addTask(createHttpShutdownTask(server)); // REQUIRED — closes the server
 * shutdown.addTask({ name: 'db', priority: 40, handler: () => pool.end() });
 * ```
 *
 * Framework adapters (Express / Fastify / Hono) are deliberately NOT
 * re-exported here so this entry stays framework-agnostic and installs cleanly
 * alongside a single adapter. Import adapters directly from their own module:
 * ```ts
 * import { createShutdownMiddleware } from './adapters/express';
 * ```
 */

// Core
export { GracefulShutdown, gracefulShutdown } from "./core/shutdown";
export { NodeConnectionTracker, isAttachable } from "./core/connection-tracker";

// Types
export type {
  AttachableConnectionTracker,
  ConnectionTracker,
  GracefulShutdownOptions,
  Node503Options,
  ShutdownHandler,
  ShutdownReason,
  ShutdownResult,
  ShutdownStateProvider,
  ShutdownTask,
  TaskFailure
} from "./types";

// Constants
export * from "./constants";

// Utils
export {
  createHttpShutdownTask,
  handleNode503,
  shouldRejectRequest,
  withTimeout
} from "./utils/index";

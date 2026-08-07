import type { Server } from "node:http";

import { DRAIN_POLL_INTERVAL_MS } from "../constants";
import type { AttachableConnectionTracker, ConnectionTracker } from "../types";

/**
 * A Node.js HTTP connection tracker that attaches to a `Server` and counts
 * in-flight requests.
 *
 * `waitForDrain` resolves as soon as `activeCount` reaches zero, or rejects
 * once `timeoutMs` elapses.
 */
export class NodeConnectionTracker implements AttachableConnectionTracker {
  private _activeCount = 0;

  get activeCount(): number {
    return this._activeCount;
  }

  /**
   * Attach the tracker to a Node `http.Server`. Must be called before the
   * server starts accepting requests so no request is missed.
   */
  attach(server: Server): this {
    server.on("request", (_req, res) => {
      this._activeCount++;

      // Both 'finish' and 'close' fire on a completed request, and 'close' also
      // fires when the client disconnects mid-request. Use a one-shot guard so
      // a single request is only ever decremented once.
      let released = false;
      const done = () => {
        if (released) return;
        released = true;
        this._activeCount = Math.max(0, this._activeCount - 1);
      };

      res.once("finish", done); // response sent successfully
      res.once("close", done); // client disconnected mid-request
    });

    return this;
  }

  waitForDrain(timeoutMs: number): Promise<void> {
    if (this._activeCount === 0) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        clearInterval(interval);
        reject(new Error(`Drain timed out: ${this._activeCount} requests still active`));
      }, timeoutMs);
      timer.unref();

      const interval = setInterval(() => {
        if (this._activeCount === 0) {
          clearInterval(interval);
          clearTimeout(timer);
          resolve();
        }
      }, DRAIN_POLL_INTERVAL_MS);
    });
  }
}

/**
 * Type guard — checks at runtime whether a tracker supports attachment,
 * without casting.
 */
export function isAttachable(tracker: ConnectionTracker): tracker is AttachableConnectionTracker {
  return typeof (tracker as AttachableConnectionTracker).attach === "function";
}

import { TokenError } from "../core/errors.js";
import type { RefreshTokenRecord, RotateResult, TokenStore } from "../core/types.js";

/** Access-token-only store. Always request `{ refresh: false }` when using it. */
export class StatelessTokenStore implements TokenStore {
  async saveRefreshToken(_record: RefreshTokenRecord): Promise<void> {
    throw this.unsupported();
  }
  async getRefreshToken(_tokenHash: string): Promise<RefreshTokenRecord | undefined> {
    throw this.unsupported();
  }
  async rotateRefreshToken(_input: {
    currentHash: string;
    replacement: RefreshTokenRecord;
    now: Date;
  }): Promise<RotateResult> {
    throw this.unsupported();
  }
  async revokeByHash(_hash: string): Promise<void> {
    throw this.unsupported();
  }
  async revokeByFamily(_familyId: string): Promise<void> {
    throw this.unsupported();
  }
  async revokeBySub(_sub: string): Promise<void> {
    throw this.unsupported();
  }
  private unsupported(): TokenError {
    return new TokenError(
      "UNSUPPORTED_OPERATION",
      "Refresh tokens and server-side revocation are disabled in stateless mode"
    );
  }
}

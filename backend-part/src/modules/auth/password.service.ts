import { Injectable } from "@nestjs/common";
import { hash, verify, argon2id } from "argon2";

const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const dummyHash = hash(
  "findme-dummy-password-verification-value",
  ARGON2_OPTIONS,
);

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  async performDummyVerification(password: string): Promise<void> {
    await this.verify(await dummyHash, password);
  }
}

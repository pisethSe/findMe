import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";

import {
  EntitlementsService,
  type EntitlementExpirySweepResult,
} from "./entitlements.service.js";

const EXPIRY_SWEEP_INTERVAL_MS = 60_000;

export interface EntitlementExpiryRunResult extends EntitlementExpirySweepResult {
  skipped: boolean;
}

@Injectable()
export class EntitlementExpiryScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(EntitlementExpiryScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly entitlements: EntitlementsService) {}

  onApplicationBootstrap(): void {
    this.scheduleRun();
    this.timer = setInterval(
      () => this.scheduleRun(),
      EXPIRY_SWEEP_INTERVAL_MS,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce(now = new Date()): Promise<EntitlementExpiryRunResult> {
    if (this.running) {
      return { expiredLandlords: 0, pausedListings: 0, skipped: true };
    }

    this.running = true;
    try {
      const result = await this.entitlements.sweepExpiredEntitlements(now);
      if (result.expiredLandlords > 0) {
        this.logger.log(
          `Expired ${result.expiredLandlords} landlord entitlement(s) and paused ${result.pausedListings} listing(s).`,
        );
      }
      return { ...result, skipped: false };
    } finally {
      this.running = false;
    }
  }

  private scheduleRun(): void {
    void this.runOnce().catch((error: unknown) => {
      this.logger.error(
        "The landlord entitlement expiry sweep failed and will be retried.",
        error instanceof Error ? error.stack : undefined,
      );
    });
  }
}

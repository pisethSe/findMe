import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AccessPrincipal } from "../auth/auth.types.js";
import type { ListFavoritesDto } from "./favorites.dto.js";
import { FavoritesRepository } from "./favorites.repository.js";

@Injectable()
export class FavoritesService {
  constructor(private readonly repository: FavoritesRepository) {}

  list(user: AccessPrincipal, query: ListFavoritesDto) {
    this.requireStudent(user);
    return this.repository.list(user.id, query);
  }

  async setSaved(user: AccessPrincipal, listingId: string, saved: boolean) {
    this.requireStudent(user);
    if (saved) await this.repository.save(user.id, listingId);
    else await this.repository.remove(user.id, listingId);
    return { data: { listingId, saved } };
  }

  private requireStudent(user: AccessPrincipal) {
    if (user.role !== "STUDENT" || !user.onboardingComplete) {
      throw new ForbiddenException({
        code: "STUDENT_ONBOARDING_REQUIRED",
        message: "Complete student onboarding to save rentals.",
      });
    }
  }
}

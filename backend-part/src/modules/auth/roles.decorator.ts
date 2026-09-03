import { SetMetadata } from "@nestjs/common";

import type { UserRole } from "../../generated/prisma/client.js";

export const REQUIRED_ROLES_KEY = "findme.required-roles";

export const Roles = (...roles: UserRole[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);

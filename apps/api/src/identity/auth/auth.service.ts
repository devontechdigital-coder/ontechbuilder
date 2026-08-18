import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import { MembershipRole, MembershipStatus, Prisma, TenantStatus } from "../../core/database/database.js";
import { requiredSlug, requiredString } from "../../core/common/input.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import { SessionService } from "./session.service.js";
import type { SafeUserResponse } from "./auth.types.js";

interface RegisterInput {
  email: unknown;
  password: unknown;
  displayName: unknown;
  tenantName: unknown;
  tenantSlug: unknown;
}

interface LoginInput {
  email: unknown;
  password: unknown;
}

const userSelect = {
  id: true,
  email: true,
  displayName: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async register(input: RegisterInput): Promise<{
    user: SafeUserResponse;
    session: { token: string; expiresAt: Date };
  }> {
    const email = this.normalizeEmail(input.email);
    const passwordHash = await this.hashPassword(input.password);
    const displayName = requiredString(input.displayName, "displayName");
    const tenantName = requiredString(input.tenantName, "tenantName");
    const tenantSlug = requiredSlug(input.tenantSlug, "tenantSlug");

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            displayName,
            passwordHash,
          },
          select: userSelect,
        });

        const organization = await tx.organization.create({
          data: {
            name: tenantName,
          },
          select: {
            id: true,
          },
        });

        const tenant = await tx.tenant.create({
          data: {
            organizationId: organization.id,
            name: tenantName,
            slug: tenantSlug,
            status: TenantStatus.ACTIVE,
          },
          select: {
            id: true,
          },
        });

        await tx.tenantMember.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            role: MembershipRole.OWNER,
            status: MembershipStatus.ACTIVE,
          },
        });

        return { user, tenantId: tenant.id };
      });

      const session = await this.sessions.createSession(result.user.id, result.tenantId);

      return {
        user: result.user,
        session,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Email is already registered");
      }

      throw error;
    }
  }

  async login(input: LoginInput): Promise<{
    user: SafeUserResponse;
    session: { token: string; expiresAt: Date };
  }> {
    const email = this.normalizeEmail(input.email);
    const password = this.validatePasswordInput(input.password);

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        passwordHash: true,
        tenantMemberships: {
          where: {
            status: MembershipStatus.ACTIVE,
          },
          orderBy: {
            createdAt: "asc",
          },
          take: 1,
          select: {
            tenantId: true,
          },
        },
      },
    });

    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const session = await this.sessions.createSession(
      user.id,
      user.tenantMemberships[0]?.tenantId ?? null,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      session,
    };
  }

  private normalizeEmail(value: unknown): string {
    const email = requiredString(value, "email").toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("Email must be valid");
    }

    return email;
  }

  private validatePasswordInput(value: unknown): string {
    if (typeof value !== "string") {
      throw new BadRequestException("Password is required");
    }

    return value;
  }

  private async hashPassword(value: unknown): Promise<string> {
    const password = this.validatePasswordInput(value);

    if (password.length < 12) {
      throw new BadRequestException("Password must be at least 12 characters");
    }

    return bcrypt.hash(password, 12);
  }
}

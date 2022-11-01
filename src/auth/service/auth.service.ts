const bcrypt = require("bcryptjs")
import { Injectable, Inject, CACHE_MANAGER } from "@nestjs/common"
import {
  User,
  AccountConfirmationToken,
  Prisma,
  SessionToken,
} from "@prisma/client"
import { RedisService } from "../../cache/redis.service"

import { PrismaService } from "../../database/prisma.service"
import { UserService } from "../../user/service/user.service"
import { CreateUserDto } from "../../user/types"

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 10
  private readonly SESSION_TOKEN_EXPIRATION = 60 * 60 // 1 hour

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private redis: RedisService
  ) {}

  public async isEmailAvailable(email: User["email"]): Promise<boolean> {
    const user = await this.userService.getUser({ email })
    return !user
  }

  public async createUser(input: CreateUserDto): Promise<User> {
    return await this.userService.createUser(input)
  }

  public isPasswordLongEnough(password: User["password"]): boolean {
    return password.length >= 8
  }

  public isPasswordStrong(password: User["password"]): boolean {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,})/.test(password)
  }

  public async hashPassword(password: User["password"]): Promise<string> {
    return await bcrypt.hash(password, this.SALT_ROUNDS)
  }

  public async comparePassword(
    password: User["password"],
    hash: string
  ): Promise<boolean> {
    return await bcrypt.compare(password, hash)
  }

  public isTokenValid(token: AccountConfirmationToken | SessionToken): boolean {
    const tokenExpirationDate = new Date(
      token.createdAt.getTime() + this.SESSION_TOKEN_EXPIRATION * 1000
    )
    return tokenExpirationDate > new Date()
  }

  public async getSessionTokenById(
    tokenId: SessionToken["id"]
  ): Promise<SessionToken> {
    return (
      (await this.redis.get<SessionToken>(tokenId)) ??
      (await this.prisma.sessionToken.findUnique({
        where: { id: tokenId },
      }))
    )
  }

  public async createAccountConfirmationToken(
    userId: AccountConfirmationToken["userId"]
  ): Promise<AccountConfirmationToken> {
    return await this.prisma.accountConfirmationToken.create({
      data: {
        userId,
      },
    })
  }

  public async getAccountConfirmationToken(
    userWhereUniqueInput: Prisma.AccountConfirmationTokenWhereUniqueInput
  ): Promise<AccountConfirmationToken> {
    return await this.prisma.accountConfirmationToken.findUnique({
      where: userWhereUniqueInput,
    })
  }
}

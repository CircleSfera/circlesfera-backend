import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtOptionalGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: TUser): TUser | null {
    if (err || !user) {
      return null;
    }
    return user;
  }
}

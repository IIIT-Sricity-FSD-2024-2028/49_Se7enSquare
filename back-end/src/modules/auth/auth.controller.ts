import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  readSessionCookie,
  SESSION_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from '../../common/utils/auth-sessions';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('change-password')
  changePassword(
    @CurrentUser('id') userId: number,
    @Body() payload: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, ...user } = this.authService.changePassword(userId, payload);
    this.setSessionCookie(response, accessToken);
    return user;
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  register(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  @Post('login')
  @ApiOperation({ summary: 'Sign in with username/email and password' })
  login(@Body() payload: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { accessToken, ...user } = this.authService.login(payload);
    this.setSessionCookie(response, accessToken);
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(
    @CurrentUser('id') userId: number,
    @Headers('authorization') authorization = '',
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = authorization.replace(/^Bearer\s+/i, '').trim() || readSessionCookie(request.headers.cookie);
    if (token) response.clearCookie(SESSION_COOKIE_NAME, this.cookieOptions());
    return this.authService.logout(userId, token);
  }

  @Post('google')
  @ApiOperation({ summary: 'Sign in or register with verified Google credential' })
  async googleAuth(@Body() payload: GoogleAuthDto, @Res({ passthrough: true }) response: Response) {
    const { accessToken, ...user } = await this.authService.googleAuth(payload);
    this.setSessionCookie(response, accessToken);
    return user;
  }

  private setSessionCookie(response: Response, token: string) {
    response.cookie(SESSION_COOKIE_NAME, token, {
      ...this.cookieOptions(),
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
    });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/api',
    };
  }
}

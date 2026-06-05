import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { BadgesService } from './badge.service';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('badges')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get()
  async getBadges(@Req() req) {
    // req.user.id được giải mã từ JWT token
    const badges = await this.badgesService.getUserBadges(req.user.id);
    return { badges };
  }

  @Post('unlock')
  async unlockBadges(@Req() req, @Body('badges') newBadges: string[]) {
    return this.badgesService.unlockBadges(req.user.id, newBadges);
  }

  @Post('lock')
  async lockBadges(@Req() req, @Body('badges') badgesToLock: string[]) {
    return this.badgesService.lockBadges(req.user.id, badgesToLock);
  }
}

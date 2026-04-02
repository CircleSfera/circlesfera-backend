import { Controller, Post, Body } from '@nestjs/common';
import { WhitelistService } from './whitelist.service.js';
import { CreateWhitelistEntryDto } from './dto/create-whitelist-entry.dto.js';

@Controller('whitelist')
export class WhitelistController {
  constructor(private readonly whitelistService: WhitelistService) {}

  @Post('signup')
  create(@Body() createWhitelistEntryDto: CreateWhitelistEntryDto) {
    return this.whitelistService.create(createWhitelistEntryDto);
  }
}

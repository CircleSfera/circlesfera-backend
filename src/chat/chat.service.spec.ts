import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../socket/app.gateway';
import { vi } from 'vitest';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: AppGateway,
          useValue: {
            server: {
              emit: vi.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

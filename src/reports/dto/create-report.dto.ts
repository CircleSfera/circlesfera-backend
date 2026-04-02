import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum ReportReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  INAPPROPRIATE = 'inappropriate',
  OTHER = 'other',
}

export enum ReportTargetType {
  USER = 'user',
  POST = 'post',
}

export class CreateReportDto {
  @IsEnum(ReportTargetType)
  @IsNotEmpty()
  targetType!: ReportTargetType;

  @IsString()
  @IsNotEmpty()
  targetId!: string;

  @IsEnum(ReportReason)
  @IsNotEmpty()
  reason!: ReportReason;

  @IsString()
  @IsOptional()
  details?: string;
}

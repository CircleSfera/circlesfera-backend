import { IsString, IsNotEmpty } from 'class-validator';

export class StoryReactionDto {
  @IsString()
  @IsNotEmpty()
  reaction!: string; // emoji e.g. "❤️"
}

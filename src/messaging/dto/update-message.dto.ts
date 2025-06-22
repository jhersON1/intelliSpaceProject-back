import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateMessageDto {
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}

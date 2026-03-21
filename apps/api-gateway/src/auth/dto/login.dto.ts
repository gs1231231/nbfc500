import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'officer@acme-nbfc.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'S3cur3P@ssword' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}

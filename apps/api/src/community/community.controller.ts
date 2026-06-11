import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/auth-user.type';
import {
  CommunityPostDto,
  CommunityService,
  CommunityUserDto,
} from './community.service';

class CreatePostDto {
  @IsString()
  @IsOptional()
  @MaxLength(160)
  title?: string;

  @IsString()
  @MaxLength(50000)
  content: string;

  @IsOptional()
  @IsArray()
  imageUrls?: string[];

  @IsOptional()
  @IsArray()
  contentBlocks?: Array<{
    id: string;
    type: 'text' | 'image';
    text?: string;
    url?: string;
  }>;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;

  @IsOptional()
  @IsArray()
  stockTags?: Array<{
    symbol: string;
    name: string;
    market: 'US' | 'KR';
  }>;
}

class CreateCommentDto {
  @IsString()
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

@Controller('community')
@UseGuards(JwtAuthGuard)
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('feed')
  getFeed(
    @CurrentUser() currentUser: AuthUser,
    @Query('scope') scope: 'all' | 'subscribed' | 'mine' | 'user' = 'all',
    @Query('userId') userId?: string,
    @Query('sort') sort: 'latest' | 'popular' = 'latest',
  ): Promise<CommunityPostDto[]> {
    return this.communityService.getFeed(currentUser.sub, scope, userId, sort);
  }

  @Get('related')
  getRelatedPosts(
    @CurrentUser() currentUser: AuthUser,
    @Query('symbol') symbol: string,
  ): Promise<CommunityPostDto[]> {
    return this.communityService.getRelatedPosts(currentUser.sub, symbol);
  }

  @Post('posts')
  createPost(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreatePostDto,
  ): Promise<CommunityPostDto> {
    return this.communityService.createPost(currentUser.sub, body);
  }

  @Get('posts/:id')
  getPost(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
  ): Promise<CommunityPostDto> {
    return this.communityService.getPost(currentUser.sub, id);
  }

  @Patch('posts/:id')
  updatePost(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
    @Body() body: CreatePostDto,
  ): Promise<CommunityPostDto> {
    return this.communityService.updatePost(currentUser.sub, id, body);
  }

  @Delete('posts/:id')
  deletePost(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    return this.communityService.deletePost(currentUser.sub, id);
  }

  @Post('posts/:id/like')
  toggleLike(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    return this.communityService.toggleLike(currentUser.sub, id);
  }

  @Post('posts/:id/comments')
  createComment(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
    @Body() body: CreateCommentDto,
  ): Promise<CommunityPostDto> {
    return this.communityService.createComment(currentUser.sub, id, body);
  }

  @Patch('comments/:id')
  updateComment(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
    @Body() body: CreateCommentDto,
  ): Promise<CommunityPostDto> {
    return this.communityService.updateComment(currentUser.sub, id, body.content);
  }

  @Delete('comments/:id')
  deleteComment(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
  ): Promise<CommunityPostDto> {
    return this.communityService.deleteComment(currentUser.sub, id);
  }

  @Get('users')
  getUsers(@CurrentUser() currentUser: AuthUser): Promise<CommunityUserDto[]> {
    return this.communityService.getUsers(currentUser.sub);
  }

  @Post('users/:id/subscribe')
  toggleSubscription(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
  ): Promise<{ subscribed: boolean }> {
    return this.communityService.toggleSubscription(currentUser.sub, id);
  }
}

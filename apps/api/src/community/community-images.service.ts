import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import sharp from 'sharp';
import { In, IsNull, Repository } from 'typeorm';
import { UserStatus } from '../users/user-status.enum';
import { User } from '../users/user.entity';
import { CommunityImage } from './community-image.entity';
import { CommunityPost } from './community-post.entity';

export const COMMUNITY_IMAGE_URL_PREFIX = '/uploads/community/';
export const MAX_COMMUNITY_IMAGES = 20;
export const MAX_COMMUNITY_IMAGE_BYTES = 3 * 1024 * 1024;

const IMAGE_TYPES = {
  jpeg: { mime: 'image/jpeg', extensions: ['.jpg', '.jpeg'] },
  png: { mime: 'image/png', extensions: ['.png'] },
  webp: { mime: 'image/webp', extensions: ['.webp'] },
} as const;

type UploadedFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class CommunityImagesService {
  private readonly uploadDir: string;

  constructor(
    @InjectRepository(CommunityImage)
    private readonly imagesRepository: Repository<CommunityImage>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    configService: ConfigService,
  ) {
    this.uploadDir = configService.get<string>(
      'COMMUNITY_UPLOAD_DIR',
      join(process.cwd(), 'uploads', 'community'),
    );
  }

  async upload(userId: string, file?: UploadedFile) {
    if (!file) throw new BadRequestException('An image file is required.');
    if (file.size > MAX_COMMUNITY_IMAGE_BYTES) {
      throw new BadRequestException('Image must be 3MB or smaller.');
    }
    const owner = await this.usersRepository.findOne({ where: { id: userId } });
    if (!owner || owner.status !== UserStatus.Approved) {
      throw new NotFoundException('Approved user not found.');
    }

    const extension = extname(file.originalname).toLowerCase();
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(file.buffer, { failOn: 'error' }).metadata();
    } catch {
      throw new BadRequestException('The file is not a valid image.');
    }
    const type = metadata.format
      ? IMAGE_TYPES[metadata.format as keyof typeof IMAGE_TYPES]
      : undefined;
    if (
      !type ||
      file.mimetype !== type.mime ||
      !(type.extensions as readonly string[]).includes(extension) ||
      !metadata.width ||
      !metadata.height
    ) {
      throw new BadRequestException('Image MIME type, extension, or content does not match.');
    }

    const filename = `${randomUUID()}${type.extensions[0]}`;
    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(join(this.uploadDir, filename), file.buffer, { flag: 'wx' });
    try {
      const image = await this.imagesRepository.save(
        this.imagesRepository.create({
          owner,
          post: null,
          filename,
          mimeType: type.mime,
          width: metadata.width,
          height: metadata.height,
          size: file.size,
        }),
      );
      return {
        id: image.id,
        url: `${COMMUNITY_IMAGE_URL_PREFIX}${filename}`,
        width: image.width,
        height: image.height,
        size: image.size,
      };
    } catch (error) {
      await this.removeFile(filename);
      throw error;
    }
  }

  async deleteUnused(userId: string, id: string): Promise<{ ok: true }> {
    const image = await this.imagesRepository.findOne({
      where: { id, post: IsNull() },
    });
    if (!image) throw new NotFoundException('Unused image not found.');
    if (image.owner.id !== userId) {
      throw new ForbiddenException('You do not own this image.');
    }
    await this.imagesRepository.remove(image);
    await this.removeFile(image.filename);
    return { ok: true };
  }

  extractAllImageUrls(html: string): string[] {
    return [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(
      (match) => match[1],
    );
  }

  extractLocalUrls(html: string): string[] {
    return [...new Set(
      this.extractAllImageUrls(html).filter((url) =>
        url.startsWith(COMMUNITY_IMAGE_URL_PREFIX),
      ),
    )];
  }

  async validateOwnedUrls(userId: string, urls: string[]): Promise<CommunityImage[]> {
    if (urls.length > MAX_COMMUNITY_IMAGES) {
      throw new BadRequestException(`A post can contain at most ${MAX_COMMUNITY_IMAGES} images.`);
    }
    if (!urls.length) return [];
    const filenames = urls.map((url) => url.slice(COMMUNITY_IMAGE_URL_PREFIX.length));
    if (filenames.some((name) => !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(name))) {
      throw new BadRequestException('Invalid community image URL.');
    }
    const images = await this.imagesRepository.find({ where: { filename: In(filenames) } });
    if (
      images.length !== filenames.length ||
      images.some((image) => image.owner.id !== userId)
    ) {
      throw new BadRequestException('Images must be uploaded by the post author.');
    }
    return images;
  }

  async attach(post: CommunityPost, images: CommunityImage[]): Promise<void> {
    for (const image of images) {
      if (image.post && image.post.id !== post.id) {
        throw new BadRequestException('An image is already attached to another post.');
      }
      image.post = post;
    }
    if (images.length) await this.imagesRepository.save(images);
  }

  async removeDetached(postId: string, retainedUrls: string[]): Promise<void> {
    const attached = await this.imagesRepository.find({
      where: { post: { id: postId } },
    });
    const retained = new Set(retainedUrls);
    const removed = attached.filter(
      (image) => !retained.has(`${COMMUNITY_IMAGE_URL_PREFIX}${image.filename}`),
    );
    if (!removed.length) return;
    await this.imagesRepository.remove(removed);
    await Promise.all(removed.map((image) => this.removeFile(image.filename)));
  }

  async removeForPost(postId: string): Promise<void> {
    await this.removeDetached(postId, []);
  }

  private async removeFile(filename: string): Promise<void> {
    try {
      await unlink(join(this.uploadDir, filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

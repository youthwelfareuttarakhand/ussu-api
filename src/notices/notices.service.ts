import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

type UploadedFile = { buffer: Buffer; originalname: string; mimetype: string };

@Injectable()
export class NoticesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  findAll() {
    return this.prisma.notice.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        body: true,
        postedBy: true,
        createdAt: true,
        attachmentFilename: true,
      },
    });
  }

  async create(title: string, body: string, postedBy: string, file?: UploadedFile) {
    const attachment = await this.storeAttachment(file);
    return this.prisma.notice.create({
      data: { title, body, postedBy, ...attachment },
      select: {
        id: true,
        title: true,
        body: true,
        postedBy: true,
        createdAt: true,
        attachmentFilename: true,
      },
    });
  }

  async update(id: string, data: { title?: string; body?: string }, file?: UploadedFile) {
    await this.ensureExists(id);
    const attachment = file ? await this.storeAttachment(file) : {};
    return this.prisma.notice.update({
      where: { id },
      data: { ...data, ...attachment },
      select: {
        id: true,
        title: true,
        body: true,
        postedBy: true,
        createdAt: true,
        attachmentFilename: true,
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.notice.delete({ where: { id } });
  }

  async getAttachment(id: string) {
    const notice = await this.prisma.notice.findUnique({
      where: { id },
      select: {
        attachmentUrl: true,
        attachmentData: true,
        attachmentMimeType: true,
        attachmentFilename: true,
      },
    });
    if (!notice || (!notice.attachmentUrl && !notice.attachmentData)) {
      throw new NotFoundException("No attachment for this notice");
    }
    return {
      url: notice.attachmentUrl ? this.storage.getReadUrl(notice.attachmentUrl) : null,
      data: notice.attachmentData,
      mimeType: notice.attachmentMimeType,
      filename: notice.attachmentFilename ?? "attachment",
    };
  }

  private async ensureExists(id: string) {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException("Notice not found");
  }

  private async storeAttachment(file?: UploadedFile) {
    if (!file) return {};
    const stored = await this.storage.store("notices", file.originalname, file.buffer, file.mimetype);
    return stored.kind === "azure"
      ? {
          attachmentFilename: file.originalname,
          attachmentUrl: stored.url,
          attachmentData: null,
          attachmentMimeType: null,
        }
      : {
          attachmentFilename: file.originalname,
          attachmentUrl: null,
          attachmentData: stored.data,
          attachmentMimeType: stored.mimeType,
        };
  }
}

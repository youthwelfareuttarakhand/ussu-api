import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, type ContainerClient } from "@azure/storage-blob";

export type StoredFile = { kind: "azure"; url: string } | { kind: "db"; data: Buffer; mimeType: string };

@Injectable()
export class StorageService {
  private container: ContainerClient | null = null;

  constructor(private config: ConfigService) {
    const connectionString = this.config.get<string>("azureStorage.connectionString");
    const containerName = this.config.get<string>("azureStorage.container");
    // Deliberately unset in staging/local — only the production ussu-api
    // Container App has these env vars wired to the real Azure Storage
    // account, so staging/dev traffic can never write real documents there.
    if (connectionString && containerName) {
      this.container = BlobServiceClient.fromConnectionString(connectionString).getContainerClient(containerName);
    }
  }

  // The container is private (no public read access), so a stored blob's
  // plain `url` 403s on its own — callers must go through this to get a
  // short-lived signed URL instead of ever serving the raw one.
  getReadUrl(blobUrl: string): string {
    if (!this.container) return blobUrl;
    const blobName = decodeURIComponent(new URL(blobUrl).pathname.split("/").slice(2).join("/"));
    const blockBlobClient = this.container.getBlockBlobClient(blobName);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: this.container.containerName,
        blobName,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn: new Date(Date.now() + 10 * 60 * 1000),
      },
      this.container.credential as import("@azure/storage-blob").StorageSharedKeyCredential,
    ).toString();
    return `${blockBlobClient.url}?${sas}`;
  }

  // Azure Blob when configured (production); otherwise falls back to
  // returning the raw bytes for the caller to store in Postgres — free, no
  // external service, good enough for staging/local test volumes. Never
  // silently drops a file: exactly one of the two paths always runs.
  async store(pathPrefix: string, filename: string, buffer: Buffer, contentType: string): Promise<StoredFile> {
    if (!this.container) {
      return { kind: "db", data: buffer, mimeType: contentType };
    }
    const blobName = `${pathPrefix}/${Date.now()}-${filename}`;
    const blockBlobClient = this.container.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });
    return { kind: "azure", url: blockBlobClient.url };
  }
}

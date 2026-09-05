import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";

import {
  getAppEnvironment,
  getObjectStorageConfig,
  type ObjectStorageConfig,
} from "../../config/environment.js";

const UPLOAD_URL_TTL_SECONDS = 5 * 60;

@Injectable()
export class ObjectStorageService {
  private readonly config: ObjectStorageConfig | null;
  private readonly client: S3Client | null;

  constructor() {
    this.config = getObjectStorageConfig(
      process.env,
      getAppEnvironment(process.env.APP_ENV),
    );
    this.client = this.config
      ? new S3Client({
          ...(this.config.endpoint ? { endpoint: this.config.endpoint } : {}),
          region: this.config.region,
          forcePathStyle: this.config.forcePathStyle,
          credentials: {
            accessKeyId: this.config.accessKeyId,
            secretAccessKey: this.config.secretAccessKey,
          },
        })
      : null;
  }

  isConfigured(): boolean {
    return this.client !== null && this.config !== null;
  }

  publicUrl(storageKey: string): string {
    return `${this.requireConfig().cdnBaseUrl}/${storageKey}`;
  }

  async createUploadUrl(
    storageKey: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; expiresAt: Date }> {
    const { client, config } = this.requireStorage();
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      signableHeaders: new Set(["content-type"]),
    });
    return {
      uploadUrl,
      expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1_000),
    };
  }

  async inspectObject(storageKey: string): Promise<{
    contentLength: number;
    contentType: string;
    signature: Uint8Array;
  }> {
    const { client, config } = this.requireStorage();
    const [head, sample] = await Promise.all([
      client.send(
        new HeadObjectCommand({ Bucket: config.bucket, Key: storageKey }),
      ),
      client.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: storageKey,
          Range: "bytes=0-15",
        }),
      ),
    ]);
    const signature = sample.Body
      ? await sample.Body.transformToByteArray()
      : new Uint8Array();
    return {
      contentLength: head.ContentLength ?? 0,
      contentType:
        head.ContentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "",
      signature,
    };
  }

  async deleteObject(storageKey: string): Promise<void> {
    const { client, config } = this.requireStorage();
    await client.send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }),
    );
  }

  private requireConfig(): ObjectStorageConfig {
    if (this.config) return this.config;
    throw storageUnavailable();
  }

  private requireStorage(): { client: S3Client; config: ObjectStorageConfig } {
    if (this.client && this.config) {
      return { client: this.client, config: this.config };
    }
    throw storageUnavailable();
  }
}

function storageUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: "MEDIA_STORAGE_UNAVAILABLE",
    message:
      "Rental photo storage is not configured or is temporarily unavailable.",
  });
}

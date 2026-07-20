import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fileTypeFromBuffer } from "file-type";
import redis from './redis.server';

if (!process.env.S3_ENDPOINT) {
    throw new Error("S3_ENDPOINT is required");
}

if (!process.env.S3_ACCESS_KEY_ID) {
    throw new Error("S3_ACCESS_KEY_ID is required");
}

if (!process.env.S3_SECRET_ACCESS_KEY) {
    throw new Error("S3_SECRET_ACCESS_KEY is required");
}

if (!process.env.S3_PRIVATE_BUCKET || !process.env.S3_PUBLIC_BUCKET) {
    throw new Error("S3_PRIVATE_BUCKET and S3_PUBLIC_BUCKET is required");
}

const EXPIRED_IN = 3600;
const REDIS_EXPIRED_IN = 604800;

export class S3Actions {
    constructor(private readonly client: S3Client,
                private readonly bucket: string) { }

    async getResourceMetadata(file: string) {
        return await this.client.send(new HeadObjectCommand({
            Bucket: this.bucket,
            Key: file
        }));
    }

    async getResourceCheckSum(file: string) {
        const metadata = await this.getResourceMetadata(file);
        return metadata.ChecksumSHA256 || "";
    }

    async getResourceSize(file: string) {
        const size = await redis.get(`s3:${file}:size`);

        if (!size) {
            const resourceSize = await this.getResourceSizeDirect(file);
            await redis.set(`s3:${file}:size`, resourceSize, { EX: REDIS_EXPIRED_IN });

            return resourceSize;
        }

        return Number(size);
    }

    async getResourceSizeDirect(file: string) {
        const metadata = await this.getResourceMetadata(file);
        return Number(metadata.ContentLength || 0);
    }

    async getResourceSignedUrl(file: string, filename: string) {
        return await getSignedUrl(this.client, new GetObjectCommand({
            Bucket: this.bucket,
            Key: file,
            ResponseContentDisposition: `attachment; filename="${filename}"`
        }), { expiresIn: EXPIRED_IN });
    }

    async putResourceWithSignedUrl(file: string) {
        return await getSignedUrl(this.client, new PutObjectCommand({
            Bucket: this.bucket,
            Key: file,
        }), { expiresIn: EXPIRED_IN });
    }

    async getResourceMimeType(file: string) {
        const data = await this.client.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: file,
            Range: "bytes=0-1024"
        }));

        if (!data.Body) {
            throw new Error("Failed to get object body from S3");
        }
        return await fileTypeFromBuffer(await data.Body.transformToByteArray());
    }

    async getResources(continuationToken?: string) {
        const data = await this.client.send(new ListObjectsV2Command({
            Bucket: this.bucket,
            Delimiter: "/",
            ContinuationToken: continuationToken,
            MaxKeys: 100,
        }));

        return {
            content: data.Contents,
            isTruncated: data.IsTruncated,
            continuationToken: data.NextContinuationToken,
        };
    }

    async deleteResource(file: string) {
        return await this.client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: file
        }));
    }

    // Multipart Upload
    async createResourceMultipartUpload(file: string, contentType: string = "application/octet-stream") {
        return await this.client.send(new CreateMultipartUploadCommand({
            Bucket: this.bucket,
            Key: file,
            ContentType: contentType
        }));
    }

    async uploadResourcePartWithSignedUrl(file: string, partNumber: number, uploadId: string) {
        return await getSignedUrl(this.client, new UploadPartCommand({
            Bucket: this.bucket,
            Key: file,
            PartNumber: partNumber,
            UploadId: uploadId,
        }), { expiresIn: EXPIRED_IN });
    }

    async completeResourceMultipartUpload(file: string, uploadId: string, parts: { ETag: string, PartNumber: number }[]) {
        return await this.client.send(new CompleteMultipartUploadCommand({
            Bucket: this.bucket,
            Key: file,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts
            }
        }));
    }

    async abortResourceMultipartUpload(file: string, uploadId: string) {
        return await this.client.send(new AbortMultipartUploadCommand({
            Bucket: this.bucket,
            Key: file,
            UploadId: uploadId,
        }));
    }
}

export const privateS3 = new S3Actions(new S3Client({
    region: "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    }
}), process.env.S3_PRIVATE_BUCKET);

export const publicS3 = new S3Actions(new S3Client({
    region: "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    }
}), process.env.S3_PUBLIC_BUCKET);

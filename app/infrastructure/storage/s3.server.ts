import {
    AbortMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    CreateMultipartUploadCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    ListPartsCommand,
    PutObjectCommand,
    S3Client,
    UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fileTypeFromBuffer } from "file-type";
import { collectMultipartParts, MultipartPart, S3_MAX_PART_COUNT } from "./multipartParts";
import { env } from "@/lib/env.server";

const EXPIRED_IN = 3600;

export class S3Actions {
    constructor(
        private readonly client: S3Client,
        private readonly bucket: string,
    ) {}

    async getResourceMetadata(file: string) {
        return await this.client.send(
            new HeadObjectCommand({
                Bucket: this.bucket,
                Key: file,
            }),
        );
    }

    async getResourceCheckSum(file: string) {
        const metadata = await this.getResourceMetadata(file);
        return metadata.ChecksumSHA256 || "";
    }

    async getResourceSizeDirect(file: string) {
        const metadata = await this.getResourceMetadata(file);
        return Number(metadata.ContentLength || 0);
    }

    async getResourceSignedUrl(file: string, filename: string) {
        return await getSignedUrl(
            this.client,
            new GetObjectCommand({
                Bucket: this.bucket,
                Key: file,
                ResponseContentDisposition: `attachment; filename="${filename}"`,
            }),
            { expiresIn: EXPIRED_IN },
        );
    }

    async putResourceWithSignedUrl(
        file: string,
        contentType: string = "application/octet-stream",
        contentLength?: number,
    ) {
        return await getSignedUrl(
            this.client,
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: file,
                ContentType: contentType,
                ContentLength: contentLength,
            }),
            { expiresIn: EXPIRED_IN },
        );
    }

    async getResourceMimeType(file: string) {
        const data = await this.client.send(
            new GetObjectCommand({
                Bucket: this.bucket,
                Key: file,
                Range: "bytes=0-1024",
            }),
        );

        if (!data.Body) {
            throw new Error("Failed to get object body from S3");
        }
        return await fileTypeFromBuffer(await data.Body.transformToByteArray());
    }

    async getResources(continuationToken?: string) {
        const data = await this.client.send(
            new ListObjectsV2Command({
                Bucket: this.bucket,
                Delimiter: "/",
                ContinuationToken: continuationToken,
                MaxKeys: 100,
            }),
        );

        return {
            content: data.Contents,
            isTruncated: data.IsTruncated,
            continuationToken: data.NextContinuationToken,
        };
    }

    async deleteResource(file: string) {
        return await this.client.send(
            new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: file,
            }),
        );
    }

    // Multipart Upload
    async createResourceMultipartUpload(
        file: string,
        contentType: string = "application/octet-stream",
    ) {
        return await this.client.send(
            new CreateMultipartUploadCommand({
                Bucket: this.bucket,
                Key: file,
                ContentType: contentType,
            }),
        );
    }

    async uploadResourcePartWithSignedUrl(
        file: string,
        partNumber: number,
        uploadId: string,
    ) {
        return await getSignedUrl(
            this.client,
            new UploadPartCommand({
                Bucket: this.bucket,
                Key: file,
                PartNumber: partNumber,
                UploadId: uploadId,
            }),
            { expiresIn: EXPIRED_IN },
        );
    }

    async completeResourceMultipartUpload(
        file: string,
        uploadId: string,
        parts: { ETag: string; PartNumber: number }[],
    ) {
        return await this.client.send(
            new CompleteMultipartUploadCommand({
                Bucket: this.bucket,
                Key: file,
                UploadId: uploadId,
                MultipartUpload: {
                    Parts: parts,
                },
            }),
        );
    }

    async abortResourceMultipartUpload(file: string, uploadId: string) {
        return await this.client.send(
            new AbortMultipartUploadCommand({
                Bucket: this.bucket,
                Key: file,
                UploadId: uploadId,
            }),
        );
    }

    // Returns all uploaded parts for a multipart upload, used server-side to
    // complete the upload without requiring the browser to read ETag headers
    // (which would require CORS Access-Control-Expose-Headers: ETag on R2).
    async listResourceMultipartUploadParts(
        file: string,
        uploadId: string,
    ): Promise<MultipartPart[]> {
        return await collectMultipartParts(async (marker) => {
            const data = await this.client.send(
                new ListPartsCommand({
                    Bucket: this.bucket,
                    Key: file,
                    UploadId: uploadId,
                    PartNumberMarker: marker,
                }),
            );

            return {
                parts: (data.Parts ?? []).flatMap((part) =>
                    part.ETag && part.PartNumber !== undefined
                        ? [{ ETag: part.ETag, PartNumber: part.PartNumber }]
                        : [],
                ),
                nextMarker: data.NextPartNumberMarker,
                isTruncated: data.IsTruncated ?? false,
            };
        }, S3_MAX_PART_COUNT);
    }
}

const client = new S3Client(env.storage);
export const privateS3 = new S3Actions(client, env.privateBucket);
export const publicS3 = new S3Actions(client, env.publicBucket);

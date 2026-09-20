function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
}

function integer(name: string, fallback: number, min = 1, max = 65535): number {
    const raw = process.env[name];
    const value = raw ? Number(raw) : fallback;
    if (!Number.isSafeInteger(value) || value < min || value > max)
        throw new Error(`${name} must be an integer between ${min} and ${max}`);
    return value;
}

// Validate each subsystem when initialized. Migrations only need DB settings.
export const env = {
    get database() {
        return {
            host: required("DB_HOST"),
            port: integer("DB_PORT", 3306),
            user: required("DB_USERNAME"),
            password: required("DB_PASSWORD"),
            database: required("DB_DATABASE"),
        };
    },
    get redis() {
        return {
            username: process.env.REDIS_USER || undefined,
            password: process.env.REDIS_PASS || undefined,
            database: integer("REDIS_DB", 0, 0, 2147483647),
            socket: {
                host: process.env.REDIS_HOST || "localhost",
                port: integer("REDIS_PORT", 6379),
                connectTimeout: 1500,
                reconnectStrategy: false as const,
            },
            disableOfflineQueue: true,
        };
    },
    get storage() {
        return {
            endpoint: required("S3_ENDPOINT"),
            region: process.env.S3_REGION || "auto",
            forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
            credentials: {
                accessKeyId: required("S3_ACCESS_KEY_ID"),
                secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
            },
        };
    },
    get privateBucket() { return required("S3_PRIVATE_BUCKET"); },
    get publicBucket() { return required("S3_PUBLIC_BUCKET"); },
    get verificationKey() { return required("VERIFICATION_KEY"); },
    get accessOrganization() { return process.env.CF_ACCESS_ORGANIZATION; },
    get accessAudience() { return process.env.CF_ACCESS_AUD; },
    get maxUploadSizeMB() { return process.env.MAX_UPLOAD_SIZE_MB; },
};

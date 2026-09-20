import nodeCrypto from 'crypto';
import { env } from "./env.server";

const KEY = env.verificationKey;

export const getTimebasedKey = (current?: number) => {
    const time = current ?? Math.floor(Date.now() / 1000 / 60);
    return {
        time,
        key: nodeCrypto.createHash('sha256').update(KEY + time).digest()
    };
}

export const sign = (data: string) => {
    const dataHash = nodeCrypto.createHash('sha256').update(data).digest('hex');
    const iv = nodeCrypto.randomBytes(16);
    const key = getTimebasedKey();
    const cipher = nodeCrypto.createCipheriv('aes-256-cbc', key.key, iv);
    const encrypted = Buffer.concat([cipher.update(dataHash), cipher.final()]);
    return [encrypted.toString('hex'), iv.toString('hex'), key.time].join('.');
}

export const verify = (data: string, signature: string) => {
    try {
        const [signatureData, iv, timeValue, ...extra] = signature.split('.');
        const time = Number(timeValue);
        const currentTime = Math.floor(Date.now() / 1000 / 60);
        if (extra.length || !signatureData || !iv || !Number.isInteger(time) || time > currentTime + 1 || currentTime - time > 60)
            return false;

        const encrypted = Buffer.from(signatureData, 'hex');
        const key = getTimebasedKey(time);
        const decipher = nodeCrypto.createDecipheriv('aes-256-cbc', key.key, Buffer.from(iv, "hex"));
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
        return decrypted === nodeCrypto.createHash('sha256').update(data).digest('hex');
    } catch {
        return false;
    }
}

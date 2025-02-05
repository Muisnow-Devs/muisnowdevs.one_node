import nodeCrypto from 'crypto';

const KEY = process.env.VERIFICATION_KEY;
if (!KEY) {
    throw new Error('Missing VERIFICATION_KEY');
}

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
    const [signatureData, iv, time] = signature.split('.');
    const encrypted = Buffer.from(signatureData, 'hex');
    const key = getTimebasedKey(Number(time));
    const decipher = nodeCrypto.createDecipheriv('aes-256-cbc', key.key, Buffer.from(iv, "hex"));
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
    return decrypted === nodeCrypto.createHash('sha256').update(data).digest('hex');
}
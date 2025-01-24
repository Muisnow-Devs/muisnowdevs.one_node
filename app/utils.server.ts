import crypto from 'crypto';
import { getClientIPAddress } from "remix-utils/get-client-ip-address";

export const generateUUID = () => crypto.randomUUID();
export const getIPAddress = (req: Request) => getClientIPAddress(req);
export const getIPHash = (req: Request) => {
    const ip = getIPAddress(req);
    if (!ip) return null;
    return crypto.createHash("sha256").update(ip).digest("hex");
}
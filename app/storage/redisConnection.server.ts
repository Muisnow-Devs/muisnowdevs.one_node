interface RedisConnectable {
    on(event: "error", listener: (error: unknown) => void): unknown;
    connect(): Promise<unknown>;
}

export async function connectRedisClient(
    client: RedisConnectable,
    onError: (error: unknown) => void,
): Promise<boolean> {
    client.on("error", onError);

    try {
        await client.connect();
        return true;
    } catch (error) {
        onError(error);
        return false;
    }
}

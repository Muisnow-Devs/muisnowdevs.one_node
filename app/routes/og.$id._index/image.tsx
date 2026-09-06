export interface ArticleOgProps {
    id: number;
    title: string;
    description: string;
    icon: string;
    image?: string;
    accentColor?: string;
}

function getTitleFontSize(title: string, hasImage: boolean): number {
    const length = title.length;

    if (hasImage) {
        if (length > 90) return 46;
        if (length > 65) return 52;
        if (length > 42) return 58;
        return 64;
    }

    if (length > 110) return 50;
    if (length > 80) return 58;
    if (length > 50) return 66;
    return 72;
}

export function ArticleOg({
    id,
    title,
    description,
    icon,
    image,
    accentColor = "#0582ca",
}: ArticleOgProps) {
    const titleFontSize = getTitleFontSize(title, Boolean(image));

    return (
        <div
            style={{
                width: 1200,
                height: 630,
                display: "flex",
                position: "relative",
                overflow: "hidden",
                boxSizing: "border-box",
                padding: "64px 72px",
                background: "#092328",
                color: "#fff",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    width: 460,
                    height: 460,
                    right: -140,
                    top: -180,
                    borderRadius: 9999,
                    background: `#12544F12`,
                }}
            />

            <div
                style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    gap: image ? 56 : 0,
                    position: "relative",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        flex: 1,
                        minWidth: 0,
                        height: "100%",
                    }}
                >
                    {/* Blog */}
                    <img
                        src={icon}
                        width={48}
                        height={48}
                        style={{
                            width: 48,
                            height: 48,
                            objectFit: "contain",
                        }}
                    />

                    {/* Article content */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            flex: 1,
                            minHeight: 0,
                            marginTop: 32,
                            overflow: "hidden",
                        }}
                    >
                        <div
                            style={{
                                display: "block",
                                overflow: "hidden",
                                lineClamp: 3,
                                fontSize: titleFontSize,
                                fontWeight: 700,
                                lineHeight: 1.08,
                                letterSpacing: "-0.04em",
                            }}
                        >
                            {title}
                        </div>

                        <div
                            style={{
                                display: "block",
                                overflow: "hidden",
                                lineClamp: 3,
                                marginTop: 24,
                                fontSize: 26,
                                fontWeight: 400,
                                lineHeight: 1.4,
                                color: "#9dc4a3",
                            }}
                        >
                            {description}
                        </div>
                    </div>

                    {/* Accent */}
                    <div
                        style={{
                            display: "flex",
                            width: 64,
                            height: 6,
                            flexShrink: 0,
                            borderRadius: 9999,
                            background: accentColor,
                        }}
                    />

                    <div
                        style={{
                            display: "flex",
                            marginTop: 8,
                            justifyContent: "space-between",
                            objectFit: "contain",
                        }}
                    >
                        <span>muisnowdevs.one/article/{id}</span>
                        <span>Muisnow Devs</span>
                    </div>
                </div>

                {image && (
                    <div
                        style={{
                            display: "flex",
                            width: 390,
                            alignItems: "center",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                width: 390,
                                height: 500,
                                borderRadius: 12,
                                overflow: "hidden",
                            }}
                        >
                            <img
                                src={image}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

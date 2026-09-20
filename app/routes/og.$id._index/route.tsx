/** @jsxRuntime automatic */
/** @jsxImportSource satori/jsx */

import { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";
import { getArticlePreview } from "@/features/articles/article.server";
import satori, { Font } from "satori";
import fira from "@/fonts/firacode.ttf?inline";
import noto from "@/fonts/notoserif.ttf?inline";
import { ArticleOg } from "./image";
import { Resvg } from "@resvg/resvg-js";

async function loadFont(name: string, path: string): Promise<Font> {
    const formattedPath = new URL(path, import.meta.url);
    const imageBuffer = await fetch(formattedPath).then((response) =>
        response.arrayBuffer(),
    );
    return {
        name: name,
        data: imageBuffer,
        weight: 400,
    };
}

const OG_FONTS = Promise.all([
    loadFont("Fira Code", fira),
    loadFont("Noto Serif TC", noto),
]);

export async function loader({ params }: LoaderFunctionArgs) {
    const { id } = params;

    invariant(id, "Article ID should be provided.");

    const idNum = Number(id);
    if (Number.isNaN(idNum) || idNum <= 0)
        throw new Response(null, { status: 404 });

    const fonts = await OG_FONTS;
    const article = await getArticlePreview(idNum);

    if (!article) throw new Response(null, { status: 404 });

    const svg = await satori(
        <ArticleOg
            id={article.id}
            icon="https://objects.sanziusercontent.com/sanzi_images/square_white.png"
            title={article.title}
            description={article.description}
        />,
        {
            width: 1200,
            height: 630,
            fonts,
        },
    );

    const png = new Resvg(svg).render().asPng();
    return new Response(Buffer.from(png), {
        headers: { "Content-Type": "image/png" },
    });
}

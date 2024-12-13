import Giscus from "@giscus/react";

interface CommentsArgs {
    id: number;
}

export default function Comments({ id }: CommentsArgs) {
    return <div className="bg-gray-900 rounded-xl p-5">
        <h1 className="text-4xl font-bold text-white">留言區</h1>
        <p className="text-white">Powered by <a href="https://giscus.app" target="_blank" rel="noreferrer" className="text-blue-400">Giscus</a></p>

        <Giscus
            repo="000hen/muisnowdevs.one-comment"
            repoId="R_kgDOKVj8XQ"
            category="General"
            categoryId="DIC_kwDOKVj8Xc4CZcBZ"
            mapping="specific"
            term={"article/" + id}
            strict="0"
            reactions-enabled="1"
            emitMetadata="0"
            inputPosition="top"
            theme="dark"
            lang="zh-TW"
            loading="lazy" />
    </div>;
}
import { GradText, Hilights } from "@/components/text";
import { classFormat } from "@/utils";
import { Link, MetaFunction } from "@remix-run/react";
import { PropsWithChildren } from "react";
import { FaQuoteLeft } from "react-icons/fa";

export const meta: MetaFunction = () => {
    return [
        { title: "茫茫海之中，很高興你發現了我 - Muisnow Devs" },
        { name: "description", content: "關於 Muisnow 的身世之謎，在此解開！" },
    ];
};

interface BlockArgs extends PropsWithChildren {
    className?: string;
}
const Block = (configs: BlockArgs) => <div
    className={classFormat([
        "bg-gray-200 rounded-xl p-5 w-full",
        configs.className
    ])}>
    {configs.children}
</div>;

export default function AboutPage() {
    return <div className="p-5">
        <div className="m-4 lg:m-8">
            <h1 className="text-4xl font-black my-5">Hi 👋! 我是 Muisnow</h1>

            <div className="flex gap-5 flex-col">
                <div className="flex flex-col sm:grid gap-5 grid-cols-3 grid-rows-2">
                    <Block className="grid place-content-center lg:row-span-2">
                        <img src="https://media.sz.muisnow.dev/7262e5c0-ddbc-4984-a462-efd49cc6fbdc.webp" alt="Muisnow" className="rounded-xl" />
                    </Block>

                    <Block className="col-span-2">
                        <h2 className="text-2xl font-bold"><GradText>@Muisnow</GradText></h2>
                        <p className="text-lg">一個貌似對現實不感興趣，渴望探索未知的人。</p>

                        <p>
                            目前，我運行著許多計畫，如 Umira Projects 的 <Link to={"https://ndhures.cc"}><GradText>「東華資源庫」</GradText></Link>與隸屬於 SanZi Network 底下 The NAP Platform 的 <Link to="https://nap.tw"><GradText>「小睡一下短連結服務」</GradText></Link>。
                            其中，我也是個人計畫 <GradText>Muisnow Devs</GradText> 的開發者與維護者，此網站即是 <GradText>Muisnow Devs</GradText>。
                        </p>
                    </Block>

                    <Block className="!p-12 col-span-3 lg:col-span-2">
                        <div className="text-4xl mb-5 text-gray-400"><FaQuoteLeft /></div>
                        <p className="text-2xl">
                            所謂的人生，只不過就是個有限的探索，既然無法知曉其結局，那就當作是一場豪賭吧！
                        </p>
                        <p className="text-2xl mt-5 text-right">—— Muisnow</p>
                    </Block>
                </div>
                <Block>
                    <h2 className="text-2xl font-bold mb-5">學歷</h2>
                    <p>
                        雖然直接帶入主題，似乎就顯得與其他人一樣沒有特殊的地方了。
                        對於我個人而言，幾乎可以確定的事情就是我幾乎是天生的反骨，不願與他人走著相同的路。
                        所以，讓我們玩個小遊戲，在這個遊戲之中我的學歷是一個謎，怎麼可能直接告訴你呢？
                    </p>

                    <p>
                        所以，讓我們來猜測吧？
                    </p>

                    <p>
                        首先，來個開胃菜，我入學大學的時候我還是個<Hilights>十八歲</Hilights>的新出茅蘆的無知者，<Hilights>甚至我的十八歲的歷程都尚未滿足4個月</Hilights>，<Hilights>那時正好是 2024 年</Hilights>。
                        再來，我曾就讀於一所台灣花蓮內的高中，它亦有一個神奇的名稱，叫做<Hilights>「花蓮第一高級中學」</Hilights>當然這只是我們給它的暱稱而已。
                        到了大學，我可以確認的是我的數學與英文考爆了，但我還是依舊進入了大學，但<Hilights>我依舊在花蓮</Hilights>。
                    </p>

                    <p>
                        我完全可以說，我是一個堂堂正正的花蓮人。
                    </p>
                </Block>
            </div>
        </div>
    </div>
}
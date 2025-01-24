import Typewriter from "typewriter-effect";
import { GradText, IconLink, IconLinkArgs, LinkButton } from "@/components/text";
import { FaBook, FaCoffee, FaGithub, FaTwitter, FaUser, FaYoutube } from "react-icons/fa";
import { FaThreads } from "react-icons/fa6";

const ProfileIconLink = (configs: IconLinkArgs) => <div className="last:mr-0 after:content-['•'] last:after:content-none after:px-3 after:inline-block">
    <IconLink {...configs} className="inline-block" />
</div>

export default function Home() {
    return <div className="flex flex-col items-center">
        <div>
            <span className="text-2xl">這裡是</span>
            <div className="font-black tracking-[1rem] text-[5rem] break-all">
                <Typewriter
                    options={{
                        strings: ['Muisnow', '凝雪桑默', 'むいすのう'],
                        autoStart: true,
                        loop: true,
                    }}
                />
            </div>
        </div>
        <div className="mt-8 flex gap-2 lg:gap-5 lg:items-center flex-col lg:flex-row">
            {/* TODO: Make an about me page */}
            <LinkButton to={"/article"} icon={FaBook} className="bg-[#6f47ff] text-white">你所不知道的物語</LinkButton>
            <div className="text-xl text-gray-400 hidden lg:block">|</div>
            <LinkButton to={"/about"} icon={FaUser}>蒼海之中，你發現了我</LinkButton>
        </div>
        <div className="text-[#707070] font-bold">
            <h3 className="my-5 text-xl"><GradText>@Muisnow</GradText> at</h3>
            <div style={{
                textAlign: "center",
                display: "flex",
                justifyContent: "center",
                flexWrap: "wrap"
            }}>
                <ProfileIconLink name="X (Twitter)" color="blue" icon={FaTwitter} link="https://twitter.com/Hen000000hen" />
                <ProfileIconLink name="YouTube" color="red" icon={FaYoutube} link="https://www.youtube.com/@muisnow" />
                <ProfileIconLink name="GitHub" icon={FaGithub} link="https://github.com/000hen" />
                <ProfileIconLink name="Threads" icon={FaThreads} link="https://www.threads.net/@chenkuiheng" />
                <ProfileIconLink name="Buy Me a Coffee" color="yellow" icon={FaCoffee} link="hhttps://buymeacoffee.com/muisnow" />
            </div>
        </div>
    </div>
}
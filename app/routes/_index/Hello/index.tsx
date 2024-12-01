import Typewriter from "typewriter-effect";
import { GradText, IconLink } from "@/components/text";
import { Link } from "@remix-run/react";
import { FaBook, FaGithub, FaTwitter, FaYoutube } from "react-icons/fa";
import { FaThreads } from "react-icons/fa6";

export default function Home() {
    return <div className="flex flex-col items-center">
        <div>
            <span className="text-2xl">這裡是</span>
            <div className="font-black tracking-[1rem] text-[5rem]">
                <Typewriter
                    options={{
                        strings: ['Muisnow', '凝雪桑默', 'むいすのう'],
                        autoStart: true,
                        loop: true,
                    }}
                />
            </div>
        </div>
        <div className="actions">
            {/* TODO: Make an about me page */}
            {/* <Link to={"/about"}><FontAwesomeIcon icon={faUser} /> 應該是關於我吧</Link> */}
            <Link to={"/article"} className="special"><FaBook /> 看看我都寫些什麼八</Link>
        </div>
        <div className="text-[#707070] font-bold">
            <h3 className="mb-10 text-xl"><GradText>@Muisnow</GradText> at</h3>
            <div style={{
                textAlign: "center",
                display: "flex",
                justifyContent: "center",
                flexWrap: "wrap"
            }}>
                <IconLink color="blue" icon={FaTwitter} link="https://twitter.com/Hen000000hen" />
                <IconLink color="red" icon={FaYoutube} link="https://www.youtube.com/@muisnow" />
                <IconLink icon={FaGithub} link="https://github.com/000hen" />
                <IconLink icon={FaThreads} link="https://www.threads.net/@chenkuiheng" />
            </div>
        </div>
    </div>
}
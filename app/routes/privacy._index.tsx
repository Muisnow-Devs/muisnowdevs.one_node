import { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
    return [
        { title: "隱私權政策 - Muisnow Devs" },
        {
            name: "description",
            content: "Muisnow Devs 的隱私權政策",
        },
    ];
};

export default function PrivacyIndex() {
    return <div className="min-h-screen w-full grid place-items-center p-12">
        <div className="max-w-7xl prose prose-lg">
            <h1>Muisnow Devs 隱私權政策</h1>
            <p>歡迎使用 Muisnow Devs 的服務。我們重視您的隱私，並致力於保護您的個人資訊。本隱私權政策說明我們如何收集、使用及保護您提供的資訊。</p>

            <h2>壹、定義</h2>
            <p>本隱私權政策中所使用的名詞定義如下：</p>
            <ul>
                <li>「Muisnow Devs」指的是 Muisnow Devs 網站及其服務。</li>
                <li>「我們」、「我們的」指的是 Muisnow Devs。</li>
                <li>「您」、「您的」指的是使用或是註冊帳號於 Muisnow Devs 的使用者。</li>
            </ul>

            <h2>貳、資料的蒐集</h2>
            <p>我們會蒐集您提供給我們的資料，包括但不限於：</p>
            <ul>
                <li>您的姓名</li>
                <li>您的電子郵件地址</li>
                <li>您的帳號資訊</li>
                <li>您的 IP 位址</li>
                <li>應用程式的錯誤日誌</li>
            </ul>

            <h2>參、資料的使用</h2>
            <p>我們僅在以下情況下使用您提供的資訊：</p>
            <ul>
                <li>提供和改善我們的服務</li>
                <li>回應您的查詢或要求</li>
                <li>處理錯誤報告以提升您的使用體驗</li>
                <li>遵守法律義務</li>
            </ul>

            <h2>肆、資料的分享</h2>
            <p>除非取得您的明確同意，我們不會與第三方分享您的個人資訊。所有資訊的分享都將遵循您的授權。除非以下情況：</p>
            <ul>
                <li>遵守法律法規</li>
                <li>司法機關要求</li>
            </ul>

            <h2>伍、資訊的安全</h2>
            <p>我們將採取適當的技術措施來保護您的個人資訊，但無法保證絕對的安全性。我們將盡力保護您的資訊，但無法保證絕對的安全性。</p>

            <h2>陸、使用者權利</h2>
            <p>您有權要求查詢、更正、刪除您的個人資訊。若您有任何疑問或是需要協助，請聯絡我們。</p>

            <h2>柒、隱私權政策的變更</h2>
            <p>我們保留修改本隱私權政策的權利。任何變更將在本頁面上公告。請定期查閱以了解最新資訊。</p>

            <h2>捌、聯絡我們</h2>
            <p>若您有任何問題或疑慮，請透過以下方式聯絡我們：</p>
            <ul>
                <li>電子郵件： <a href="mailto:me@muisnowdevs.one">me@muisnowdevs.one</a></li>
            </ul>

            <h2>玖、生效日期</h2>
            <p>本隱私權政策自 2025 年 3 月 1 日生效。</p>
        </div>
    </div>;
}
import { classFormat } from "@/utils";
import { useEffect, useState } from "react";

export interface QuoteEffectArgs {
    text: string;
}
export const QuoteEffect = (configs: QuoteEffectArgs) => {
    const [isEffect, setEffect] = useState(false);
    const texts = configs.text.split(/(?=[。，！？])/g);

    useEffect(() => {
        const timer = setTimeout(() => setEffect(true), 200);
        return () => clearTimeout(timer);
    }, []);

    return <>
        <span className={classFormat([
            "transition-all duration-300 ease-in",
            isEffect
                ? "translate-y-0 opacity-100"
                : "translate-y-3 opacity-0"
        ])}>{texts[0]}</span>

        {isEffect && texts.length > 1 && <QuoteEffect text={texts.slice(1).join("")} />}
    </>;
}
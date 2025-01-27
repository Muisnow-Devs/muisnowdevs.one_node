import { classFormat } from "@/utils";
import { PropsWithChildren } from "react";

interface BottomActionProps extends PropsWithChildren {
    className?: string;
}

export default function BottomAction(config: BottomActionProps) {
    return <div className={classFormat(["mt-5 flex gap-2 flex-col-reverse sm:flex-row justify-between", config.className])}>
        {config.children}
    </div>
}
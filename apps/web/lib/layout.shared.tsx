import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { gitConfig } from "./shared";
import Image from "next/image";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // JSX supported
      title: (
        <>
          <span className="flex items-center justify-center space-x-2">
            <Image src={"/blockend-logo.png"} alt="blockend" width={20} height={20} />
            <p className="font-bold dark:text-white text-black">Blockend</p>
          </span>
        </>
      ),
      transparentMode: "top"
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`
  };
}

import React from "react";
import { Tv, ExternalLink } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="pt-8 pb-12 border-t border-stone-200 flex flex-col sm:flex-row justify-between items-center font-mono-code text-[11px] text-ink-subtle gap-3">
      <div className="flex items-center gap-2">
        <span>TOY 官方三榜 AUDIT</span>
        <span className="text-stone-400">·</span>
        <a
          href="https://space.bilibili.com/3546747185924773"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-bilibili hover:text-sky-800 hover:underline"
        >
          <Tv className="w-3 h-3" />
          <span>B站 UP主: Token就是词元 (UID: 3546747185924773)</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
      <div>基于 toy 官方挑战榜、考核榜与赛事积分榜实时同步</div>
    </footer>
  );
};


import { Fragment, type ReactNode } from "react";
/** Only the finance overview handoff is linkified; arbitrary model HTML/URLs remain text. */
export function AssistantMessageText({text}:{text:string}) {
 const pattern=/\[([^\]\n]{1,120})\]\((\/\?finance=[A-Za-z0-9%._~-]+)\)|(\/\?finance=[A-Za-z0-9%._~-]+)/g;
 const parts:ReactNode[]=[];let offset=0;
 for(const match of text.matchAll(pattern)){
  const start=match.index!,href=match[2]??match[3];
  if(!match[2]&&start>0&&!/[\s(]/.test(text[start-1]))continue;
  let id:string;try{id=decodeURIComponent(href.slice("/?finance=".length));}catch{continue;}
  if(!id||id.length>100)continue;
  parts.push(text.slice(offset,start),<a key={start} href={`/?finance=${encodeURIComponent(id)}`} className="underline underline-offset-2">{match[1]??"Open account for CSV export"}</a>);
  offset=start+match[0].length;
 }
 parts.push(text.slice(offset));
 return <>{parts.map((part,index)=><Fragment key={index}>{part}</Fragment>)}</>;
}

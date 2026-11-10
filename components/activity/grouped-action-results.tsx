"use client";
import type { Preview, Proposal } from "@/lib/assistant/model";
import { ActionResult } from "./action-result";

/** Identity comes from server metadata, never a matching display title. */
export function groupActionPreviews(previews: Preview[], proposal?: Proposal) {
  const groups = new Map<string, Preview[]>();
  previews.forEach((preview, index) => {
    const operation = proposal && !proposal.finance && !proposal.notifications && proposal.operations.length === previews.length ? proposal.operations[index] : undefined;
    const key = preview.entity ? `${preview.entity.kind}:${preview.entity.id}`
      : preview.expenseId && !preview.transfer ? `expense:${preview.expenseId}`
      : preview.activityId && !preview.expense && !preview.transfer && (preview.plan || preview.lines[0]?.startsWith("Create activity")) ? `activity:${preview.activityId}`
      : operation && !preview.expense && !preview.transfer && (operation.kind === "group" || (operation.command as {type?:string}|undefined)?.type !== "expenseCommand" && (operation.command as {type?:string}|undefined)?.type !== "expense") ? `${operation.kind}:${operation.id}`
      : `legacy:${index}`;
    const existing = groups.get(key);
    if (existing) existing.push(preview); else groups.set(key, [preview]);
  });
  return [...groups.entries()];
}
export function GroupedActionResults({previews,proposal,review=false,saved=false}:{previews:Preview[];proposal?:Proposal;review?:boolean;saved?:boolean}) {
  return <>{groupActionPreviews(previews,proposal).map(([key,items])=>{
    const final=items.at(-1)!;
    if (items.length === 1 && !final.expense && final.lines[0]?.startsWith("Create ") && final.activityId &&
      previews.some(other => (other.expense || other.plan) && other.activityId === final.activityId))
      return <p key={key} className="sf-chat-card-context">New activity · {final.title}</p>;
    if(items.length===1&&!final.group)return <ActionResult key={key} preview={final} review={review} saved={saved}/>;
    const group=final.group;
    const deliveryQueued=group?.people.some(person=>person.status==="invited") && items.some(item=>item.group?.delivery==="queued_on_confirm");
    const actionLabels=[...new Set(items.map(item=>item.lines[0]).filter(Boolean))];
    const showsInvitations=group?.people.some(person=>person.status==="invited") && actionLabels.some(label=>/^(Create group|Invite people)/.test(label));
    const consequences=[...new Set(items.flatMap(item=>item.lines.filter(line=>/^(Remove access:|Add access:|Rename group:)/.test(line))))];
    return <section key={key} className="sf-grouped-money-card" aria-label={group?.name??final.title}>
      <h3>{group?.name??final.title}</h3>
      {group ? <>
        <p className="sf-result-meta">{actionLabels.join(" · ")}</p>
        <dl className="sf-group-review-people">{group.people.map(person=><div key={person.email}><dt>{person.name}<small>{person.email}</small></dt><dd>{person.status==="joined"?"Joined":"Invited"}</dd></div>)}</dl>
        {consequences.map(line=><p className="sf-result-item" key={line}>{line}</p>)}
        {showsInvitations && <p className="sf-result-meta">{!deliveryQueued?"Email delivery on hold · Share invitation links":saved?"Invitation delivery queued":"Invitations queued after confirmation"}</p>}
      </> : items.map((item,index)=><div className="sf-grouped-money-action" key={index}><ActionResult preview={item} review={review} saved={saved} embedded/></div>)}
      <details className="sf-grouped-money-details"><summary>Details</summary>{items.map((item,index)=><div key={index} className="sf-review-history-step"><h4>{previews.indexOf(item)+1}. {item.lines[0]??item.title}</h4><ul>{item.lines.slice(1).map((line,lineIndex)=><li key={lineIndex}>{line}</li>)}</ul></div>)}</details>
    </section>;
  })}</>;
}

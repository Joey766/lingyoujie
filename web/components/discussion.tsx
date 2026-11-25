import Link from "next/link";
import { changeComment, comment, report } from "@/app/actions/community";
import { reasons, type Comment } from "@/lib/community";
import { Time } from "./ui";

export function ReportForm({post,target,member}: {post:string;target?:string;member:boolean}) {
  if (!member) return <Link className="quiet-link" href={"/login?next="+encodeURIComponent("/p/"+post+(target?"#c-"+target:""))}>登录后举报</Link>;
  return <details className="report">
    <summary>{target?"举报评论":"举报帖子"}</summary>
    <form className="stack" action={report}>
      <input type="hidden" name="post" value={post}/>{target?<input type="hidden" name="target" value={target}/>:null}
      <label className="field"><span>举报原因</span><select name="reason" aria-label="举报原因" defaultValue="" required><option value="" disabled>选择原因</option>
        {Object.entries(reasons).map(([value,text])=><option key={value} value={value}>{text}</option>)}
      </select></label>
      <button className="btn">提交举报</button>
    </form>
  </details>;
}

export function CommentForm({post,parent,identity}: {post:string;parent?:string;identity:boolean|null}) {
  return <form className="stack" action={comment}>
    <input type="hidden" name="post" value={post}/>{parent?<input type="hidden" name="parent" value={parent}/>:null}
    <label className="field"><span>{parent?"回复内容":"参与讨论"}</span><textarea name="body" maxLength={800} placeholder={parent?"说说你的回应":"你怎么看？"} required/></label>
    {identity===null?<><label className="check"><input type="checkbox" name="anonymous"/>匿名{parent?"回复":"评论"}</label>
      <p className="muted">首次选择适用于本帖内的后续评论。匿名编号仅在本帖使用。</p></>:<p className="muted">本帖内使用{identity?"匿名身份":"公开昵称"}参与讨论。</p>}
    <div><button className="btn primary">{parent?"发送回复":"发表评论"}</button></div>
  </form>;
}

export function CommentItem({item,replyTo,member,identity}: {item:Comment;replyTo?:Comment;member:boolean;identity:boolean|null}) {
  return <article className="comment" id={"c-"+item.id}>
    <div className="meta"><strong>{item.author}</strong>{item.is_op?<span>楼主</span>:null}<Time value={item.created_at} example={item.author==="另有解编辑部"}/>{item.edited_at?<span>已编辑</span>:null}</div>
    {replyTo?<Link className="muted" href={"#c-"+replyTo.id}>回复 {replyTo.author}</Link>:null}
    <p className={item.body===null?"muted":"prose"}>{item.body ?? "这条评论已不可用。"}</p>
    {item.body!==null?<div className="comment-actions stack">
      {member?<details><summary>回复</summary><CommentForm post={item.post_id} parent={item.id} identity={identity}/></details>:<Link className="quiet-link" href={"/login?next="+encodeURIComponent("/p/"+item.post_id+"#c-"+item.id)}>登录后回复</Link>}
      {item.owned?<details><summary>编辑或删除</summary><form action={changeComment} className="stack">
        <input type="hidden" name="post" value={item.post_id}/><input type="hidden" name="target" value={item.id}/>
        <label className="field"><span>修改评论</span><textarea name="body" required maxLength={800} defaultValue={item.body}/></label>
        <div className="actions"><button className="btn" name="decision" value="edit">保存评论</button><button className="btn danger" name="decision" value="delete" formNoValidate>删除评论</button></div>
      </form></details>:<ReportForm post={item.post_id} target={item.id} member={member}/>}
    </div>:null}
  </article>;
}

export function Threads({items,member,identity}: {items:Comment[];member:boolean;identity:boolean|null}) {
  const byId=new Map(items.map(item=>[item.id,item]));
  const replies=new Map<string,Comment[]>();
  const roots: Comment[]=[];
  for (const item of items) {
    if (!item.root_id || !byId.has(item.root_id)) {
      roots.push(item);
      continue;
    }
    const children=replies.get(item.root_id);
    if (children) children.push(item);
    else replies.set(item.root_id,[item]);
  }
  return <div>{roots.map(root=><div key={root.id}><CommentItem item={root} member={member} identity={identity}/>
    {replies.get(root.id)?.length?<div className="nested">
      {replies.get(root.id)!.map(item=><CommentItem key={item.id} item={item} member={member} identity={identity} replyTo={byId.get(item.reply_to??"")}/>)}
    </div>:null}
  </div>)}</div>;
}

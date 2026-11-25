import Link from "next/link";
import { editPost, publish } from "@/app/actions/community";
import { kinds, type Post, type Topic } from "@/lib/community";
import { Status } from "./ui";

export function Compose({categories,selected,post,status}: {categories:Topic[];selected?:string;post?:Post;status?:string}) {
  return <section className="reading"><div className="panel stack">
    <h1>{post?"编辑帖子":"发布帖子"}</h1>
    <Status value={status}/>
    <form action={post?editPost:publish} className="stack compose">
      {post?<input type="hidden" name="post" value={post.id}/>:null}
      <div className="form-grid">
        <label className="field"><span>主题</span><select name="topic" aria-label="主题" defaultValue={post?.topic??selected??""} required>
          <option value="" disabled>选择主题</option>
          {categories.map(t=><option key={t.slug} value={t.slug}>{t.name}</option>)}
        </select></label>
        <label className="field"><span>帖子类型</span><select name="kind" aria-label="帖子类型" defaultValue={post?.kind??"story"}>
          {Object.entries(kinds).map(([key,text])=><option key={key} value={key}>{text}</option>)}
        </select></label>
      </div>
      <label className="field"><span>标题</span><input name="title" required maxLength={68} defaultValue={post?.title}/></label>
      <label className="field"><span>正文</span><textarea name="body" required maxLength={4000} defaultValue={post?.body} placeholder="有什么想聊的？"/></label>
      {post?<p className="muted">公开显示身份为{post.anonymous?"匿名":"个人昵称"}。</p>:<>
        <label className="check"><input type="checkbox" name="anonymous" aria-describedby="post-anon-hint"/>匿名发布</label>
        <p className="muted" id="post-anon-hint">公开页面将显示「匿名楼主」。发布后保留本帖的身份选择。</p>
      </>}
      <div className="actions"><button className="btn primary">{post?"保存修改":"发布帖子"}</button><Link className="quiet-link" href={post?"/p/"+post.id:"/"}>取消</Link></div>
    </form>
  </div></section>;
}

import { request } from './_http'

export type DmPolicy='everyone'|'following'
export type DmProfile={id:string;handle:string;displayName:string;avatarUrl:string|null;avatarSeed:string;kind:'member'|'persona'|'official'}
export type DmThread={id:string;otherProfile:DmProfile;lastMessage:{id:string;senderProfileId:string;preview:string}|null;unreadCount:number;updatedAt:string;muted:boolean;archived:boolean}
/** A photo or a file sent in a message (2026-10-31). `url` is an API path that resolves once the object is clean. */
export type DmAttachment={mediaId:string;kind:'image'|'file';url:string;name:string|null}
export type DmMessage={id:string;threadId:string;senderProfileId:string;body:string;createdAt:string;deletedAt:string|null;attachment?:DmAttachment|null}
export type DmProfileSettings={displayName:string;handle:string;dmPolicy:DmPolicy;bio?:string;location?:{city:string;countryCode:string;source:'device'}}
const base='/v1/community/dm'
/** Features whose API is not live yet. The screens hide their entry points until the matching server release; flip each to true then. */
export const DM_SERVER_FEATURES={attachments:false,unsend:false}
export const dmThreads=(cursor?:string)=>request<{items:DmThread[];nextCursor:string|null}>(`${base}/threads${cursor?`?cursor=${encodeURIComponent(cursor)}`:''}`)
export const dmOpenThread=(handle:string)=>request<{id:string}>(`${base}/threads`,{method:'POST',body:JSON.stringify({handle})})
export const dmMessages=(id:string,before?:string,limit=30)=>request<{items:DmMessage[];nextBefore:string|null}>(`${base}/threads/${encodeURIComponent(id)}/messages?limit=${limit}${before?`&before=${encodeURIComponent(before)}`:''}`)
/** Reuse the same UUID v4 clientId when retrying a send. A different body/thread requires a new clientId. A photo or file
 *  goes with `attachment` (uploaded first by dmUploadAttachment); its body may be empty then. */
export const dmSend=(id:string,body:string,clientId:string,attachment?:{mediaId:string;kind:'image'|'file'})=>request<DmMessage&{duplicate:boolean}>(`${base}/threads/${encodeURIComponent(id)}/messages`,{method:'POST',body:JSON.stringify(attachment?{body,clientId,attachment}:{body,clientId})})
/** Upload a photo or a file for a message. The server checks the type and size, and the malware scan, before it can be sent. */
export const dmUploadAttachment=(file:File)=>{
  const form=new FormData()
  form.append('file',file,file.name)
  return request<DmAttachment>(`${base}/attachments`,{method:'POST',body:form,loading:'silent',timeoutMs:90_000})
}
/** Unsend: only your own message, and both sides stop seeing it (the server sets deleted_at). */
export const dmDeleteMessage=(id:string,messageId:string)=>request<{id:string;deletedAt:string}>(`${base}/threads/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`,{method:'DELETE'})
export const dmRead=(id:string,messageId:string)=>request<{unreadCount:number}>(`${base}/threads/${encodeURIComponent(id)}/read`,{method:'POST',body:JSON.stringify({messageId})})
export const dmUnreadCount=()=>request<{count:number}>(`${base}/unread-count`)
export const dmThreadSettings=(id:string,settings:{muted?:boolean;archived?:boolean})=>request<{muted:boolean;archived:boolean}>(`${base}/threads/${encodeURIComponent(id)}/settings`,{method:'PUT',body:JSON.stringify(settings)})
export const dmBlock=(handle:string)=>request<{blocked:boolean}>(`${base}/blocks/${encodeURIComponent(handle)}`,{method:'POST'})
export const dmUnblock=(handle:string)=>request<{blocked:boolean}>(`${base}/blocks/${encodeURIComponent(handle)}`,{method:'DELETE'})
/** Existing profile update: send the current handleBase, display name and the new preference together. */
export const dmProfileSettings=(settings:DmProfileSettings)=>request<DmProfile&{dmPolicy:DmPolicy;handleBase:string;identityConfigured:boolean}>('/v1/community/me',{method:'PUT',body:JSON.stringify(settings)})
export const dmReport=(messageId:string,reason:string)=>request<{id:string;state:'open';createdAt:string}>('/v1/community/reports',{method:'POST',body:JSON.stringify({targetType:'dm_message',targetId:messageId,reason})})

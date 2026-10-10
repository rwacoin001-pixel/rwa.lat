const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function transferRecipientFromCode(input:string,origin:string):string|null {
  const text=input.trim()
  if(UUID.test(text))return text.toLowerCase()
  try{const url=new URL(text);if(!['https:','http:'].includes(url.protocol)||![new URL(origin).host,'a-reit.com','www.a-reit.com'].includes(url.host)||url.pathname!=='/assets/cash/transfer')return null;const ids=url.searchParams.getAll('to');return ids.length===1&&UUID.test(ids[0])?ids[0].toLowerCase():null}catch{return null}
}

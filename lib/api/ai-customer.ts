import { request } from './_http'
import type { components } from './ai-chat-schema'

export type AccountScope = 'balances'|'positions'|'orders'|'qualification'
export type Citation = { id:string;revision:number;title:string;locale:string;sourceId:string }
export type AiQuestion = components['schemas']['AiQuestionResponseDto']
export type MandateContent = {
  allowedProductIds:string[]; positions:Array<{positionId:string;quantityAtomic:string}>;
  cashBudgetAtomic:string;cashReserveAtomic:string;maxManagedValueAtomic:string;maxActionAtomic:string;maxDailyTurnoverAtomic:string;maxTotalTurnoverAtomic:string;
  riskBand:'conservative'|'balanced'|'growth'|'aggressive';maxProductWeightBps:number;maxUnrealizedLossBps:number;horizonDays:number;maxLockDays:number;
  maxFeeBps:number;maxFeeAtomic:string;allowBuy:boolean;allowRedeem:boolean;reinvestProceeds:boolean;scheduleIntervalMinutes:number;minTradeIntervalMinutes:number;rebalanceThresholdBps:number;
  effectiveAt:string;expiresAt:string;goals:string;locale:string;notifications:string[];
}
export type MandateState = {mandate:null|{id:string;revision:number;status:string;content:MandateContent;managedCashAtomic:string};termsVersion:string;executionEnabled:boolean;currency:string;decimals:number}
export type Run = {id:string;state:string;failureCode?:string;result?:{explanation:string};createdAt:string}
export type ExecutionLeg={productName:string;kind:'buy'|'redeem';state:string;notionalAtomic:string;actualAmountAtomic:string|null}
const body = (value:unknown,method='POST'): RequestInit => ({method,headers:{'content-type':'application/json'},body:JSON.stringify(value)})
export const aiCustomer = {
  status:()=>request<{provider:string;configured:boolean}>('/v1/ai/status'),
  choices:()=>request<{products:Array<{id:string;name:string}>;positions:Array<{id:string;productId:string;name:string;decimals:number;quantityAtomic:string}>}>('/v1/ai/investment/choices'),
  chat:(message:string,locale:string,sessionId?:string,accountScopes:AccountScope[]=[])=>request<components['schemas']['AiChatResponseDto']>('/v1/ai/chat',body({message,locale,sessionId,accountScopes})),
  source:(citation:Citation)=>request<{title:string;body:string}>(`/v1/ai/knowledge/${citation.id}/versions/${citation.revision}`),
  draftTicket:(subject:string,text:string)=>request<{id:string;content:{subject:string;body:string};expiresAt:string}>('/v1/ai/ticket-drafts',body({subject,body:text,category:'support'})),
  confirmTicket:(id:string)=>request<{ticketId:string;reference:string;state:string}>(`/v1/ai/ticket-drafts/${id}/confirm`,body({confirmed:true})),
  mandate:()=>request<MandateState>('/v1/ai/investment/mandate'),
  saveMandate:(content:MandateContent,expectedRevision:number,termsVersion:string)=>request('/v1/ai/investment/mandate',body({...content,expectedRevision,termsVersion,confirmed:true},'PUT')),
  changeState:(action:'pause'|'resume'|'revoke',expectedRevision:number)=>request(`/v1/ai/investment/mandate/${action}`,body({expectedRevision,confirmed:true})),
  runs:()=>request<Run[]>('/v1/ai/investment/runs'),
  run:(id:string)=>request<Run&{legs:ExecutionLeg[]}>(`/v1/ai/investment/runs/${id}`),
  evaluate:(expectedRevision:number,idempotencyKey:string)=>request<Run>('/v1/ai/investment/evaluate',body({expectedRevision,idempotencyKey})),
  cancelRun:(id:string)=>request(`/v1/ai/investment/runs/${id}/cancel`,body({})),
}

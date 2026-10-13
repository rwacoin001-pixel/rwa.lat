'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, ShieldCheck, UserPlus } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { cn } from '@/lib/utils';
import { networkLabel } from '@/lib/chains';

/**
 * Withdrawal whitelist (user + network). A whitelisted user's screened withdrawals go straight to the
 * execution queue and are sent from the hot wallet; everyone else stays in manual review. The admin API
 * enforces wallet.withdrawals.manage; this page only drives it.
 */

interface WhitelistEntry {
  id: string;
  userId: string;
  network: string;
  state: 'active' | 'revoked';
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
}

type Candidate = { id: string; email: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Manual custody sends TRON USDT only.
const NETWORK = 'tron';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', cache: 'no-store', ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || `请求失败 (HTTP ${res.status})`);
  return body as T;
}

export default function WithdrawalWhitelistPage() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [showRevoked, setShowRevoked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lookup, setLookup] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [adding, setAdding] = useState<Candidate | null>(null);
  const [note, setNote] = useState('');
  const [revoking, setRevoking] = useState<WhitelistEntry | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ network: NETWORK, limit: '200', ...(showRevoked ? {} : { state: 'active' }) });
      const data = await call<{ entries: WhitelistEntry[] }>(`/api/admin/wallet/withdrawal-whitelist?${params}`);
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (err) {
      setEntries([]);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [showRevoked]);

  useEffect(() => { void load(); }, [load]);

  const findUser = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = lookup.trim();
    setLookupError('');
    setCandidates([]);
    if (!value) return;
    if (UUID.test(value)) { setNote(''); setAdding({ id: value, email: null }); return; }
    setSearching(true);
    try {
      const data = await call<{ users: Array<{ id: string; email: string | null }> }>(`/api/admin/users?${new URLSearchParams({ q: value, limit: '5', offset: '0' })}`);
      const users = (data.users ?? []).map((user) => ({ id: user.id, email: user.email }));
      if (!users.length) setLookupError('没有找到该用户');
      setCandidates(users);
    } catch (err) {
      setLookupError(err instanceof Error ? `${err.message}（无用户查询权限时可直接粘贴用户 ID）` : '查询失败');
    } finally {
      setSearching(false);
    }
  };

  const add = async () => {
    if (!adding) return;
    const trimmed = note.trim();
    await call('/api/admin/wallet/withdrawal-whitelist', {
      method: 'POST',
      body: JSON.stringify({ userId: adding.id, network: NETWORK, ...(trimmed ? { note: trimmed } : {}) }),
    });
    setNotice(`已将 ${adding.email ?? adding.id} 加入提现白名单`);
    setCandidates([]);
    setLookup('');
    await load();
  };

  const revoke = async () => {
    if (!revoking) return;
    const reason = revokeReason.trim();
    await call(`/api/admin/wallet/withdrawal-whitelist/${encodeURIComponent(revoking.id)}/revoke`, {
      method: 'PUT',
      body: JSON.stringify(reason ? { reason } : {}),
    });
    setNotice('已移出白名单，该用户之后的提现将进入人工审核');
    await load();
  };

  const active = entries.filter((entry) => entry.state === 'active').length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-muted-foreground max-w-2xl">
            白名单用户的提现通过检查后自动从热钱包转出；其他用户的提现进入人工审核。仅支持 {networkLabel(NETWORK)} USDT。
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowRevoked((value) => !value)}>{showRevoked ? '只看有效' : '含已移出'}</Button>
            <Button variant="outline" onClick={() => void load()} className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />刷新</Button>
          </div>
        </div>

        {notice && (
          <Card className="glass-strong"><CardContent role="status" className="p-4 text-sm text-mint">{notice}</CardContent></Card>
        )}

        <Card className="glass-strong">
          <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" />加入白名单</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={findUser} className="flex flex-col sm:flex-row gap-3">
              <Input value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="用户邮箱或用户 ID" className="sm:max-w-md" />
              <Button type="submit" disabled={searching || !lookup.trim()} className="flex items-center gap-2"><Search className="w-4 h-4" />{searching ? '查询中…' : '查找'}</Button>
            </form>
            {lookupError && <p className="text-sm text-amber-600">{lookupError}</p>}
            {candidates.length > 0 && (
              <ul className="divide-y divide-ink/[0.07] rounded-input border border-ink/[0.1]">
                {candidates.map((user) => (
                  <li key={user.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span><b>{user.email ?? '（无邮箱）'}</b> <span className="font-mono text-xs text-muted-foreground">{user.id}</span></span>
                    <Button size="sm" onClick={() => { setNote(''); setAdding(user); }}>加入</Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="glass-strong">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" />白名单（有效 {active}）</CardTitle></CardHeader>
          <CardContent className="p-0">
            {error ? (
              <p className="p-6 text-sm text-amber-600">加载失败：{error}</p>
            ) : loading ? (
              <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mint" /></div>
            ) : entries.length === 0 ? (
              <p className="p-10 text-center text-muted-foreground">白名单为空，所有提现都需人工审核</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户 ID</TableHead>
                      <TableHead className="w-24">网络</TableHead>
                      <TableHead className="w-24">状态</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead className="w-40">加入时间</TableHead>
                      <TableHead className="w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-xs">{entry.userId}</TableCell>
                        <TableCell><Badge variant="outline">{networkLabel(entry.network)}</Badge></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(entry.state === 'active' ? 'bg-mint/20 text-mint' : 'bg-gray-500/20 text-slate-500')}>
                            {entry.state === 'active' ? '有效' : '已移出'}
                          </Badge>
                          {entry.revokeReason && <p className="text-xs text-muted-foreground mt-1">{entry.revokeReason}</p>}
                        </TableCell>
                        <TableCell className="text-sm">{entry.note ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(entry.createdAt).toLocaleString('zh-CN')}</TableCell>
                        <TableCell>
                          {entry.state === 'active' && (
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setRevokeReason(''); setRevoking(entry); }}>移出</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={adding !== null}
        onOpenChange={(open) => { if (!open) setAdding(null); }}
        title="加入提现白名单"
        description="加入后，该用户的提现通过检查即自动从热钱包转出，不再经过人工审核。"
        details={adding ? [
          { label: '用户', value: adding.email ?? '（按 ID 添加）' },
          { label: '用户 ID', value: adding.id, mono: true },
          { label: '网络', value: `${networkLabel(NETWORK)} USDT` },
        ] : []}
        typeToConfirm="白名单"
        typeToConfirmLabel="输入「白名单」确认"
        confirmLabel="确认加入"
        onConfirm={add}
      >
        <label className="grid gap-1.5 text-sm">
          <span>备注（可选）</span>
          <Input value={note} maxLength={240} onChange={(event) => setNote(event.target.value)} />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => { if (!open) setRevoking(null); }}
        title="移出提现白名单"
        description="移出后，该用户之后的提现将进入人工审核。"
        details={revoking ? [{ label: '用户 ID', value: revoking.userId, mono: true }, { label: '网络', value: networkLabel(revoking.network) }] : []}
        confirmLabel="确认移出"
        destructive
        onConfirm={revoke}
      >
        <label className="grid gap-1.5 text-sm">
          <span>原因（可选）</span>
          <Input value={revokeReason} maxLength={240} onChange={(event) => setRevokeReason(event.target.value)} />
        </label>
      </ConfirmDialog>
    </AdminLayout>
  );
}

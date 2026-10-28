import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  CreditCard,
  Landmark,
  Plus,
  Receipt,
  Smartphone,
  Star,
  Trash2,
  Wallet as WalletIcon,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, ListSkeleton, Modal, Tabs } from '../components/ui';
import { formatDate, formatGhs, paymentLabel, relativeTime } from '../lib/format';

type Txn = {
  id: string;
  type: string;
  amount_cents: number;
  description: string;
  method: string;
  status: string;
  created_at: string;
};

type Method = { id: string; kind: 'momo' | 'card' | 'cash'; label: string; detail: string; is_default: number };

const TOPUPS = [2000, 5000, 10000, 20000, 50000];

function methodIcon(kind: string) {
  if (kind === 'momo') return <Smartphone size={16} />;
  if (kind === 'card') return <CreditCard size={16} />;
  if (kind === 'bank') return <Landmark size={16} />;
  return <Banknote size={16} />;
}

export default function WalletPage() {
  const { user, patchUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'topup' | 'ride' | 'booking' | 'refund'>('all');
  const [methods, setMethods] = useState<Method[] | null>(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const [amount, setAmount] = useState('50');
  const [topupMethod, setTopupMethod] = useState<'momo' | 'card' | 'bank'>('momo');
  const [busy, setBusy] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [newMethod, setNewMethod] = useState({ kind: 'momo' as Method['kind'], label: '', detail: '' });
  const [deleteMethod, setDeleteMethod] = useState<Method | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [t, m] = await Promise.all([
        api.get<{ transactions: Txn[] }>('/wallet/transactions?limit=120'),
        api.get<{ methods: Method[] }>('/payment-methods'),
      ]);
      setTxns(t.transactions);
      setMethods(m.methods);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load your wallet');
      setTxns([]);
      setMethods([]);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) return null;

  const topUp = async () => {
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents < 500) {
      setError('Top up at least GH₵5.00');
      return;
    }
    setError('');
    setBusy(true);
    const optimistic = user.wallet_cents + cents;
    patchUser({ wallet_cents: optimistic });
    try {
      const res = await api.post<{ user: any }>('/wallet/topup', { amount_cents: cents, method: topupMethod });
      patchUser(res.user);
      setTopupOpen(false);
      toast.success(`${formatGhs(cents)} added to your wallet`);
      load();
    } catch (err) {
      patchUser({ wallet_cents: user.wallet_cents });
      const msg = err instanceof ApiError ? err.message : 'Top-up failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (m: Method) => {
    const prev = methods ?? [];
    setMethods(prev.map((x) => ({ ...x, is_default: x.id === m.id ? 1 : 0 })));
    try {
      await api.patch(`/payment-methods/${m.id}`, { is_default: true });
      toast.success(`${m.label} is now your default`);
    } catch (err) {
      setMethods(prev);
      toast.error(err instanceof ApiError ? err.message : 'Could not update payment method');
    }
  };

  const addMethod = async () => {
    if (!newMethod.label.trim()) {
      toast.error('Give this payment method a name');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ method: Method }>('/payment-methods', newMethod);
      setMethods((prev) => [...(prev ?? []), res.method]);
      setMethodOpen(false);
      setNewMethod({ kind: 'momo', label: '', detail: '' });
      toast.success('Payment method added');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not add payment method');
    } finally {
      setBusy(false);
    }
  };

  const removeMethod = async () => {
    if (!deleteMethod) return;
    const target = deleteMethod;
    const prev = methods ?? [];
    setDeleteMethod(null);
    setMethods(prev.filter((m) => m.id !== target.id));
    try {
      await api.del(`/payment-methods/${target.id}`);
      toast.success('Payment method removed');
    } catch (err) {
      setMethods(prev);
      toast.error(err instanceof ApiError ? err.message : 'Could not remove payment method');
    }
  };

  const filtered = (txns ?? []).filter((t) => (filter === 'all' ? true : t.type === filter));
  const spent = (txns ?? []).filter((t) => t.amount_cents < 0).reduce((s, t) => s + Math.abs(t.amount_cents), 0);
  const added = (txns ?? []).filter((t) => t.amount_cents > 0).reduce((s, t) => s + t.amount_cents, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Wallet</h1>
          <p className="page-sub">Top up with MoMo, pay rides and coaches, get refunds instantly.</p>
        </div>
        <Button onClick={() => setTopupOpen(true)} icon={<Plus size={16} />}>
          Top up wallet
        </Button>
      </div>

      <div className="wallet-top">
        <div
          className="card pad"
          style={{ background: 'linear-gradient(150deg, #0f2a1e 0%, #08150f 70%)', borderColor: '#1d3a2b', color: '#eaf2ea', position: 'relative', overflow: 'hidden' }}
        >
          <div className="reg-noise" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          <div className="row-between" style={{ position: 'relative' }}>
            <span className="row gap-2 tiny" style={{ color: '#c7f464', fontWeight: 800, letterSpacing: '0.12em' }}>
              <WalletIcon size={14} /> REV WALLET BALANCE
            </span>
            <Badge style={{ background: 'rgba(199,244,100,0.14)', color: '#c7f464' }}>
              <CheckCircle2 size={11} /> Secured
            </Badge>
          </div>
          <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.045em', marginTop: 10, color: '#fff', position: 'relative' }}>
            {formatGhs(user.wallet_cents)}
          </div>
          <div className="tiny" style={{ color: '#8ba396' }}>
            {formatGhs(added)} in · {formatGhs(spent)} out · member since {formatDate(user.created_at, { month: 'short', year: 'numeric' })}
          </div>
          <div className="row gap-2 mt-4" style={{ position: 'relative', flexWrap: 'wrap' }}>
            {[2000, 5000, 10000].map((chip) => (
              <button
                key={chip}
                className="chip"
                style={{ background: 'rgba(255,255,255,0.07)', borderColor: '#2a4234', color: '#dbe9df' }}
                onClick={() => {
                  setAmount(String(chip / 100));
                  setTopupOpen(true);
                }}
              >
                + {formatGhs(chip).replace('GH₵', '₵')}
              </button>
            ))}
            <button
              className="chip"
              style={{ background: 'rgba(255,255,255,0.07)', borderColor: '#2a4234', color: '#dbe9df' }}
              onClick={() => setMethodOpen(true)}
            >
              <Plus size={12} /> Payment method
            </button>
          </div>
        </div>

        <Card className="col" style={{ gap: 12 }}>
          <div className="row-between">
            <div className="card-title">Payment methods</div>
            <button className="link small" onClick={() => setMethodOpen(true)}>
              <Plus size={13} style={{ verticalAlign: -2 }} /> Add
            </button>
          </div>
          {methods === null ? (
            <ListSkeleton rows={2} />
          ) : methods.length === 0 ? (
            <EmptyState icon={<CreditCard size={22} />} title="No payment methods" description="Add MoMo or a card to pay faster." action={<Button size="sm" onClick={() => setMethodOpen(true)}>Add method</Button>} />
          ) : (
            <div className="col">
              {methods.map((m) => (
                <div key={m.id} className="row gap-3" style={{ padding: '9px 0', borderBottom: '1px solid var(--line-2)' }}>
                  <span className="row-icon" style={{ width: 34, height: 34 }}>
                    {methodIcon(m.kind)}
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row gap-2">
                      <span style={{ fontWeight: 700, fontSize: 13.5 }} className="truncate">
                        {m.label}
                      </span>
                      {m.is_default ? <Badge tone="green">Default</Badge> : null}
                    </div>
                    <div className="tiny muted">{m.detail || paymentLabel(m.kind)}</div>
                  </div>
                  {!m.is_default ? (
                    <button className="link tiny" onClick={() => makeDefault(m)}>
                      Set default
                    </button>
                  ) : null}
                  <button className="icon-btn danger" style={{ width: 30, height: 30 }} onClick={() => setDeleteMethod(m)} aria-label={`Remove ${m.label}`}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="tiny muted">Wallet payments are instant. Refunds from cancellations land here within seconds.</p>
        </Card>
      </div>

      <Card pad={false}>
        <div style={{ padding: '4px 16px 0' }}>
          <Tabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All activity' },
              { value: 'topup', label: 'Top-ups' },
              { value: 'ride', label: 'Rides' },
              { value: 'booking', label: 'Intercity' },
              { value: 'refund', label: 'Refunds' },
            ]}
          />
        </div>
        <div style={{ padding: '8px 20px 16px' }}>
          {txns === null ? (
            <ListSkeleton rows={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Receipt size={24} />}
              title="Nothing here yet"
              description={filter === 'all' ? 'Top up your wallet or take a ride to start your statement.' : 'No transactions of this type in your history.'}
              action={
                filter === 'all' ? (
                  <Button onClick={() => setTopupOpen(true)} icon={<Plus size={15} />}>
                    Top up wallet
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={() => setFilter('all')}>
                    Show all activity
                  </Button>
                )
              }
            />
          ) : (
            <div className="col">
              {filtered.map((t) => (
                <div key={t.id} className="list-row">
                  <span
                    className="row-icon"
                    style={{ background: t.amount_cents > 0 ? 'var(--green-050)' : '#f5f6f3', color: t.amount_cents > 0 ? 'var(--green-700)' : 'var(--muted)' }}
                  >
                    {t.amount_cents > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }} className="truncate">
                      {t.description}
                    </div>
                    <div className="tiny muted">
                      {formatDate(t.created_at)} · {relativeTime(t.created_at)} · {paymentLabel(t.method)}
                    </div>
                  </div>
                  <div className="right col" style={{ alignItems: 'flex-end' }}>
                    <span style={{ fontWeight: 800, color: t.amount_cents > 0 ? 'var(--green-700)' : 'var(--text)' }}>
                      {t.amount_cents > 0 ? '+' : '−'}
                      {formatGhs(Math.abs(t.amount_cents)).replace('GH₵', '₵')}
                    </span>
                    <span className="tiny muted">{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="card pad-sm mt-3 row gap-3">
        <span className="stat-icon" style={{ background: 'var(--amber-050)', color: '#b45309' }}>
          <Star size={16} />
        </span>
        <div className="grow">
          <div style={{ fontWeight: 700, fontSize: 13 }}>Need a bigger float for a group booking?</div>
          <div className="tiny muted">Top up GH₵200+ once and pay for up to 6 seats in one transaction.</div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => navigate('/app/intercity')}>
          Plan a group trip
        </Button>
      </div>

      <Modal
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        title="Top up wallet"
        sub="Money lands instantly — no waiting for a bank transfer."
        footer={
          <>
            <Button variant="ghost" onClick={() => setTopupOpen(false)}>
              Cancel
            </Button>
            <Button onClick={topUp} loading={busy}>
              Add {formatGhs(Math.round((Number(amount) || 0) * 100))}
            </Button>
          </>
        }
      >
        <div className="col gap-4">
          <div className="chips">
            {TOPUPS.map((t) => (
              <button key={t} className={`chip ${Number(amount) * 100 === t ? 'active' : ''}`} onClick={() => setAmount(String(t / 100))}>
                {formatGhs(t).replace('GH₵', '₵')}
              </button>
            ))}
          </div>
          <Field label="Amount (GH₵)" hint="Minimum GH₵5.00">
            <Input type="number" min={5} step={5} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Pay with">
            <div className="col gap-2">
              {(['momo', 'card', 'bank'] as const).map((m) => (
                <button
                  key={m}
                  className={`tier ${topupMethod === m ? 'active' : ''}`}
                  onClick={() => setTopupMethod(m)}
                  type="button"
                  style={{ padding: '11px 13px' }}
                >
                  <span className="tier-emoji" style={{ width: 36, height: 36, fontSize: 15 }}>
                    {methodIcon(m)}
                  </span>
                  <div className="grow">
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{m === 'momo' ? 'Mobile Money' : m === 'card' ? 'Debit / credit card' : 'Bank transfer'}</div>
                    <div className="tiny muted">{m === 'momo' ? 'MTN, Telecel, AirtelTigo' : m === 'card' ? 'Visa or Mastercard' : 'GCB, Ecobank, Absa'}</div>
                  </div>
                  {topupMethod === m ? <CheckCircle2 size={17} color="var(--green)" /> : null}
                </button>
              ))}
            </div>
          </Field>
          {error ? <div className="notice red">{error}</div> : null}
        </div>
      </Modal>

      <Modal
        open={methodOpen}
        onClose={() => setMethodOpen(false)}
        title="Add payment method"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMethodOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addMethod} loading={busy}>
              Save method
            </Button>
          </>
        }
      >
        <div className="col gap-4">
          <Field label="Type">
            <div className="chips">
              {(['momo', 'card', 'cash'] as const).map((k) => (
                <button key={k} className={`chip ${newMethod.kind === k ? 'active' : ''}`} onClick={() => setNewMethod({ ...newMethod, kind: k })}>
                  {methodIcon(k)} {paymentLabel(k)}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Label">
            <Input value={newMethod.label} onChange={(e) => setNewMethod({ ...newMethod, label: e.target.value })} placeholder={newMethod.kind === 'momo' ? 'MTN Mobile Money' : newMethod.kind === 'card' ? 'Visa' : 'Cash'} />
          </Field>
          <Field label="Detail (optional)" hint="Last digits, network or a note.">
            <Input value={newMethod.detail} onChange={(e) => setNewMethod({ ...newMethod, detail: e.target.value })} placeholder="024 •••• 1190" maxLength={60} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteMethod)}
        onClose={() => setDeleteMethod(null)}
        onConfirm={removeMethod}
        danger
        title={`Remove ${deleteMethod?.label ?? 'method'}?`}
        confirmLabel="Remove method"
        body="You can add it again any time. Pending payments are not affected."
      />
    </div>
  );
}

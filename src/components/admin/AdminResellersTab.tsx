import React, { useState } from 'react';
import { 
  Store, 
  Plus, 
  ExternalLink,
  Trash2, 
  Edit3, 
  Check, 
  AlertCircle, 
  Search, 
  PlusCircle, 
  MinusCircle,
  Copy,
  Key,
  RefreshCw,
  DollarSign,
  Database,
  Wallet
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Reseller } from '../../types';
import { isUserLive } from '../../lib/userStats';
import { calculateResellerExpiry, getOrCreateResellerApiKey } from '../../lib/resellerUtils';

interface AdminResellersTabProps {
  onOpenResellerPortal: (reseller: Reseller) => void;
}

const SUPABASE_RESELLER_PAYMENT_AND_30D_SQL = `-- 1) Add Reseller Payment Tracking Columns to public.resellers
ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS per_user_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_currency text DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS pending_payment numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_payment numeric DEFAULT 0;

-- 2) Ensure created_at & validity columns exist on public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "created_at TIMESTAMPTZ" timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS plan_started_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz DEFAULT (now() + interval '30 days'),
  ADD COLUMN IF NOT EXISTS plan_days_left integer DEFAULT 30;

-- 3) Helper to safely parse timestamps from text or timestamptz columns
CREATE OR REPLACE FUNCTION public.safe_to_timestamptz(val text, fallback timestamptz DEFAULT now())
RETURNS timestamptz AS $$
DECLARE
  s text;
BEGIN
  IF val IS NULL THEN
    RETURN fallback;
  END IF;
  s := trim(val);
  IF s = '' OR lower(s) = 'null' OR lower(s) = 'undefined' THEN
    RETURN fallback;
  END IF;
  RETURN s::timestamptz;
EXCEPTION WHEN OTHERS THEN
  RETURN fallback;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4) Enforce Strict 30-Day Max Expiry from created_at on public.users
CREATE OR REPLACE FUNCTION public.enforce_user_max_30d_expiry()
RETURNS trigger AS $$
DECLARE
  base_created timestamptz;
  curr_expiry timestamptz;
  max_expiry timestamptz;
  max_days integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    base_created := public.safe_to_timestamptz(
      COALESCE(
        OLD."created_at TIMESTAMPTZ"::text,
        OLD.created_at::text,
        OLD.plan_started_at::text,
        NEW."created_at TIMESTAMPTZ"::text,
        NEW.created_at::text,
        NEW.plan_started_at::text
      ),
      now()
    );
  ELSE
    base_created := public.safe_to_timestamptz(
      COALESCE(
        NEW."created_at TIMESTAMPTZ"::text,
        NEW.created_at::text,
        NEW.plan_started_at::text
      ),
      now()
    );
  END IF;

  NEW.created_at := base_created;
  NEW."created_at TIMESTAMPTZ" := base_created;
  max_expiry := base_created + interval '30 days';

  curr_expiry := public.safe_to_timestamptz(NEW.plan_expires_at::text, max_expiry);
  IF curr_expiry > max_expiry THEN
    curr_expiry := max_expiry;
  END IF;

  NEW.plan_expires_at := curr_expiry;

  max_days := GREATEST(0, LEAST(30, CEIL(EXTRACT(EPOCH FROM (curr_expiry - now())) / 86400.0)::integer));
  IF NEW.plan_days_left IS NULL OR NEW.plan_days_left > max_days THEN
    NEW.plan_days_left := max_days;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_user_max_30d_expiry ON public.users;
CREATE TRIGGER trg_enforce_user_max_30d_expiry
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_max_30d_expiry();

-- 5) Backfill & clamp all existing users to <= 30 days from creation
UPDATE public.users
SET created_at = COALESCE(created_at, now());`;

export const AdminResellersTab: React.FC<AdminResellersTabProps> = ({ onOpenResellerPortal }) => {
  const { resellers, createReseller, updateReseller, deleteReseller, users } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [paymentModalReseller, setPaymentModalReseller] = useState<Reseller | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [resellerToDelete, setResellerToDelete] = useState<Reseller | null>(null);
  const [apiKeyModalReseller, setApiKeyModalReseller] = useState<Reseller | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const getResellerUsers = (reseller: Reseller) => {
    const cleanResellerId = reseller.id.replace(/[^a-zA-Z0-9]/g, '');
    const portalLower = (reseller.portalName || '').trim().toLowerCase();
    return users.filter(u => {
      if (!u.resellerId && !u.resellerName) return false;
      if (u.resellerId === reseller.id) return true;
      if (u.resellerId && cleanResellerId && u.resellerId.replace(/[^a-zA-Z0-9]/g, '') === cleanResellerId) return true;
      if (u.resellerName && portalLower && u.resellerName.trim().toLowerCase() === portalLower) return true;
      return false;
    });
  };

  const getResellerBilling = (reseller: Reseller, assignedCount: number) => {
    const rate = Number(reseller.perUserRate ?? 0);
    const currency: 'INR' | 'USD' = reseller.rateCurrency === 'USD' ? 'USD' : 'INR';
    const symbol = currency === 'USD' ? '$' : '₹';
    const paid = Number(reseller.paidPayment ?? 0);
    const autoPending = Math.max(0, assignedCount * rate - paid);
    const pending = reseller.pendingPayment !== undefined && reseller.pendingPayment !== null && rate === 0
      ? Number(reseller.pendingPayment)
      : autoPending;
    return { rate, currency, symbol, paid, pending, totalBill: assignedCount * rate };
  };

  const handleGenerateApiKey = (reseller: Reseller) => {
    const cleanId = reseller.id.replace(/[^a-zA-Z0-9]/g, '');
    const rand = Math.random().toString(36).substring(2, 9);
    const newKey = `flw_res_${cleanId}_${rand}`;
    updateReseller(reseller.id, { apiKey: newKey });
    setApiKeyModalReseller(prev => prev && prev.id === reseller.id ? { ...prev, apiKey: newKey } : prev);
    setEditingReseller(prev => prev && prev.id === reseller.id ? { ...prev, apiKey: newKey } : prev);
    showToast(`Generated new API Key for ${reseller.portalName}!`);
  };

  const handleRevokeApiKey = (reseller: Reseller) => {
    updateReseller(reseller.id, { apiKey: '' });
    setApiKeyModalReseller(prev => prev && prev.id === reseller.id ? { ...prev, apiKey: '' } : prev);
    setEditingReseller(prev => prev && prev.id === reseller.id ? { ...prev, apiKey: '' } : prev);
    showToast(`Revoked API Key for ${reseller.portalName}. External API access blocked.`);
  };

  // Form states for Add Reseller
  const [portalName, setPortalName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(`flow${Math.floor(100000 + Math.random() * 900000)}`);
  const [userLimit, setUserLimit] = useState(20);
  const [daysLeft, setDaysLeft] = useState(30);
  const [perUserRate, setPerUserRate] = useState(0);
  const [rateCurrency, setRateCurrency] = useState<'INR' | 'USD'>('INR');
  const [paidPayment, setPaidPayment] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const filteredResellers = resellers.filter(r =>
    r.portalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await createReseller({
        portalName,
        email,
        password,
        userLimit,
        daysLeft,
        notes,
        perUserRate,
        rateCurrency,
        paidPayment,
        pendingPayment: 0,
      });

      if (!res.success) {
        setError(res.error || 'Failed to create reseller');
      } else {
        setShowAddModal(false);
        setPortalName('');
        setEmail('');
        setPassword(`flow${Math.floor(100000 + Math.random() * 900000)}`);
        setUserLimit(20);
        setDaysLeft(30);
        setPerUserRate(0);
        setRateCurrency('INR');
        setPaidPayment(0);
        setNotes('');
      }
    } catch {
      setError('Connection error while creating reseller.');
    }
  };

  const handleAdjustDays = (reseller: Reseller, delta: number) => {
    const newDays = Math.max(0, reseller.daysLeft + delta);
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + newDays);
    const formattedExp = `${String(expDate.getDate()).padStart(2, '0')}/${String(expDate.getMonth() + 1).padStart(2, '0')}/${expDate.getFullYear()}`;

    updateReseller(reseller.id, {
      daysLeft: newDays,
      expiryDate: formattedExp,
      status: newDays > 0 ? 'active' : 'expired',
    });
  };

  const handleAdjustLimit = (reseller: Reseller, delta: number) => {
    const newLimit = Math.max(1, reseller.userLimit + delta);
    updateReseller(reseller.id, { userLimit: newLimit });
  };

  const handleCopyCredentials = (reseller: Reseller) => {
    const text = `Flow Reseller Portal Access:\nPortal Name: ${reseller.portalName}\nEmail: ${reseller.email}\nPassword: ${reseller.password}\nUser Limit: ${reseller.userLimit}\nValidity: ${reseller.daysLeft} Days (Expires ${reseller.expiryDate})`;
    navigator.clipboard.writeText(text);
    setCopiedId(reseller.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#12131a] border border-neutral-800 rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white">Reseller Management & Payment Tracker</h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Manage reseller limits, enforce strict 30-day max user expiry from creation, and track per-user rates ($/INR), pending &amp; paid payments in Supabase.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowSqlModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#181a24] hover:bg-[#202330] border border-purple-500/30 text-purple-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            title="Copy Supabase SQL for Reseller Payment Columns & 30-Day Cap"
          >
            <Database className="w-3.5 h-3.5 text-purple-400" />
            <span>Supabase SQL Setup</span>
          </button>

          <button
            onClick={() => {
              setPassword(`flow${Math.floor(100000 + Math.random() * 900000)}`);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Reseller</span>
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search resellers by name or email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#12131a] border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="text-xs text-neutral-400">
          Total Resellers: <span className="text-white font-semibold">{resellers.length}</span>
        </div>
      </div>

      {/* Reseller Table */}
      <div className="bg-[#12131a] border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800/80 bg-[#151620] text-neutral-400 uppercase text-[11px] font-semibold tracking-wider">
                <th className="py-3.5 px-5">Reseller Portal</th>
                <th className="py-3.5 px-4">Allocated Users</th>
                <th className="py-3.5 px-4">Payment (Rate / Pending / Paid)</th>
                <th className="py-3.5 px-4">Validity / Expiry</th>
                <th className="py-3.5 px-4">Portal Password</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filteredResellers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    No resellers created yet. Click "+ Add New Reseller" to create one.
                  </td>
                </tr>
              ) : (
                filteredResellers.map(reseller => {
                  const assignedUsers = getResellerUsers(reseller);
                  const assignedCount = assignedUsers.length;
                  const liveInReseller = assignedUsers.filter(u => isUserLive(u)).length;
                  const expiryInfo = calculateResellerExpiry(reseller);
                  const isExpired = expiryInfo.isExpired || reseller.status === 'expired';
                  const billing = getResellerBilling(reseller, assignedCount);

                  return (
                    <tr key={reseller.id} className="hover:bg-[#161824]/60 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-white text-xs flex items-center gap-1.5 flex-wrap">
                          <Store className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span>{reseller.portalName}</span>
                          {liveInReseller > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 font-mono font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              <span>{liveInReseller} LIVE</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                          {reseller.email}
                        </div>
                        {reseller.notes && (
                          <div className="text-[10px] text-neutral-500 italic mt-0.5">
                            "{reseller.notes}"
                          </div>
                        )}
                      </td>

                      {/* User limit & used */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-white text-xs font-semibold">
                            {assignedCount} / {reseller.userLimit}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleAdjustLimit(reseller, -5)}
                              className="p-0.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 cursor-pointer"
                              title="Decrease limit by 5"
                            >
                              <MinusCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleAdjustLimit(reseller, 5)}
                              className="p-0.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 cursor-pointer"
                              title="Increase limit by 5"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="w-24 h-1.5 bg-neutral-800 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full"
                            style={{ width: `${Math.min(100, (assignedCount / reseller.userLimit) * 100)}%` }}
                          />
                        </div>
                      </td>

                      {/* Payment Tracking: Per User Rate, Pending Payment, Paid Payment */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-neutral-400">Rate:</span>
                            <span className="font-mono text-xs font-semibold text-purple-300">
                              {billing.symbol}{billing.rate.toLocaleString()} / user
                            </span>
                            <button
                              onClick={() => setPaymentModalReseller({
                                ...reseller,
                                perUserRate: billing.rate,
                                rateCurrency: billing.currency,
                                paidPayment: billing.paid,
                                pendingPayment: billing.pending,
                              })}
                              className="px-1.5 py-0.5 bg-purple-500/15 hover:bg-purple-500/30 border border-purple-500/30 rounded text-[10px] text-purple-300 font-medium cursor-pointer transition-colors"
                              title="Set Rate, Pending & Paid Payment"
                            >
                              Set / Pay
                            </button>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
                            <span className={`px-1.5 py-0.5 rounded border ${
                              billing.pending > 0
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 font-semibold'
                                : 'bg-neutral-800/60 border-neutral-700/50 text-neutral-400'
                            }`}>
                              Pending: {billing.symbol}{billing.pending.toLocaleString()}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold">
                              Paid: {billing.symbol}{billing.paid.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Validity & Quick Adjust Days */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-xs font-semibold ${isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                            {expiryInfo.timeRemainingText}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleAdjustDays(reseller, -5)}
                              className="p-0.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 cursor-pointer"
                              title="Subtract 5 days"
                            >
                              <MinusCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleAdjustDays(reseller, 10)}
                              className="p-0.5 text-emerald-400 hover:text-emerald-300 rounded hover:bg-neutral-800 cursor-pointer"
                              title="Add 10 days"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono mt-1 flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-neutral-500">Start:</span>
                            <span>{reseller.createdAt ? new Date(reseller.createdAt).toLocaleDateString('en-GB') : 'Today'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-neutral-500">Exp:</span>
                            <span className={isExpired ? 'text-red-400 font-semibold' : 'text-neutral-300'}>{expiryInfo.expiryDate}</span>
                          </div>
                        </div>
                      </td>

                      {/* Password */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-xs text-neutral-300 bg-[#0b0c0f] px-2 py-1 rounded border border-neutral-800 inline-block select-all">
                          {reseller.password}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isExpired
                              ? 'bg-red-500/10 border-red-500/30 text-red-400'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          }`}
                        >
                          {isExpired ? 'Expired' : 'Active'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Open Reseller Portal */}
                          <button
                            onClick={() => onOpenResellerPortal(reseller)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-lg text-[11px] text-purple-300 hover:text-white transition-colors cursor-pointer"
                            title="Open Reseller Portal"
                          >
                            <ExternalLink className="w-3 h-3 text-purple-400" />
                            <span>Open Portal</span>
                          </button>

                          {/* Payment Tracker Modal */}
                          <button
                            onClick={() => setPaymentModalReseller({
                              ...reseller,
                              perUserRate: billing.rate,
                              rateCurrency: billing.currency,
                              paidPayment: billing.paid,
                              pendingPayment: billing.pending,
                            })}
                            className="p-1.5 bg-emerald-950/30 hover:bg-emerald-900/50 border border-emerald-500/30 rounded-lg text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                            title="Track Reseller Payment (Rate / Pending / Paid)"
                          >
                            <Wallet className="w-3.5 h-3.5" />
                          </button>

                          {/* Copy Access */}
                          <button
                            onClick={() => handleCopyCredentials(reseller)}
                            className="p-1.5 bg-[#1a1b26] hover:bg-[#232535] border border-neutral-700/60 rounded-lg text-neutral-300 hover:text-white transition-colors cursor-pointer"
                            title="Copy credentials"
                          >
                            {copiedId === reseller.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-neutral-400" />}
                          </button>

                          {/* Manage API Key (Admin Only) */}
                          <button
                            onClick={() => setApiKeyModalReseller(reseller)}
                            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                              reseller.apiKey 
                                ? 'bg-purple-950/40 hover:bg-purple-900/60 border-purple-500/40 text-purple-300 hover:text-white' 
                                : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-500 hover:text-neutral-300'
                            }`}
                            title={reseller.apiKey ? "Admin Only: View / Regenerate API Key" : "Admin Only: Generate API Key"}
                          >
                            <Key className="w-3.5 h-3.5 text-purple-400" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => setEditingReseller({
                              ...reseller,
                              perUserRate: billing.rate,
                              rateCurrency: billing.currency,
                              paidPayment: billing.paid,
                              pendingPayment: billing.pending,
                            })}
                            className="p-1.5 bg-[#1a1b26] hover:bg-[#232535] border border-neutral-700/60 rounded-lg text-neutral-300 hover:text-white transition-colors cursor-pointer"
                            title="Edit reseller"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-neutral-400" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setResellerToDelete(reseller)}
                            className="p-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-500/30 rounded-lg text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                            title="Delete reseller"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Reseller Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#12131a] border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 bg-[#161722]">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-semibold text-white">Create Reseller Portal</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Reseller Portal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sachin Portal 5"
                  value={portalName}
                  onChange={e => setPortalName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Reseller Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="sachin.portal5@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Portal Password</label>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Max Users Allowed</label>
                  <input
                    type="number"
                    min="1"
                    value={userLimit}
                    onChange={e => setUserLimit(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Portal Validity (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={daysLeft}
                    onChange={e => setDaysLeft(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Per User Rate & Currency */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-[#0d0e14] border border-neutral-800/90 rounded-xl">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">Currency</label>
                  <select
                    value={rateCurrency}
                    onChange={e => setRateCurrency(e.target.value === 'USD' ? 'USD' : 'INR')}
                    className="w-full px-2.5 py-2 bg-[#0b0c0f] border border-neutral-800 rounded-lg text-white text-xs focus:outline-none focus:border-purple-500"
                  >
                    <option value="INR">₹ INR</option>
                    <option value="USD">$ USD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">Per User Rate</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={perUserRate}
                    onChange={e => setPerUserRate(Number(e.target.value))}
                    className="w-full px-2.5 py-2 bg-[#0b0c0f] border border-neutral-800 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">Advance Paid</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={paidPayment}
                    onChange={e => setPaidPayment(Number(e.target.value))}
                    className="w-full px-2.5 py-2 bg-[#0b0c0f] border border-neutral-800 rounded-lg text-emerald-400 text-xs font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Internal Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. VIP Partner - WhatsApp group"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800/80">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Create Reseller
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reseller Payment Tracking Modal */}
      {paymentModalReseller && (() => {
        const assignedCount = getResellerUsers(paymentModalReseller).length;
        const rate = Number(paymentModalReseller.perUserRate ?? 0);
        const currency: 'INR' | 'USD' = paymentModalReseller.rateCurrency === 'USD' ? 'USD' : 'INR';
        const symbol = currency === 'USD' ? '$' : '₹';
        const paid = Number(paymentModalReseller.paidPayment ?? 0);
        const totalBill = assignedCount * rate;
        const calculatedPending = Math.max(0, totalBill - paid);
        const pendingVal = Number(paymentModalReseller.pendingPayment ?? calculatedPending);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#12131a] border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 bg-[#161722]">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Reseller Payment Tracker</h3>
                    <p className="text-[11px] text-neutral-400">{paymentModalReseller.portalName} • {assignedCount} Active Users</p>
                  </div>
                </div>
                <button
                  onClick={() => setPaymentModalReseller(null)}
                  className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={e => {
                  e.preventDefault();
                  updateReseller(paymentModalReseller.id, {
                    perUserRate: rate,
                    rateCurrency: currency,
                    paidPayment: paid,
                    pendingPayment: pendingVal,
                  });
                  setPaymentModalReseller(null);
                  showToast(`Saved payment details for ${paymentModalReseller.portalName} to Supabase!`);
                }}
                className="p-6 space-y-4"
              >
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-2.5 bg-[#0b0c10] p-3 rounded-xl border border-neutral-800 text-center">
                  <div>
                    <div className="text-[10px] text-neutral-400 uppercase">Total Users Bill</div>
                    <div className="text-sm font-mono font-bold text-white mt-0.5">
                      {symbol}{totalBill.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-neutral-500">{assignedCount} × {symbol}{rate}</div>
                  </div>
                  <div className="border-x border-neutral-800/80 px-2">
                    <div className="text-[10px] text-amber-400 uppercase font-semibold">Pending Payment</div>
                    <div className="text-sm font-mono font-bold text-amber-300 mt-0.5">
                      {symbol}{pendingVal.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-neutral-500">Due from Reseller</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-400 uppercase font-semibold">Paid Payment</div>
                    <div className="text-sm font-mono font-bold text-emerald-300 mt-0.5">
                      {symbol}{paid.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-neutral-500">Received</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">Currency ($ / INR)</label>
                    <select
                      value={currency}
                      onChange={e => {
                        const nextCurr = e.target.value === 'USD' ? 'USD' : 'INR';
                        setPaymentModalReseller({ ...paymentModalReseller, rateCurrency: nextCurr });
                      }}
                      className="w-full px-3 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-purple-500"
                    >
                      <option value="INR">₹ INR (Indian Rupee)</option>
                      <option value="USD">$ USD (US Dollar)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">Per User Rate ({symbol})</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={rate}
                      onChange={e => {
                        const newRate = Number(e.target.value);
                        const nextPending = Math.max(0, assignedCount * newRate - paid);
                        setPaymentModalReseller({
                          ...paymentModalReseller,
                          perUserRate: newRate,
                          pendingPayment: nextPending,
                        });
                      }}
                      className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-emerald-300 mb-1">Paid Payment of Total Users ({symbol})</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={paid}
                      onChange={e => {
                        const newPaid = Number(e.target.value);
                        const nextPending = Math.max(0, assignedCount * rate - newPaid);
                        setPaymentModalReseller({
                          ...paymentModalReseller,
                          paidPayment: newPaid,
                          pendingPayment: nextPending,
                        });
                      }}
                      className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-emerald-500/40 rounded-xl text-emerald-300 font-mono text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-amber-300 mb-1">Total Pending Payment ({symbol})</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={pendingVal}
                      onChange={e => {
                        setPaymentModalReseller({
                          ...paymentModalReseller,
                          pendingPayment: Number(e.target.value),
                        });
                      }}
                      className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-amber-500/40 rounded-xl text-amber-300 font-mono text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const fullAmount = assignedCount * rate;
                      setPaymentModalReseller({
                        ...paymentModalReseller,
                        paidPayment: fullAmount,
                        pendingPayment: 0,
                      });
                    }}
                    className="text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold cursor-pointer transition-colors"
                  >
                    ✓ Mark All {assignedCount} Users Paid ({symbol}{totalBill.toLocaleString()})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentModalReseller({
                        ...paymentModalReseller,
                        pendingPayment: Math.max(0, assignedCount * rate - paid),
                      });
                    }}
                    className="text-[11px] text-purple-400 hover:text-purple-300 underline cursor-pointer"
                  >
                    Auto-Recalculate Pending
                  </button>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800/80">
                  <button
                    type="button"
                    onClick={() => setPaymentModalReseller(null)}
                    className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    Save Payment to Supabase
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Supabase SQL Setup Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#12131a] border border-neutral-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 bg-[#161722]">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Supabase SQL — Reseller Payment Columns &amp; 30-Day Max Expiry</h3>
                  <p className="text-[11px] text-neutral-400">Run this once in your Supabase SQL Editor</p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <pre className="p-4 bg-[#090a0f] border border-neutral-800 rounded-xl text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-80 leading-relaxed select-all">
                {SUPABASE_RESELLER_PAYMENT_AND_30D_SQL}
              </pre>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(SUPABASE_RESELLER_PAYMENT_AND_30D_SQL);
                    showToast('Copied SQL to clipboard! Paste & Run in Supabase SQL Editor.');
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy SQL Query</span>
                </button>
                <button
                  onClick={() => setShowSqlModal(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Reseller Modal */}
      {editingReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#12131a] border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 bg-[#161722]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-semibold text-white">Edit Reseller</h3>
              </div>
              <button
                onClick={() => setEditingReseller(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                updateReseller(editingReseller.id, {
                  portalName: editingReseller.portalName,
                  password: editingReseller.password,
                  userLimit: editingReseller.userLimit,
                  daysLeft: editingReseller.daysLeft,
                  notes: editingReseller.notes,
                  perUserRate: Number(editingReseller.perUserRate ?? 0),
                  rateCurrency: editingReseller.rateCurrency === 'USD' ? 'USD' : 'INR',
                  paidPayment: Number(editingReseller.paidPayment ?? 0),
                  pendingPayment: Number(editingReseller.pendingPayment ?? 0),
                });
                setEditingReseller(null);
              }}
              className="p-6 space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Portal Name</label>
                <input
                  type="text"
                  required
                  value={editingReseller.portalName}
                  onChange={e => setEditingReseller({ ...editingReseller, portalName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Password</label>
                <input
                  type="text"
                  required
                  value={editingReseller.password}
                  onChange={e => setEditingReseller({ ...editingReseller, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Max Users</label>
                  <input
                    type="number"
                    min="1"
                    value={editingReseller.userLimit}
                    onChange={e => setEditingReseller({ ...editingReseller, userLimit: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Days Left</label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={editingReseller.daysLeft}
                    onChange={e => setEditingReseller({ ...editingReseller, daysLeft: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Payment Fields inside Edit Modal */}
              <div className="p-3 bg-[#0c0d13] border border-neutral-800 rounded-xl space-y-3">
                <div className="text-[11px] font-semibold text-emerald-400">Payment Tracking (Supabase Synced)</div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Currency</label>
                    <select
                      value={editingReseller.rateCurrency === 'USD' ? 'USD' : 'INR'}
                      onChange={e => setEditingReseller({ ...editingReseller, rateCurrency: e.target.value === 'USD' ? 'USD' : 'INR' })}
                      className="w-full px-2.5 py-2 bg-[#0b0c0f] border border-neutral-800 rounded-lg text-white text-xs"
                    >
                      <option value="INR">₹ INR</option>
                      <option value="USD">$ USD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Per User Rate</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editingReseller.perUserRate ?? 0}
                      onChange={e => {
                        const r = Number(e.target.value);
                        const count = getResellerUsers(editingReseller).length;
                        const paid = Number(editingReseller.paidPayment ?? 0);
                        setEditingReseller({
                          ...editingReseller,
                          perUserRate: r,
                          pendingPayment: Math.max(0, count * r - paid),
                        });
                      }}
                      className="w-full px-2.5 py-2 bg-[#0b0c0f] border border-neutral-800 rounded-lg text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-emerald-400 mb-1">Paid Payment</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editingReseller.paidPayment ?? 0}
                      onChange={e => {
                        const paid = Number(e.target.value);
                        const count = getResellerUsers(editingReseller).length;
                        const r = Number(editingReseller.perUserRate ?? 0);
                        setEditingReseller({
                          ...editingReseller,
                          paidPayment: paid,
                          pendingPayment: Math.max(0, count * r - paid),
                        });
                      }}
                      className="w-full px-2.5 py-2 bg-[#0b0c0f] border border-neutral-800 rounded-lg text-emerald-300 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-amber-400 mb-1">Pending Payment</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editingReseller.pendingPayment ?? 0}
                      onChange={e => setEditingReseller({ ...editingReseller, pendingPayment: Number(e.target.value) })}
                      className="w-full px-2.5 py-2 bg-[#0b0c0f] border border-neutral-800 rounded-lg text-amber-300 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={editingReseller.notes || ''}
                  onChange={e => setEditingReseller({ ...editingReseller, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Admin API Key Generation */}
              <div className="p-3 bg-[#0a0b0e] border border-purple-500/20 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    External API Key (Admin Controlled):
                  </label>
                  {editingReseller.apiKey && (
                    <button
                      type="button"
                      onClick={() => handleRevokeApiKey(editingReseller)}
                      className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                    >
                      Revoke Key
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={editingReseller.apiKey || 'No API key generated yet'}
                    className="w-full px-3 py-1.5 bg-[#12131a] border border-neutral-800 rounded-lg text-neutral-300 font-mono text-xs select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleGenerateApiKey(editingReseller)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{editingReseller.apiKey ? 'Regenerate' : 'Generate Key'}</span>
                  </button>
                </div>
                <p className="text-[10px] text-neutral-500">
                  Only Admins can generate or change this key. Used by external websites/AI Studio to automatically create/revoke users.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800/80">
                <button
                  type="button"
                  onClick={() => setEditingReseller(null)}
                  className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {resellerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#12131a] border border-neutral-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Delete Reseller Portal?</h3>
            <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">{resellerToDelete.portalName}</strong>? This will revoke reseller portal access.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setResellerToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteReseller(resellerToDelete.id);
                  setResellerToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Delete Reseller
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-purple-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-3">
          <Check className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Admin API Key Management Modal */}
      {apiKeyModalReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-text">
          <div className="bg-[#12131a] border border-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Reseller API Key (Admin Only)</h3>
                  <p className="text-[11px] text-neutral-400">{apiKeyModalReseller.portalName} ({apiKeyModalReseller.email})</p>
                </div>
              </div>
              <button
                onClick={() => setApiKeyModalReseller(null)}
                className="text-neutral-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-400 mb-1 font-semibold">Active API Key for External Access:</label>
                {(() => {
                  const activeKey = getOrCreateResellerApiKey(apiKeyModalReseller);
                  return (
                    <div className="flex items-center gap-2 bg-[#090a0e] p-2 rounded-xl border border-neutral-800 font-mono text-xs">
                      <span className="text-purple-300 font-semibold select-all break-all flex-1">
                        {activeKey}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(activeKey);
                          showToast('Copied API Key to clipboard!');
                        }}
                        className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Copy Key"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })()}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => handleGenerateApiKey(apiKeyModalReseller)}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate New Key</span>
                </button>

                {apiKeyModalReseller.apiKey && (
                  <button
                    onClick={() => handleRevokeApiKey(apiKeyModalReseller)}
                    className="px-3.5 py-2 bg-red-950/40 hover:bg-red-950/70 border border-red-500/40 text-red-300 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Revoke Key
                  </button>
                )}
              </div>

              <p className="text-[10px] text-neutral-500 leading-relaxed bg-[#0a0b0e] p-2.5 rounded-lg border border-neutral-900">
                🔒 <strong>Admin Control:</strong> Only Admins can generate or revoke this key. Once generated, the reseller can copy it in their portal and connect their external website (AI Studio, WordPress, etc.).
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setApiKeyModalReseller(null)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


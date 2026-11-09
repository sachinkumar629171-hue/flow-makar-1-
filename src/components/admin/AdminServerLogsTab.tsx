import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Search,
  Server,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  Activity,
  Filter,
  User as UserIcon,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { ServerRequestLog } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config/api';

interface AdminServerLogsTabProps {
  showToast: (msg: string) => void;
}

export const AdminServerLogsTab: React.FC<AdminServerLogsTabProps> = ({ showToast }) => {
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState<ServerRequestLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [serverFilter, setServerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'granted' | 'denied'>('all');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  const getAdminToken = useCallback(() => {
    return (
      currentUser?.sessionToken ||
      localStorage.getItem('flowmaker_session_token') ||
      ''
    );
  }, [currentUser?.sessionToken]);

  const fetchServerLogs = useCallback(
    async (manual = false) => {
      if (manual) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const token = getAdminToken();
        const res = await fetch(apiUrl('/api/admin/data'), {
          method: 'GET',
          headers: {
            ...(token
              ? {
                  'x-session-token': token,
                  'x-admin-session-id': token,
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.serverRequestLogs)) {
            setLogs(data.serverRequestLogs.slice(0, 200));
            setLastRefreshedAt(new Date().toLocaleTimeString());
            if (manual) {
              showToast(`Refreshed! Loaded latest ${data.serverRequestLogs.slice(0, 200).length} user server request logs.`);
            }
          }
        } else if (manual) {
          showToast('Could not fetch logs from server.');
        }
      } catch {
        if (manual) {
          showToast('Network error while refreshing server logs.');
        }
      } finally {
        setIsLoading(false);
        setTimeout(() => setIsRefreshing(false), 350);
      }
    },
    [getAdminToken, showToast]
  );

  useEffect(() => {
    fetchServerLogs(false);
  }, [fetchServerLogs]);

  const handleClearLogs = async () => {
    setIsClearing(true);
    try {
      const token = getAdminToken();
      const res = await fetch(apiUrl('/api/admin/data'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token
            ? {
                'x-session-token': token,
                'x-admin-session-id': token,
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },
        body: JSON.stringify({ action: 'clear_server_logs', sessionId: token }),
      });
      if (res.ok) {
        setLogs([]);
        showToast('All user server request logs cleared!');
      } else {
        showToast('Failed to clear server logs.');
      }
    } catch {
      showToast('Error clearing server logs.');
    } finally {
      setIsClearing(false);
    }
  };

  const formatExactDateTime = (iso: string) => {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const formatRelativeTime = (iso: string) => {
    if (!iso) return '';
    const diffMs = Date.now() - new Date(iso).getTime();
    if (isNaN(diffMs)) return '';
    const sec = Math.max(0, Math.floor(diffMs / 1000));
    if (sec < 10) return 'Just now';
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ${min % 60}m ago`;
    const days = Math.floor(hr / 24);
    return `${days}d ago`;
  };

  const filteredLogs = logs.filter(log => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (log.email || '').toLowerCase().includes(q) ||
      (log.name || '').toLowerCase().includes(q) ||
      (log.serverRequested || '').toLowerCase().includes(q) ||
      (log.dataType || '').toLowerCase().includes(q) ||
      (log.reason || '').toLowerCase().includes(q);

    const matchesServer =
      serverFilter === 'all' ||
      (log.serverRequested || '').toLowerCase().includes(serverFilter.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || log.status === statusFilter;

    return matchesSearch && matchesServer && matchesStatus;
  });

  const grantedCount = logs.filter(l => l.status === 'granted').length;
  const deniedCount = logs.filter(l => l.status === 'denied').length;
  const uniqueUsersCount = new Set(logs.map(l => (l.email || '').toLowerCase()).filter(Boolean)).size;

  const getServerBadgeColor = (srv: string) => {
    const s = (srv || '').toLowerCase();
    if (s.includes('1')) return 'bg-purple-950/90 text-purple-300 border-purple-700/70';
    if (s.includes('2')) return 'bg-cyan-950/90 text-cyan-300 border-cyan-700/70';
    if (s.includes('3')) return 'bg-emerald-950/90 text-emerald-300 border-emerald-700/70';
    if (s.includes('4')) return 'bg-amber-950/90 text-amber-300 border-amber-700/70';
    if (s.includes('5')) return 'bg-pink-950/90 text-pink-300 border-pink-700/70';
    return 'bg-indigo-950/90 text-indigo-300 border-indigo-700/70';
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Refresh Controls */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#121318] border border-neutral-800/90 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold font-display text-white">
                User Server Request Logs
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800/60">
                LATEST {logs.length} / 200
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Track kaun sa user kis time pe kaun sa server (Server 1–5) aur service ka data request kar raha hai
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center">
          {lastRefreshedAt && (
            <span className="text-[11px] text-neutral-400 hidden md:inline font-mono">
              Synced: {lastRefreshedAt}
            </span>
          )}

          <button
            onClick={() => fetchServerLogs(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Logs'}</span>
          </button>

          {logs.length > 0 && (
            <button
              onClick={handleClearLogs}
              disabled={isClearing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-800/60 text-xs font-semibold transition-all cursor-pointer"
              title="Clear all recorded logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isClearing ? 'Clearing...' : 'Clear'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-[#121318] border border-neutral-800/90">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span>Recent Requests</span>
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-display text-white mt-1.5">
            {logs.length} <span className="text-xs font-normal text-neutral-500">/ 200 max</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#121318] border border-emerald-900/40">
          <div className="flex items-center justify-between text-emerald-300 text-xs">
            <span>Server Data Delivered</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-display text-emerald-400 mt-1.5">
            {grantedCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#121318] border border-rose-900/40">
          <div className="flex items-center justify-between text-rose-300 text-xs">
            <span>Blocked / Denied</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-display text-rose-400 mt-1.5">
            {deniedCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#121318] border border-cyan-900/40">
          <div className="flex items-center justify-between text-cyan-300 text-xs">
            <span>Unique Users in Logs</span>
            <UserIcon className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-display text-cyan-300 mt-1.5">
            {uniqueUsersCount}
          </div>
        </div>
      </div>

      {/* Search & Server Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-[#121318] p-3.5 rounded-2xl border border-neutral-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search user email, name, Server 1..5, ChatGPT, Flow..."
            className="w-full pl-9 pr-4 py-2 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <span className="text-xs text-neutral-400 flex items-center gap-1 mr-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Server:
          </span>
          {['all', 'Server 1', 'Server 2', 'Server 3', 'Server 4', 'Server 5'].map(srv => (
            <button
              key={srv}
              onClick={() => setServerFilter(srv)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                serverFilter === srv
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              {srv === 'all' ? 'All Servers' : srv}
            </button>
          ))}

          <div className="h-4 w-[1px] bg-neutral-800 mx-1 shrink-0" />

          {(['all', 'granted', 'denied'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all shrink-0 cursor-pointer ${
                statusFilter === st
                  ? 'bg-cyan-600 text-white'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[#121318] rounded-2xl border border-neutral-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-[#0d0e13] text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                <th className="py-3.5 px-4 w-12">#</th>
                <th className="py-3.5 px-4">Time (Kis Time Aaya)</th>
                <th className="py-3.5 px-4">User (Kaun Aaya)</th>
                <th className="py-3.5 px-4">Requested Server</th>
                <th className="py-3.5 px-4">Service / DataType</th>
                <th className="py-3.5 px-4 text-right">Access Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-400" />
                    Loading latest user server logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    <Server className="w-7 h-7 mx-auto mb-2 text-neutral-600" />
                    <div className="font-semibold text-neutral-300">No server request logs found</div>
                    <div className="text-[11px] text-neutral-500 mt-1">
                      Jab bhi koi user extension se Server 1–5 ka data request karega, wo yahan real-time dikhega.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, index) => (
                  <tr
                    key={log.id || `${log.email}-${log.timestamp}-${index}`}
                    className="hover:bg-neutral-900/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-[11px] text-neutral-500">
                      {index + 1}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-white font-medium">
                        <Clock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span>{formatExactDateTime(log.timestamp)}</span>
                      </div>
                      <div className="text-[10.5px] text-emerald-400 font-mono mt-0.5 pl-5">
                        {formatRelativeTime(log.timestamp)}
                      </div>
                    </td>

                    {/* User Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">
                          {log.name || 'User'}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase ${
                            log.plan === 'ultra' || log.plan === 'unlimited'
                              ? 'bg-purple-950 text-purple-300 border border-purple-700/60'
                              : 'bg-blue-950 text-blue-300 border border-blue-800/60'
                          }`}
                        >
                          {log.plan || 'basic'}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                        {log.email}
                      </div>
                    </td>

                    {/* Requested Server */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${getServerBadgeColor(
                          log.serverRequested
                        )}`}
                      >
                        <Server className="w-3.5 h-3.5" />
                        <span>{log.serverRequested || 'Server 1'}</span>
                      </span>
                    </td>

                    {/* DataType / Service */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-700/80 text-neutral-200 text-xs font-medium">
                        <Layers className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{log.dataType || 'Flow ultra lower priority'}</span>
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {log.status === 'granted' ? (
                        <div className="inline-flex flex-col items-end">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/90 text-emerald-300 border border-emerald-700/70 text-[11px] font-bold">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Data Sent</span>
                          </span>
                          {log.reason && (
                            <span className="text-[10px] text-neutral-500 mt-0.5">
                              {log.reason}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-end">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/90 text-rose-300 border border-rose-700/70 text-[11px] font-bold">
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            <span>Blocked</span>
                          </span>
                          {log.reason && (
                            <span className="text-[10px] text-rose-400/80 mt-0.5">
                              {log.reason}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

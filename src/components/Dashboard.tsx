"use client";

import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { UploadCloud, PieChart as PieChartIcon, BarChart as BarChartIcon, User, Users, Calendar, TrendingUp, AlertCircle, Clock, LayoutDashboard, Lightbulb, RefreshCw } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
  AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

type Transaction = {
  Date: string;
  Description: string;
  Category: string;
  Cost: number;
  Currency: string;
  Group?: string;
  users: Record<string, number>;
};

// Apple inspired colors
const COLORS = ['#0A84FF', '#BF5AF2', '#FF2D55', '#FF9F0A', '#32D74B', '#FF375F', '#5E5CE6', '#64D2FF'];
const DAY_COLORS = ['#FF9F0A', '#FF375F', '#BF5AF2', '#5E5CE6', '#0A84FF', '#32D74B', '#FF2D55'];

export default function Dashboard() {
  const [data, setData] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'overview' | 'insights'>('overview');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleApiSync = async () => {
    const token = window.prompt("Paste your Splitwise Web Session Cookie or Bearer Token:\n(You can find this in your Browser Developer Tools under Network -> Request Headers)");
    if (!token) return;

    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      
      const result = await res.json();
      if (!res.ok) {
        alert("Failed to sync: " + result.error);
        return;
      }
      
      setUsers(result.users);
      if (result.groups) setGroups(result.groups);
      setData(result.data.sort((a: any, b: any) => new Date(a.Date).getTime() - new Date(b.Date).getTime()));
    } catch (err: any) {
      alert("Error connecting to API: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rawData = results.data as Record<string, string>[];
        if (rawData.length === 0) return;

        const headers = Object.keys(rawData[0]);
        const userList = headers.slice(5).filter(h => h && h.trim() !== '');

        const parsedData: Transaction[] = [];
        for (const row of rawData) {
          if (row.Date && row.Date.trim() !== '' && row.Description !== 'Total balance') {
            const cost = parseFloat(row.Cost || '0');
            const userAmounts: Record<string, number> = {};
            for (const u of userList) {
              userAmounts[u] = parseFloat(row[u] || '0');
            }
            parsedData.push({
              Date: row.Date,
              Description: row.Description,
              Category: row.Category,
              Cost: cost,
              Currency: row.Currency,
              users: userAmounts
            });
          }
        }

        setUsers(userList);
        setGroups([]); // CSVs usually don't have multiple groups identified easily
        setSelectedGroup('All');
        setData(parsedData.sort((a,b) => new Date(a.Date).getTime() - new Date(b.Date).getTime()));
      }
    });
  };

  const getUserShare = (d: Transaction, user: string) => {
    if (user === 'All') return d.Cost;
    const amt = d.users[user] || 0;
    if (amt < 0) return Math.abs(amt);
    if (amt > 0) return Math.max(0, d.Cost - amt);
    return 0;
  };

  const months = useMemo(() => {
    const m = new Set<string>();
    data.forEach(d => {
      const monthStr = d.Date.substring(0, 7);
      if (monthStr) m.add(monthStr);
    });
    return Array.from(m).sort();
  }, [data]);

  const dynamicUsers = useMemo(() => {
    const userSet = new Set<string>();
    data.forEach(d => {
      if (selectedGroup === 'All' || d.Group === selectedGroup) {
        Object.keys(d.users).forEach(u => {
          if (d.users[u] !== 0) userSet.add(u);
        });
      }
    });
    return Array.from(userSet).sort();
  }, [data, selectedGroup]);

  // Reset selectedUser if they are not in the new dynamicUsers list
  React.useEffect(() => {
    if (selectedUser !== 'All' && !dynamicUsers.includes(selectedUser)) {
      setSelectedUser('All');
    }
  }, [dynamicUsers, selectedUser]);

  const filteredData = useMemo(() => {
    return data.filter(d => {
      const monthMatch = selectedMonth === 'All' || d.Date.startsWith(selectedMonth);
      let userMatch = true;
      if (selectedUser !== 'All') {
        userMatch = d.users[selectedUser] !== 0; 
      }
      const groupMatch = selectedGroup === 'All' || d.Group === selectedGroup;
      const isNotPayment = d.Category !== 'Payment';
      return monthMatch && userMatch && groupMatch && isNotPayment;
    });
  }, [data, selectedMonth, selectedUser, selectedGroup]);

  // 1. Category Data
  const categoryData = useMemo(() => {
    const catMap: Record<string, number> = {};
    filteredData.forEach(d => {
      const share = getUserShare(d, selectedUser);
      if (share > 0) catMap[d.Category] = (catMap[d.Category] || 0) + share;
    });
    return Object.keys(catMap).map(k => ({ name: k, value: catMap[k] })).sort((a,b) => b.value - a.value);
  }, [filteredData, selectedUser]);

  // 2. Monthly Trend Data
  const monthlyTrendData = useMemo(() => {
    const monthMap: Record<string, number> = {};
    data.filter(d => d.Category !== 'Payment').forEach(d => {
      const m = d.Date.substring(0, 7);
      const share = getUserShare(d, selectedUser);
      if (share > 0 || selectedUser === 'All') monthMap[m] = (monthMap[m] || 0) + share;
    });
    return Object.keys(monthMap).sort().map(k => ({ name: k, Total: monthMap[k] }));
  }, [data, selectedUser]);
  
  // 3. Cumulative Data
  const dailyCumulativeData = useMemo(() => {
      let cumulative = 0;
      return filteredData.map(d => {
          cumulative += getUserShare(d, selectedUser);
          return { name: d.Date, Total: cumulative };
      });
  }, [filteredData, selectedUser]);

  // 4. User Balances
  const userBalances = useMemo(() => {
    const monthData = data.filter(d => selectedMonth === 'All' || d.Date.startsWith(selectedMonth));
    return users.map(u => {
      let net = 0;
      monthData.forEach(d => { net += (d.users[u] || 0); });
      return { name: u.split(' ')[0], NetBalance: net };
    });
  }, [data, users, selectedMonth]);

  // 5. Day of Week Analysis
  const dayOfWeekData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const totals = [0, 0, 0, 0, 0, 0, 0];
    
    filteredData.forEach(d => {
        const dateObj = new Date(d.Date);
        if (!isNaN(dateObj.getTime())) {
            const dayIdx = dateObj.getDay();
            counts[dayIdx] += 1;
            totals[dayIdx] += getUserShare(d, selectedUser);
        }
    });
    
    return days.map((d, i) => ({
        day: d,
        Count: counts[i],
        Total: totals[i]
    }));
  }, [filteredData, selectedUser]);

  // 6. Transaction Size Distribution
  const sizeDistribution = useMemo(() => {
      let small = 0, medium = 0, large = 0;
      filteredData.forEach(d => {
          const share = getUserShare(d, selectedUser);
          if (share === 0) return;
          if (share < 300) small++;
          else if (share <= 1000) medium++;
          else large++;
      });
      return [
          { name: 'Small (<₹300)', value: small },
          { name: 'Medium (₹300-₹1k)', value: medium },
          { name: 'Large (>₹1k)', value: large }
      ];
  }, [filteredData, selectedUser]);

  // 7. Group Dynamics (Who paid vs Who consumed)
  const groupDynamics = useMemo(() => {
      return users.map(u => {
          let paidTimes = 0;
          let paidAmount = 0;
          let consumedTimes = 0;
          let consumedAmount = 0;
          
          filteredData.forEach(d => {
              const amt = d.users[u] || 0;
              if (amt > 0) {
                  paidTimes++;
                  paidAmount += d.Cost; // Roughly they paid the cost
              } else if (amt < 0) {
                  consumedTimes++;
                  consumedAmount += Math.abs(amt);
              }
          });
          return {
              name: u,
              paidTimes,
              paidAmount,
              consumedTimes,
              consumedAmount,
              netRatio: consumedAmount > 0 ? (paidAmount / consumedAmount).toFixed(1) : '0'
          };
      }).sort((a,b) => b.paidAmount - a.paidAmount);
  }, [filteredData, users]);


  const totalExpense = useMemo(() => {
    return filteredData.reduce((acc, d) => acc + getUserShare(d, selectedUser), 0);
  }, [filteredData, selectedUser]);

  const biggestExpenses = useMemo(() => {
      return [...filteredData].sort((a, b) => getUserShare(b, selectedUser) - getUserShare(a, selectedUser)).slice(0, 10);
  }, [filteredData, selectedUser]);


  if (data.length === 0) {
    return (
      <div className="animate-in delay-1 upload-box" style={{ maxWidth: '600px', margin: '4rem auto' }}>
        <UploadCloud className="upload-icon" />
        <h2 style={{ fontSize: '24px' }}>Upload Splitwise Export</h2>
        <p className="text-secondary">Select your .csv file to generate your premium dashboard</p>
        <div className="file-input-wrapper mt-4">
          <button className="btn" style={{ marginRight: '1rem' }}>Select CSV File</button>
          <input type="file" accept=".csv" onChange={handleFileUpload} />
        </div>
        <div className="mt-4">
          <button className="btn" onClick={handleApiSync} disabled={isSyncing} style={{ background: 'rgba(50,215,75,0.2)', border: '1px solid var(--positive)', color: 'var(--positive)' }}>
            <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} /> 
            {isSyncing ? "Syncing..." : "Sync Live via Session Token"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid">
      {/* Top Bar Controls */}
      <div className="glass-panel flex items-center justify-between animate-in delay-1" style={{ flexWrap: 'wrap', gap: '1rem', padding: '16px 24px' }}>
        <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
          <div className="flex items-center gap-2">
            <User size={18} className="text-secondary"/>
            <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
              <option value="All">All Users</option>
              {dynamicUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-secondary"/>
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              <option value="All">All Months</option>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {groups.length > 0 && (
            <div className="flex items-center gap-2">
              <Users size={18} className="text-secondary"/>
              <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
                <option value="All">All Groups</option>
                {groups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2" style={{ background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <button 
                onClick={() => setActiveTab('overview')}
                className="btn" 
                style={{ 
                    background: activeTab === 'overview' ? 'rgba(255,255,255,0.15)' : 'transparent',
                    border: 'none', padding: '8px 16px', fontSize: '13px'
                }}>
                <LayoutDashboard size={16} /> Overview
            </button>
            <button 
                onClick={() => setActiveTab('insights')}
                className="btn" 
                style={{ 
                    background: activeTab === 'insights' ? 'rgba(255,255,255,0.15)' : 'transparent',
                    border: 'none', padding: '8px 16px', fontSize: '13px' 
                }}>
                <Lightbulb size={16} /> Deep Insights
            </button>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn" onClick={handleApiSync} disabled={isSyncing} style={{ padding: '8px 16px', fontSize: '13px', background: 'rgba(50,215,75,0.15)', borderColor: 'var(--positive)', color: 'var(--positive)' }}>
            <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} /> {isSyncing ? "Syncing..." : "Live Sync"}
          </button>
          <div className="file-input-wrapper" style={{ display: 'inline-block' }}>
            <button className="btn" style={{ padding: '8px 16px', fontSize: '13px' }}>
              <UploadCloud size={16} /> New CSV
            </button>
            <input type="file" accept=".csv" onChange={handleFileUpload} />
          </div>
        </div>
      </div>

      {/* Stats KPI */}
      <div className="grid grid-cols-3 animate-in delay-2">
        <div className="glass-panel stat-card">
          <span className="stat-title">Total Spent</span>
          <span className="stat-value text-gradient">₹{totalExpense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          <span className="text-secondary" style={{ fontSize: '13px' }}>
            {selectedUser === 'All' ? 'Group Total' : `${selectedUser.split(' ')[0]}'s Share`}
          </span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-title">Transactions</span>
          <span className="stat-value">{filteredData.length}</span>
          <span className="text-secondary" style={{ fontSize: '13px' }}>Matching filters</span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-title">Top Category</span>
          <span className="stat-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: categoryData[0]?.name.length > 10 ? '2rem' : '2.5rem' }}>
            {categoryData.length > 0 ? categoryData[0].name : '-'}
          </span>
          <span className="text-secondary" style={{ fontSize: '13px' }}>
            {categoryData.length > 0 ? `₹${categoryData[0].value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : ''}
          </span>
        </div>
      </div>

      {/* ==== OVERVIEW TAB ==== */}
      {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-2 animate-in delay-3">
                <div className="glass-panel">
                <div className="flex items-center gap-2 mb-4">
                    <PieChartIcon color="var(--accent-1)" size={20} />
                    <h3 style={{ fontSize: '18px' }}>Category Breakdown</h3>
                </div>
                <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                        label={({ name, percent }: any) => `${name?.substring(0, 10)} ${(percent * 100).toFixed(0)}%`}
                        >
                        {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                        </Pie>
                        <Tooltip 
                        formatter={(value: any) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        contentStyle={{ backgroundColor: 'rgba(30, 30, 30, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff' }}
                        />
                    </PieChart>
                    </ResponsiveContainer>
                </div>
                </div>

                <div className="glass-panel">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp color="var(--accent-2)" size={20} />
                    <h3 style={{ fontSize: '18px' }}>Cumulative Spend Trajectory</h3>
                </div>
                <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyCumulativeData}>
                        <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-2)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--accent-2)" stopOpacity={0}/>
                        </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="name" stroke="#a1a1a6" tick={{fontSize: 12}} minTickGap={30} />
                        <YAxis stroke="#a1a1a6" tick={{fontSize: 12}} tickFormatter={(v) => `₹${v/1000}k`} />
                        <Tooltip 
                        formatter={(value: any) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        labelFormatter={(label) => `Date: ${label}`}
                        contentStyle={{ backgroundColor: 'rgba(30, 30, 30, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        />
                        <Area type="monotone" dataKey="Total" stroke="var(--accent-2)" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                    </AreaChart>
                    </ResponsiveContainer>
                </div>
                </div>
            </div>

            <div className="grid grid-cols-2 animate-in delay-3">
                <div className="glass-panel">
                <div className="flex items-center gap-2 mb-4">
                    <BarChartIcon color="var(--accent-3)" size={20} />
                    <h3 style={{ fontSize: '18px' }}>Monthly Spend Comparison</h3>
                </div>
                <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="name" stroke="#a1a1a6" tick={{fontSize: 12}} />
                        <YAxis stroke="#a1a1a6" tick={{fontSize: 12}} tickFormatter={(v) => `₹${v/1000}k`} />
                        <Tooltip 
                        formatter={(value: any) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        contentStyle={{ backgroundColor: 'rgba(30, 30, 30, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        />
                        <Bar dataKey="Total" fill="var(--accent-1)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                    </ResponsiveContainer>
                </div>
                </div>

                <div className="glass-panel">
                    <div className="flex items-center gap-2 mb-4">
                        <User color="var(--positive)" size={20} />
                        <h3 style={{ fontSize: '18px' }}>Net Balances (Who Owes Whom)</h3>
                    </div>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={userBalances} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                            <XAxis type="number" stroke="#a1a1a6" tick={{fontSize: 12}} />
                            <YAxis dataKey="name" type="category" stroke="#a1a1a6" width={70} tick={{fontSize: 12}} />
                            <Tooltip 
                            formatter={(value: any) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                            contentStyle={{ backgroundColor: 'rgba(30, 30, 30, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            />
                            <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" />
                            <Bar dataKey="NetBalance" radius={[0, 6, 6, 0]}>
                            {userBalances.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.NetBalance >= 0 ? 'var(--positive)' : 'var(--negative)'} />
                            ))}
                            </Bar>
                        </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="glass-panel animate-in delay-3">
                <h3 className="mb-4" style={{ fontSize: '18px' }}>Recent Transactions</h3>
                <div className="table-wrapper">
                <table>
                    <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Total Cost</th>
                        {selectedUser !== 'All' && <th>{selectedUser.split(' ')[0]}'s Share</th>}
                    </tr>
                    </thead>
                    <tbody>
                    {filteredData.slice().reverse().slice(0, 15).map((d, i) => {
                        const share = getUserShare(d, selectedUser);
                        return (
                        <tr key={i}>
                            <td>{d.Date}</td>
                            <td style={{ fontWeight: 500 }}>{d.Description}</td>
                            <td>
                            <span className="badge badge-neutral">{d.Category}</span>
                            </td>
                            <td>₹{d.Cost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                            {selectedUser !== 'All' && (
                            <td>
                                <span className={`badge ${share > 0 ? 'badge-negative' : 'badge-neutral'}`}>
                                {share > 0 ? `₹${share.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
                                </span>
                            </td>
                            )}
                        </tr>
                        );
                    })}
                    </tbody>
                </table>
                </div>
            </div>
          </>
      )}

      {/* ==== INSIGHTS TAB ==== */}
      {activeTab === 'insights' && (
          <>
            <div className="grid grid-cols-2 animate-in delay-3">
                {/* Day of Week Radar */}
                <div className="glass-panel">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock color="var(--accent-4, #FF9F0A)" size={20} />
                        <h3 style={{ fontSize: '18px' }}>Spending by Day of Week</h3>
                    </div>
                    <div className="chart-container" style={{ display: 'flex' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dayOfWeekData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="day" stroke="#a1a1a6" tick={{fontSize: 12}} />
                                <YAxis stroke="#a1a1a6" tick={{fontSize: 12}} tickFormatter={(v) => `₹${v/1000}k`} />
                                <Tooltip 
                                    formatter={(value: any) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                                    contentStyle={{ backgroundColor: 'rgba(30, 30, 30, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                />
                                <Bar dataKey="Total" radius={[6, 6, 0, 0]}>
                                    {dayOfWeekData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={DAY_COLORS[index % DAY_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Transaction Size Distribution */}
                <div className="glass-panel">
                    <div className="flex items-center gap-2 mb-4">
                        <PieChartIcon color="var(--accent-1)" size={20} />
                        <h3 style={{ fontSize: '18px' }}>Transaction Size Distribution</h3>
                    </div>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={sizeDistribution}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={110}
                                paddingAngle={4}
                                dataKey="value"
                                stroke="none"
                                label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                            >
                            {sizeDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                            ))}
                            </Pie>
                            <Tooltip 
                        formatter={(value: any) => `${value} transactions`}
                                contentStyle={{ backgroundColor: 'rgba(30, 30, 30, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                itemStyle={{ color: '#fff' }}
                            />
                        </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 animate-in delay-3">
                <div className="glass-panel">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircle color="var(--negative)" size={20} />
                        <h3 style={{ fontSize: '18px' }}>Top 10 Biggest Expenses</h3>
                    </div>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Cost</th>
                            </tr>
                            </thead>
                            <tbody>
                            {biggestExpenses.map((d, i) => (
                                <tr key={i}>
                                <td>{d.Date.substring(5)}</td>
                                <td style={{ fontWeight: 500 }}>{d.Description}</td>
                                <td>
                                    <span className="badge badge-negative">
                                        ₹{getUserShare(d, selectedUser).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </span>
                                </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {selectedUser === 'All' && (
                    <div className="glass-panel">
                        <div className="flex items-center gap-2 mb-4">
                            <User color="var(--accent-2)" size={20} />
                            <h3 style={{ fontSize: '18px' }}>Group Dynamics & Payer Behavior</h3>
                        </div>
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Paid Count</th>
                                    <th>Consumed Count</th>
                                    <th>Paid Ratio</th>
                                </tr>
                                </thead>
                                <tbody>
                                {groupDynamics.map((d, i) => (
                                    <tr key={i}>
                                    <td style={{ fontWeight: 500 }}>{d.name.split(' ')[0]}</td>
                                    <td>{d.paidTimes}</td>
                                    <td>{d.consumedTimes}</td>
                                    <td>
                                        <span className={`badge ${parseFloat(d.netRatio) > 1 ? 'badge-positive' : 'badge-neutral'}`}>
                                            {d.netRatio}x
                                        </span>
                                    </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
          </>
      )}
    </div>
  );
}

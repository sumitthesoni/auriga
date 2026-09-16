import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { api } from '../api/client';
import { UserCheck, UserX, ChevronDown, Search, Loader2 } from 'lucide-react';

interface AssigneeSelectProps {
  currentAssignedTo: number | null;
  onSelect: (userId: number | null) => Promise<void> | void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  usersList?: User[];
}

export function AssigneeSelect({
  currentAssignedTo,
  onSelect,
  disabled = false,
  size = 'md',
  usersList,
}: AssigneeSelectProps) {
  const [users, setUsers] = useState<User[]>(usersList || []);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (usersList && usersList.length > 0) {
      setUsers(usersList);
      return;
    }

    let mounted = true;
    async function loadUsers() {
      setLoading(true);
      try {
        const data = await api.getUsers();
        if (mounted) {
          setUsers(data || []);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadUsers();
    return () => {
      mounted = false;
    };
  }, [usersList]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentAssignee = users.find((u) => u.id === currentAssignedTo);

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = async (userId: number | null) => {
    setIsOpen(false);
    setSearch('');
    if (userId === currentAssignedTo) return;

    try {
      setIsSubmitting(true);
      await onSelect(userId);
    } finally {
      setIsSubmitting(false);
    }
  };

  const buttonSize =
    size === 'sm' ? 'text-xs px-2.5 py-1' : 'text-sm px-3 py-1.5';

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        id="assignee-select-trigger"
        onClick={() => !disabled && !isSubmitting && setIsOpen(!isOpen)}
        disabled={disabled || isSubmitting}
        className={`flex items-center justify-between gap-2 rounded-md border transition-all text-slate-700 bg-white hover:bg-slate-50 border-slate-300 shadow-xs focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${buttonSize}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 truncate max-w-[160px]">
          {isSubmitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500 shrink-0" />
          ) : currentAssignee ? (
            <UserCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          ) : (
            <UserX className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}
          <span className="truncate font-medium">
            {currentAssignee ? currentAssignee.name : 'Unassigned'}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <div
          id="assignee-dropdown-menu"
          className="absolute left-0 mt-1 w-64 origin-top-left rounded-md bg-white shadow-lg border border-slate-200 z-50 py-1.5 text-sm focus:outline-none animate-in fade-in zoom-in-95 duration-100"
          role="listbox"
        >
          {/* Search box if users > 3 */}
          <div className="px-2.5 pb-2 pt-1 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="assignee-search-input"
                placeholder="Search staff..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full pl-8 pr-2.5 py-1 text-xs rounded border border-slate-200 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {/* Option: Unassigned */}
            <button
              type="button"
              id="assignee-option-unassigned"
              onClick={() => handleSelect(null)}
              className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 hover:bg-slate-50 transition-colors ${
                currentAssignedTo === null ? 'bg-slate-50 font-semibold text-slate-900' : 'text-slate-600'
              }`}
              role="option"
              aria-selected={currentAssignedTo === null}
            >
              <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                <UserX className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div className="truncate">
                <div className="text-xs font-medium text-slate-800">Unassigned</div>
                <div className="text-[10px] text-slate-400">Remove current assignee</div>
              </div>
            </button>

            {loading ? (
              <div className="py-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading staff...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400">No staff members found</div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = u.id === currentAssignedTo;
                return (
                  <button
                    key={u.id}
                    id={`assignee-option-${u.id}`}
                    type="button"
                    onClick={() => handleSelect(u.id)}
                    className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 hover:bg-slate-50 transition-colors ${
                      isSelected ? 'bg-teal-50/60 font-semibold text-teal-900' : 'text-slate-700'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 border border-teal-200 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {u.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="truncate flex-1">
                      <div className="text-xs font-medium truncate text-slate-900">{u.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{u.email}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

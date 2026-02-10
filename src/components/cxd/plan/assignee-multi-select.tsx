'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { UserPlus, X } from 'lucide-react';

interface AssigneeMultiSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
  compact?: boolean;
  iconOnly?: boolean;
}

const STORAGE_KEY = 'plan-assignee-options';

const readOptions = (): string[] => {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

export function AssigneeMultiSelect({ value, onChange, compact = false, iconOnly = false }: AssigneeMultiSelectProps) {
  const [typedName, setTypedName] = useState('');
  const [options, setOptions] = useState<string[]>(readOptions);

  const uniqueOptions = useMemo(() => {
    return Array.from(new Set([...options, ...value])).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [options, value]);

  const persistOptions = (next: string[]) => {
    setOptions(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const toggleAssignee = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = value.includes(trimmed) ? value.filter(v => v !== trimmed) : [...value, trimmed];
    onChange(next);
  };

  const addTypedAssignee = () => {
    const name = typedName.trim();
    if (!name) return;
    if (!uniqueOptions.includes(name)) {
      persistOptions([...uniqueOptions, name]);
    }
    if (!value.includes(name)) {
      onChange([...value, name]);
    }
    setTypedName('');
  };

  return (
    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={compact ? 'sm' : 'default'}
            className={iconOnly
              ? 'h-7 w-7 p-0 bg-black/45 border-white/15'
              : compact
                ? 'h-8 px-2 text-xs bg-black/40 border-white/15'
                : 'w-full justify-start bg-black/40 border-white/10'}
            title={iconOnly ? 'Assignee' : undefined}
          >
            <UserPlus className={iconOnly ? 'w-3.5 h-3.5' : compact ? 'w-3 h-3 mr-1' : 'w-3.5 h-3.5 mr-2'} />
            {!iconOnly && (value.length > 0 ? `${value.length} assignee${value.length > 1 ? 's' : ''}` : 'Assign team members')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="z-[220] bg-black/95 border border-white/15 rounded-xl p-2 min-w-[240px] text-white">
          <DropdownMenuLabel className="text-xs">Team Members</DropdownMenuLabel>
          <div className="px-1 py-1.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-1.5">
              <Input
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Type name and add"
                className="h-8 text-xs bg-black/40 border-white/15"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTypedAssignee();
                  }
                }}
              />
              <Button size="sm" className="h-8 text-xs" onClick={addTypedAssignee}>Add</Button>
            </div>
          </div>
          <DropdownMenuSeparator className="bg-white/10" />
          <div className="max-h-44 overflow-y-auto pr-1">
            {uniqueOptions.map(name => (
              <DropdownMenuItem key={name} onClick={() => toggleAssignee(name)} className="rounded-lg text-xs text-white/90">
                <span className={`w-2 h-2 rounded-full mr-2 ${value.includes(name) ? 'bg-purple-400' : 'bg-white/25'}`} />
                {name}
              </DropdownMenuItem>
            ))}
            {uniqueOptions.length === 0 && (
              <div className="text-xs text-muted-foreground px-2 py-1">No team members yet.</div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {!iconOnly && value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map(name => (
            <Badge key={name} variant="outline" className="text-[10px] border-white/15 bg-black/30 pr-1">
              <span>{name}</span>
              <button
                className="ml-1 text-white/70 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter(v => v !== name));
                }}
                title={`Remove ${name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

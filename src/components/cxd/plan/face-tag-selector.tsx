'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HYPERCUBE_FACE_COLORS, HYPERCUBE_FACE_TAGS } from '@/types/plan-types';
import type { HypercubeFaceTag } from '@/types/canvas-elements';
import { Tag } from 'lucide-react';

interface FaceTagSelectorProps {
  value: HypercubeFaceTag[];
  onChange: (next: HypercubeFaceTag[]) => void;
  compact?: boolean;
  iconOnly?: boolean;
}

export function FaceTagSelector({ value, onChange, compact = false, iconOnly = false }: FaceTagSelectorProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? 'sm' : 'default'}
          className={iconOnly
            ? 'h-7 w-7 p-0 text-xs bg-black/45 border-white/15'
            : compact
              ? 'h-8 px-2 text-xs bg-black/40 border-white/15'
              : 'w-full justify-start bg-black/40 border-white/10'}
          onClick={(e) => e.stopPropagation()}
          title={iconOnly ? 'Select Faces' : undefined}
        >
          <Tag className={iconOnly ? 'w-3.5 h-3.5' : compact ? 'w-3 h-3 mr-1' : 'w-3.5 h-3.5 mr-2'} />
          {!iconOnly && (value.length > 0 ? `${value.length} face${value.length > 1 ? 's' : ''}` : 'Select faces')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="z-[220] bg-black/95 border border-white/20 rounded-xl p-1 min-w-[220px] text-white">
        <DropdownMenuLabel className="text-xs">Hypercube Faces</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        {HYPERCUBE_FACE_TAGS.map((face) => (
          <DropdownMenuCheckboxItem
            key={face}
            checked={value.includes(face)}
            onCheckedChange={(checked) => {
              const next = checked ? [...value, face] : value.filter(v => v !== face);
              onChange(next);
            }}
            className="text-xs rounded-lg text-white/90"
          >
            <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: HYPERCUBE_FACE_COLORS[face] }} />
            {face}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

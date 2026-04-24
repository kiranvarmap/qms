"use client";

import { Plus, Filter as FilterIcon, X } from "lucide-react";
import type { ColumnDef } from "@/lib/types";

export interface FilterCondition {
  id: string;
  columnId: string;
  operator: "equals" | "contains" | "not_equals" | "is_empty" | "is_not_empty";
  value: string;
}

interface FilterBarProps {
  columns: ColumnDef[];
  filters: FilterCondition[];
  onChange: (filters: FilterCondition[]) => void;
}

const OPERATORS = [
  { value: "contains", label: "contains" },
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
] as const;

const NO_VALUE_OPS = new Set(["is_empty", "is_not_empty"]);

export function FilterBar({ columns, filters, onChange }: FilterBarProps) {
  const addFilter = () => {
    if (columns.length === 0) return;
    onChange([
      ...filters,
      {
        id: crypto.randomUUID(),
        columnId: columns[0].id,
        operator: "contains",
        value: "",
      },
    ]);
  };

  const updateFilter = (id: string, patch: Partial<FilterCondition>) => {
    onChange(
      filters.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  };

  const removeFilter = (id: string) => {
    onChange(filters.filter((f) => f.id !== id));
  };

  if (filters.length === 0) {
    return (
      <button
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors"
        onClick={addFilter}
      >
        <FilterIcon className="h-3.5 w-3.5" />
        Filter
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
      <span className="text-xs font-medium text-blue-700 flex items-center gap-1">
        <FilterIcon className="h-3.5 w-3.5" /> Filters
      </span>

      {filters.map((filter, idx) => (
        <div
          key={filter.id}
          className="flex items-center gap-1 bg-white rounded-md px-2 py-1 ring-1 ring-gray-200 text-xs"
        >
          {idx > 0 && (
            <span className="text-gray-400 font-medium mr-1">and</span>
          )}

          {/* Column selector */}
          <select
            className="bg-transparent outline-none text-gray-700 font-medium cursor-pointer max-w-[120px]"
            value={filter.columnId}
            onChange={(e) => updateFilter(filter.id, { columnId: e.target.value })}
          >
            {columns.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </select>

          {/* Operator selector */}
          <select
            className="bg-transparent outline-none text-gray-500 cursor-pointer"
            value={filter.operator}
            onChange={(e) =>
              updateFilter(filter.id, {
                operator: e.target.value as FilterCondition["operator"],
              })
            }
          >
            {OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>

          {/* Value input */}
          {!NO_VALUE_OPS.has(filter.operator) && (
            <input
              className="border-b border-gray-300 outline-none bg-transparent px-1 py-0.5 w-24 text-gray-700 focus:border-blue-400"
              value={filter.value}
              onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
              placeholder="value..."
            />
          )}

          <button
            className="text-gray-400 hover:text-red-500 ml-1"
            onClick={() => removeFilter(filter.id)}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      <button
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-100"
        onClick={addFilter}
      >
        <Plus className="h-3 w-3" />
        Add filter
      </button>

      <button
        className="text-xs text-gray-400 hover:text-red-500 ml-auto"
        onClick={() => onChange([])}
      >
        Clear all
      </button>
    </div>
  );
}

'use client'

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { 
  RefreshCw, Filter, MinusSquare, PlusSquare, 
  Database, ArrowUp, ArrowDown, ChevronDown, Check, ZoomIn, 
  ZoomOut, Maximize, Search, X, BarChart3, LogOut, Sun, Upload,
  Moon, Laptop, Loader2, MoreVertical, FileWarning, LayoutList,
  ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp01, SortAsc, SortDesc
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts'
import { useTheme } from '../components/ThemeProvider'

// ==========================================
// TYPES & CONSTANTS
// ==========================================

export interface AggregatedRecord {
  year: number;
  month: number;
  col_label_1: string;
  col_label_2: string;
  col_label_3: string;
  col_label_4: string;
  col_label_5: string;
  col_label_6: string;
  total_amount: number;
}

export interface PivotNode {
  id: string;
  label: string;
  level: number;
  isLeaf: boolean;
  values: Record<string, number>;
  rowTotal: number;
  children?: PivotNode[];
  childMap?: Record<string, PivotNode>;
}

export const HIERARCHY_OPTIONS = [
  { label: '(None)', value: '' },
  { label: 'Business Area', value: 'business_area' },
  { label: 'PSS', value: 'pss' },
  { label: 'Key Account Type', value: 'key_account_type' },
  { label: 'Customer Group', value: 'cust_group' },
  { label: 'Customer Name', value: 'cust_name' },
  { label: 'Product', value: 'product' },
  { label: 'Material', value: 'material' },
  { label: 'Material Description', value: 'material_description' },
  { label: 'Area', value: 'area' }
]

export const MONTH_OPTIONS = [
  { label: 'Jan', value: '1' }, { label: 'Feb', value: '2' }, 
  { label: 'Mar', value: '3' }, { label: 'Apr', value: '4' }, 
  { label: 'Mei', value: '5' }, { label: 'Jun', value: '6' }, 
  { label: 'Jul', value: '7' }, { label: 'Agu', value: '8' }, 
  { label: 'Sep', value: '9' }, { label: 'Okt', value: '10' }, 
  { label: 'Nov', value: '11' }, { label: 'Des', value: '12' }
]

const MONTH_COLORS = [
  "#4338ca", "#4f46e5", "#5156cf", "#5a5ee0", "#6366f1", "#6d78e9", 
  "#7782f0", "#818cf8", "#8795f3", "#919ff6", "#9baaf9", "#a5b4fc"
]

// ==========================================
// HELPER COMPONENTS
// ==========================================

const YearOverYearBadge = ({ current, previous }: { current: number, previous: number }) => {
  if (previous === 0) return null;
  
  const difference = current - previous;
  const percentage = (difference / previous) * 100;
  const isUp = percentage > 0;

  if (current === 0) {
    return <span className="text-[9px] text-slate-300 dark:text-slate-600">-</span>;
  }

  const colorClass = percentage === 0 
    ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
    : isUp 
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
      : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800';

  return (
    <div className={`flex items-center gap-[0.2em] text-[0.7em] font-bold px-[0.5em] rounded-full border shadow-sm ${colorClass}`}>
      {isUp ? (
        <ArrowUp className="w-[0.8em] h-[0.8em]" />
      ) : (
        percentage !== 0 && <ArrowDown className="w-[0.8em] h-[0.8em]" />
      )}
      <span>{Math.abs(percentage).toFixed(1)}%</span>
    </div>
  )
}

const DimensionSelectBox = ({ label, value, onChange, options }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedLabel = options.find((option: any) => option.value === value)?.label || "Select...";

  return (
    <div className="flex flex-col w-full relative" ref={containerRef}>
      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 ml-1 mb-0.5 uppercase">
        {label}
      </label>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`flex items-center justify-between gap-2 w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded-md shadow-sm transition-colors text-left 
          ${isOpen ? 'border-blue-500 ring-1 ring-blue-500 dark:border-blue-400' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
        <span className="truncate font-medium text-slate-700 dark:text-slate-200">{selectedLabel}</span>
        <ChevronDown size={14} className="text-slate-400 shrink-0" />
      </button>
      
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 md:bg-transparent md:p-0 md:absolute md:inset-auto md:top-full md:left-0 md:block md:mt-1">
          <div className="absolute inset-0 md:hidden" onClick={() => setIsOpen(false)}></div>
          <div className="relative w-full max-w-xs md:w-full min-w-37.5 max-h-[50vh] overflow-y-auto bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg shadow-xl z-10 animate-in fade-in zoom-in-95 duration-200 py-1 flex flex-col">
            {options.map((option: any) => (
              <button 
                key={option.value} 
                onClick={() => { onChange(option.value); setIsOpen(false); }} 
                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors 
                  ${value === option.value ? 'text-blue-600 dark:text-blue-400 font-bold bg-slate-50 dark:bg-slate-800/50' : 'text-slate-700 dark:text-slate-200'}`}>
                <span>{option.label}</span>
                {value === option.value && <Check size={12}/>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const MultiSelect = ({ label, options, rawOptions, selectedValues, onChange }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [temporarySelected, setTemporarySelected] = useState<string[]>([]);
  const [baseSelectionSnapshot, setBaseSelectionSnapshot] = useState<string[]>([]);
  const [isAddToSelectionMode, setIsAddToSelectionMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const finalOptions = useMemo(() => (
    rawOptions || (options || []).map((option: any) => ({ 
      label: !option || String(option).trim() === '' ? `No ${label}` : String(option), 
      value: !option || String(option).trim() === '' ? "" : String(option) 
    }))
  ), [options, rawOptions, label]);
  
  const filteredOptions = finalOptions.filter((option: any) => 
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      let initialSelection: string[] = [];
      if (selectedValues.includes('All')) {
        initialSelection = finalOptions.map((o: any) => o.value);
      } else {
        initialSelection = selectedValues;
      }
      setTemporarySelected(initialSelection);
      setBaseSelectionSnapshot(initialSelection);
      setSearchTerm("");
      setIsAddToSelectionMode(false);
    }
  }, [isOpen, selectedValues, finalOptions]);

  useEffect(() => {
    if (isOpen && searchTerm) {
      const visibleValues = filteredOptions.map((o: any) => o.value);
      
      if (isAddToSelectionMode) {
        const newSet = new Set([...baseSelectionSnapshot, ...visibleValues]);
        setTemporarySelected(Array.from(newSet));
      } else {
        setTemporarySelected(visibleValues);
      }
    }
  }, [searchTerm, isAddToSelectionMode, finalOptions, isOpen, baseSelectionSnapshot]);

  useEffect(() => { 
    const handleClickOutside = (e: MouseEvent) => { 
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside); 
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleApply = () => {
    if (temporarySelected.length === finalOptions.length && finalOptions.length > 0) {
      onChange(['All']);
    } else {
      onChange(temporarySelected);
    }
    setIsOpen(false);
  }

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value && searchTerm === "") {
      setBaseSelectionSnapshot(temporarySelected);
    }
    setSearchTerm(value);
  }

  const toggleOption = (value: string) => {
    let newSelection = [...temporarySelected];
    if (newSelection.includes(value)) {
      newSelection = newSelection.filter(item => item !== value);
    } else {
      newSelection.push(value);
    }
    setTemporarySelected(newSelection);
  }

  const handleSelectAllClick = () => {
    if (!searchTerm) {
      if (temporarySelected.length === finalOptions.length) {
        setTemporarySelected([]); 
      } else {
        setTemporarySelected(finalOptions.map((o: any) => o.value)); 
      }
      return;
    }

    const visibleValues = filteredOptions.map((o: any) => o.value);
    const isAllVisibleSelected = visibleValues.every((v: any) => temporarySelected.includes(v));

    if (isAllVisibleSelected) {
      const newSelection = temporarySelected.filter((v: string) => !visibleValues.includes(v));
      setTemporarySelected(newSelection);
    } else {
      if (isAddToSelectionMode) {
        const newSelection = Array.from(new Set([...temporarySelected, ...visibleValues]));
        setTemporarySelected(newSelection);
      } else {
        setTemporarySelected([...visibleValues]);
      }
    }
  }

  const isSelectAllChecked = useMemo(() => {
    if (!searchTerm) return temporarySelected.length === finalOptions.length && finalOptions.length > 0;
    if (filteredOptions.length === 0) return false;
    return filteredOptions.every((o: any) => temporarySelected.includes(o.value));
  }, [temporarySelected, searchTerm, filteredOptions, finalOptions]);

  const getButtonLabel = () => {
    if (selectedValues.includes('All')) return 'All';
    if (!selectedValues.length) return 'None';
    
    const names = selectedValues.map((val: string) => 
      finalOptions.find((o: any) => o.value === val)?.label
    ).filter(Boolean);
    
    return names.length > 2 ? `${names[0]}, ${names[1]} +${names.length - 2}` : names.join(', ');
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex flex-col">
        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 ml-1 mb-0.5 uppercase">
          {label}
        </label>
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className={`flex items-center justify-between gap-2 w-full md:w-auto md:min-w-32 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded-md shadow-sm transition-colors 
            ${isOpen ? 'border-blue-500 ring-1 ring-blue-500 dark:border-blue-400' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
          <span className="truncate font-medium text-slate-700 dark:text-slate-200 max-w-25 text-left">
            {getButtonLabel()}
          </span>
          <ChevronDown size={14} className="text-slate-400 shrink-0" />
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 md:bg-transparent md:p-0 md:absolute md:inset-auto md:top-full md:left-0 md:block md:mt-1">
          <div className="absolute inset-0 md:hidden" onClick={() => setIsOpen(false)}></div>
          <div className="relative w-full max-w-xs md:w-64 max-h-[70vh] md:max-h-96 flex flex-col bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="shrink-0 p-2 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <div className="relative flex-1">
                <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Cari... (Enter utk Terapkan)" 
                  className="w-full pl-7 pr-6 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500" 
                  value={searchTerm} 
                  onChange={handleSearchInput} 
                  onKeyDown={(e) => { if(e.key === 'Enter') handleApply() }}
                  autoFocus 
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <X size={12}/>
                  </button>
                )}
              </div>
              
              {searchTerm && (
                <div onClick={() => setIsAddToSelectionMode(!isAddToSelectionMode)} className="flex items-center gap-2 px-1 cursor-pointer select-none">
                  <div className={`w-3 h-3 rounded border flex items-center justify-center transition-colors ${isAddToSelectionMode ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                    {isAddToSelectionMode && <Check size={8} className="text-white"/>}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Tambahkan ke pilihan saat ini</span>
                </div>
              )}
            </div>

            <div className="overflow-y-auto flex-1 p-1">
              <div onClick={handleSelectAllClick} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-xs font-bold border-b border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200 select-none">
                <div className={`w-3 h-3 rounded border flex items-center justify-center ${isSelectAllChecked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
                  {isSelectAllChecked && <Check size={8} className="text-white"/>}
                </div>
                {searchTerm ? '(Pilih Hasil Pencarian)' : '(Pilih Semua)'}
              </div>

              {filteredOptions.length ? filteredOptions.map((option: any) => { 
                const isSelected = temporarySelected.includes(option.value); 
                return (
                  <div key={option.value || 'empty'} onClick={() => toggleOption(option.value)} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-xs transition-colors select-none">
                    <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
                      {isSelected && <Check size={8} className="text-white"/>}
                    </div>
                    <span className={`${isSelected ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'} ${option.value === "" ? 'italic text-red-500 dark:text-red-400' : ''}`}>
                      {option.label}
                    </span>
                  </div>
                ) 
              }) : <div className="px-3 py-4 text-center text-xs text-slate-400 italic">Nihil</div>}
            </div>

            <div className="shrink-0 p-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[10px] text-slate-400">{temporarySelected.length} terpilih</span>
              <div className="flex gap-2">
                <button onClick={() => setIsOpen(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">Batal</button>
                <button onClick={handleApply} className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-sm transition-colors">Terapkan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const totalYear = payload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);
    return (
      <div className="bg-white dark:bg-slate-900 p-2 border border-slate-200 dark:border-slate-800 shadow-xl rounded-lg text-[10px] z-50 min-w-35">
        <div className="font-bold text-slate-700 dark:text-slate-200 mb-1.5 border-b border-slate-100 dark:border-slate-800 pb-1">{label}</div>
        <div className="flex flex-col gap-0.5 mb-2">
          {payload.slice().reverse().map((entry: any, index: number) => (
            entry.value > 0 && (
              <div key={index} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                  <span className="text-slate-500 dark:text-slate-400 text-[10px]">{entry.name}</span>
                </div>
                <span className="font-mono text-slate-700 dark:text-slate-300 font-medium text-[10px]">{entry.value.toLocaleString('id-ID')}</span>
              </div>
            )
          ))}
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 flex justify-between items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded">
          <span className="text-slate-500 dark:text-slate-400 font-bold text-[10px]">TOTAL</span>
          <span className="font-mono font-bold text-slate-800 dark:text-white text-[10px]">{totalYear.toLocaleString('id-ID')}</span>
        </div>
      </div>
    );
  }
  return null;
}

// ==========================================
// LOGIC HOOKS
// ==========================================

// Tambahkan parameter sortBy dan sortOrder
// Update parameter hook untuk menerima sortYear
function usePivotTableData({ data, expandedCols, expandedRows, activeLevels, sortBy, sortOrder, sortYear }: any) {
  return useMemo(() => {
    const uniqueYears = Array.from(new Set(data.map((d: any) => String(d.year)))).sort() as string[];
    const finalColumnKeys: string[] = [];

    // ... (Logika Column Keys TETAP SAMA) ...
    uniqueYears.forEach(year => {
      if (expandedCols[year]) {
        const monthsInYear = Array.from(new Set(data.filter((d: any) => String(d.year) === year).map((d: any) => d.month)))
          .sort((a: any, b: any) => a - b) as number[];
        monthsInYear.forEach(m => finalColumnKeys.push(`${year}-${m < 10 ? '0' + m : m}`));
        finalColumnKeys.push(`${year}-Total`); 
      } else {
        finalColumnKeys.push(year);
      }
    });

    const columnTotals: Record<string, number> = {};
    const rootMap: Record<string, PivotNode> = {};

    // ... (Logika Loop Data TETAP SAMA) ...
    for (const item of data) {
      const yearStr = String(item.year);
      const monthStr = item.month < 10 ? `0${item.month}` : String(item.month);
      const val = item.total_amount || 0;
      
      const timeKeys = [yearStr, `${yearStr}-${monthStr}`, `${yearStr}-Total`];

      timeKeys.forEach(key => {
        columnTotals[key] = (columnTotals[key] || 0) + val;
      });

      const levels: string[] = activeLevels.map((lvlField: string, idx: number) => {
        const value = (item as any)[`col_label_${idx + 1}`];
        return (!value || String(value).trim() === '') 
          ? `No ${lvlField.replace('_', ' ')}` 
          : String(value);
      });

      if (!levels.length) continue;

      let currentMap = rootMap;
      let path = "";

      levels.forEach((levelLabel, idx) => {
        path = path ? `${path}|${levelLabel}` : levelLabel;
        
        if (!currentMap[levelLabel]) {
          currentMap[levelLabel] = {
            id: path,
            label: levelLabel,
            level: idx,
            isLeaf: idx === levels.length - 1,
            values: {},
            rowTotal: 0,
            childMap: {}
          };
        }

        const node = currentMap[levelLabel];
        
        timeKeys.forEach(key => {
          node.values[key] = (node.values[key] || 0) + val;
        });
        node.rowTotal += val;

        if (!node.isLeaf) {
          if (!node.childMap) node.childMap = {};
          currentMap = node.childMap;
        }
      });
    }

    // --- BAGIAN INI DIMODIFIKASI UNTUK SORTING SPESIFIK TAHUN ---
    const processMapToNodes = (map: any): PivotNode[] => {
      return Object.values(map)
        .sort((a: any, b: any) => {
           // Logika Sorting
           if (sortBy === 'value') {
             // Tentukan nilai yang akan dibandingkan (Total Row atau Tahun Spesifik)
             const valA = sortYear === 'Total' ? a.rowTotal : (a.values[sortYear] || 0);
             const valB = sortYear === 'Total' ? b.rowTotal : (b.values[sortYear] || 0);

             return sortOrder === 'asc' 
               ? valA - valB 
               : valB - valA;
           } else {
             // Sort by Name (Label)
             return sortOrder === 'asc'
               ? a.label.localeCompare(b.label)
               : b.label.localeCompare(a.label);
           }
        })
        .map((node: any) => {
          if (node.childMap) {
            node.children = processMapToNodes(node.childMap); 
          }
          return node;
        });
    };
    // ---------------------------------------------

    // ... (Sisa fungsi traverse TETAP SAMA) ...
    const visibleRows: PivotNode[] = [];
    const traverseAndCollectVisible = (nodes: PivotNode[]) => {
      nodes.forEach(node => {
        visibleRows.push(node);
        if (node.children && expandedRows[node.id]) {
          traverseAndCollectVisible(node.children);
        }
      });
    };

    traverseAndCollectVisible(processMapToNodes(rootMap));

    // ... (Sisa fungsi getHeaderInfo TETAP SAMA) ...
    const getHeaderInfo = (key: string) => {
      if (key.includes('-Total')) {
        return { type: 'subtotal', label: key.split('-')[0], parent: key.split('-')[0] };
      }
      if (key.includes('-')) {
        const [y, m] = key.split('-');
        return { 
          type: 'month', 
          label: MONTH_OPTIONS.find(o => o.value === String(parseInt(m)))?.label, 
          parent: y 
        };
      }
      return { type: 'year', label: key, parent: key };
    }

    return { 
      pivotData: { colKeys: finalColumnKeys, colTotals: columnTotals }, 
      visibleRows, 
      getHeaderInfo 
    };

  }, [data, expandedCols, expandedRows, activeLevels, sortBy, sortOrder, sortYear]); // Tambahkan sortYear ke dependency
}

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================

export default function SalesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  ), []);
  const { theme, setTheme } = useTheme();
  
  // STATE
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeLayer, setActiveLayer] = useState<'top' | 'hier'>('top');
  const [sortBy, setSortBy] = useState<'name' | 'value'>('value'); // Default sort by Value (Amount) agar yang terbesar diatas
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortYear, setSortYear] = useState<string>('Total');
  // NEW STATE: Menyimpan akses BA User (jika terkunci)
  const [userBaAccess, setUserBaAccess] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [salesData, setSalesData] = useState<AggregatedRecord[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  
  const [filterOptions, setFilterOptions] = useState<{
    years: any[], months: any[], areas: any[], businessAreas: any[], 
    pss: any[], keyAccountTypes: any[], products: any[], 
    customerGroups: any[], customerNames: any[], materials: any[], materialDescriptions: any[]
  }>({
    years: [], months: [], areas: [], businessAreas: [], 
    pss: [], keyAccountTypes: [], products: [], 
    customerGroups: [], customerNames: [], materials: [], materialDescriptions: []
  });

  // FILTERS
  const [selectedYears, setSelectedYears] = useState(['All']);
  const [selectedMonths, setSelectedMonths] = useState(['All']);
  const [selectedAreas, setSelectedAreas] = useState(['POWER AGCON']);
  const [selectedBusinessAreas, setSelectedBusinessAreas] = useState(['All']);
  const [selectedPSS, setSelectedPSS] = useState(['All']);
  const [selectedKeyAccountTypes, setSelectedKeyAccountTypes] = useState(['All']);
  const [selectedCustomerGroups, setSelectedCustomerGroups] = useState(['All']);
  const [selectedProducts, setSelectedProducts] = useState(['All']);
  const [selectedCustomerNames, setSelectedCustomerNames] = useState(['All']);
  const [selectedMaterials, setSelectedMaterials] = useState(['All']);
  const [selectedMaterialDescriptions, setSelectedMaterialDescriptions] = useState(['All']);

  // VIEW STATE
  const [level1Field, setLevel1Field] = useState('key_account_type');
  const [level2Field, setLevel2Field] = useState('');
  const [level3Field, setLevel3Field] = useState('');
  const [level4Field, setLevel4Field] = useState('');
  const [level5Field, setLevel5Field] = useState('');
  const [level6Field, setLevel6Field] = useState('');
  
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [expandedCols, setExpandedCols] = useState<Record<string, boolean>>({});
  const [zoomLevel, setZoomLevel] = useState(1);

  // COMPUTED
  const isDarkMode = isMounted && (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
  
  const activeHierarchyLevels = useMemo(() => 
    [level1Field, level2Field, level3Field, level4Field, level5Field, level6Field].filter(l => l !== ''),
    [level1Field, level2Field, level3Field, level4Field, level5Field, level6Field]
  );

  const { pivotData, visibleRows, getHeaderInfo } = usePivotTableData({ 
    data: salesData, 
    expandedCols, 
    expandedRows, 
    activeLevels: activeHierarchyLevels,
    sortBy,      // <--- Pass this
    sortOrder,    // <--- Pass this
    sortYear
  });

  const visibleYears = useMemo(() => {
    return Array.from(new Set(pivotData.colKeys.map(k => k.split('-')[0]))).sort();
  }, [pivotData.colKeys]);

  const getDynamicPrevKey = (key: string, info: any) => {
    const currentYear = info.parent;
    const currentIndex = visibleYears.indexOf(currentYear);
    
    if (currentIndex <= 0) return null;
    const prevYear = visibleYears[currentIndex - 1];

    if (info.type === 'year') {
      return prevYear;
    } else if (info.type === 'subtotal') {
      return `${prevYear}-Total`;
    } else if (info.type === 'month') {
      const monthPart = key.split('-')[1];
      return `${prevYear}-${monthPart}`;
    }
    return null;
  };

  const trendChartData = useMemo(() => {
    const map: any = {};
    chartData.forEach(item => {
      const key = item.year;
      if (!map[key]) map[key] = { name: key, total: 0 };
      map[key].total += item.total_amount;
      map[key][item.month] = (map[key][item.month] || 0) + item.total_amount;
    });
    return Object.values(map).sort((a: any, b: any) => a.name - b.name);
  }, [chartData]);

  const mapAvailableMonths = (availableMonths: number[]) => {
    if (!availableMonths || availableMonths.length === 0) return [];
    return MONTH_OPTIONS.filter(m => availableMonths.map(String).includes(m.value));
  };

  // EFFECTS
  useEffect(() => {
    const checkUserAuthentication = async () => {
      setIsAuthChecking(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { 
        router.replace('/login'); 
        return; 
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('akses')
        .eq('user_id', user.id)
        .single()
      
      // Simpan role user untuk logika UI
      if (profile) setUserRole(profile.akses);

      // LOGIKA KEAMANAN & FILTER OTOMATIS
      if (profile?.akses === 'CUSTOMER') {
        router.push('/') 
      } else {
        // Daftar Role yang bisa melihat SEMUA data (ADMIN/HO/etc)
        // Silakan sesuaikan list ini dengan value di kolom 'akses' Anda
        const superUserRoles = ['ADMIN', 'HO', 'MANAGEMENT', 'PUSAT'];

        // Jika akses tidak termasuk role super user, kita anggap itu kode Business Area (contoh: 'SMD')
        if (profile?.akses && !superUserRoles.includes(profile.akses)) {
            setUserBaAccess(profile.akses);
            // Paksa filter menjadi akses user tersebut
            setSelectedBusinessAreas([profile.akses]);
        }

        setIsAuthChecking(false); 
        setIsMounted(true); 
        fetchAnalyticsData();
      }
    }
    checkUserAuthentication();

    const handleClickOutsideMenu = (event: MouseEvent) => { 
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutsideMenu); 
    return () => document.removeEventListener("mousedown", handleClickOutsideMenu);
  }, []);

  const fetchAnalyticsData = useCallback(async () => {
    if (isAuthChecking) return;
    setIsLoading(true); 

const getFilterArray = (arr: string[]) => (arr.includes('All') || !arr.length) ? null : arr;
    
    const optionsRpcArgs = { 
      p_year: getFilterArray(selectedYears), 
      p_month: getFilterArray(selectedMonths), 
      p_area: getFilterArray(selectedAreas), 
      p_ba: getFilterArray(selectedBusinessAreas), 
      p_pss: getFilterArray(selectedPSS), 
      p_kat: getFilterArray(selectedKeyAccountTypes),
      p_cust_group: getFilterArray(selectedCustomerGroups), 
      p_product: getFilterArray(selectedProducts), 
      p_cust_name: getFilterArray(selectedCustomerNames),
      p_material: getFilterArray(selectedMaterials),
      p_material_description: getFilterArray(selectedMaterialDescriptions)
    };
    
    const analyticsRpcArgs = { 
      lvl1_field: level1Field, 
      lvl2_field: level2Field, 
      lvl3_field: level3Field, 
      lvl4_field: level4Field, 
      lvl5_field: level5Field,
      lvl6_field: level6Field,
      filter_years: selectedYears, 
      filter_areas: selectedAreas, 
      filter_months: selectedMonths.includes('All') ? [] : selectedMonths.map(m => parseInt(m)), 
      filter_business_areas: selectedBusinessAreas, 
      filter_pss: selectedPSS, 
      filter_key_account_types: selectedKeyAccountTypes, 
      filter_cust_groups: selectedCustomerGroups, 
      filter_products: selectedProducts,
      filter_cust_names: selectedCustomerNames,
      filter_materials: selectedMaterials,
      filter_material_descriptions: selectedMaterialDescriptions
    };

    try {
      const [optionsRes, dataRes, chartRes] = await Promise.all([ 
          supabase.rpc('get_dynamic_filter_options', optionsRpcArgs), 
          supabase.rpc('get_sales_analytics', analyticsRpcArgs), 
          supabase.rpc('get_sales_analytics', analyticsRpcArgs) 
      ]);
      
      if (optionsRes.data) {
        setFilterOptions({ 
          years: optionsRes.data.year, 
          months: mapAvailableMonths(optionsRes.data.month),
          areas: optionsRes.data.area, 
          businessAreas: optionsRes.data.business_area, 
          pss: optionsRes.data.pss, 
          keyAccountTypes: optionsRes.data.key_account_type, 
          products: optionsRes.data.product, 
          customerGroups: optionsRes.data.cust_group, 
          customerNames: optionsRes.data.cust_name,
          materials: optionsRes.data.material,
          materialDescriptions: optionsRes.data.material_description
        });
      }
      
      if (dataRes.data) setSalesData(dataRes.data); 
      if (chartRes.data) setChartData(chartRes.data);

    } catch (e) { 
      console.error("Error fetching data:", e);
    } finally { 
      setIsLoading(false); 
    }
  }, [
    selectedYears, selectedMonths, selectedAreas, selectedBusinessAreas, 
    selectedPSS, selectedKeyAccountTypes, selectedCustomerGroups, 
    selectedProducts, selectedCustomerNames, selectedMaterials, selectedMaterialDescriptions,
    level1Field, level2Field, level3Field, level4Field, level5Field, level6Field,
    supabase, isAuthChecking
  ]);

  useEffect(() => { 
    if (!isAuthChecking) fetchAnalyticsData(); 
  }, [fetchAnalyticsData, isAuthChecking]); 

  useEffect(() => {
    if (sortYear !== 'Total' && !visibleYears.includes(sortYear)) {
      setSortYear('Total');
    }
  }, [visibleYears, sortYear]);

  useEffect(() => setExpandedRows({}), [level1Field, level2Field, level3Field, level4Field, level5Field, level6Field]);

  const handleRefreshDatabase = async () => { 
    if(!confirm("Update Data dari Master?")) return; 
    setIsRefreshing(true); 
    const { error } = await supabase.rpc('refresh_sales_data'); 
    
    if (!error) { 
      await supabase.auth.refreshSession(); 
      alert('Sukses Update DB'); 
      fetchAnalyticsData(); 
    } else {
      alert('Gagal: ' + error.message); 
    }
    setIsRefreshing(false); 
    setIsMenuOpen(false);
  }

  const formatNumber = (n: number) => n ? n.toLocaleString('id-ID') : '-';
  
  const yAxisFormatter = (value: number) => { 
    if (value >= 1000000000) return (value / 1000000000).toFixed(1).replace(/\.0$/, '') + 'M'; 
    if (value >= 1000000) return (value / 1000000).toFixed(0) + 'Jt'; 
    if (value >= 1000) return (value / 1000).toFixed(0) + 'Rb';
    return value.toString(); 
  }

  if (isAuthChecking) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-blue-600" size={32} />
            <span className="text-slate-500 text-xs">Memeriksa Hak Akses...</span>
        </div>
    </div>
  )

  const renderLoadingOverlay = (message: string) => (
    <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-xl transition-all">
      {isRefreshing ? (
         <><RefreshCw className="animate-spin text-emerald-600 dark:text-emerald-400 mb-2" size={32}/><span className="text-xs font-bold text-slate-500 dark:text-slate-400">Updating Database...</span></>
      ) : (
         <><Loader2 className="animate-spin text-blue-600 dark:text-blue-400 mb-2" size={32}/><span className="text-xs font-bold text-slate-500 dark:text-slate-400">{message}</span></>
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-2 md:p-6 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <div className="max-w-400 mx-auto space-y-4">
        
        {/* HEADER & FILTERS */}
        <div 
          onClickCapture={() => setActiveLayer('top')}
          className={`bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 relative transition-colors ${activeLayer === 'top' ? 'z-50' : 'z-40'}`}
        >
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
            <div>
                    <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                        <img src="/favicon.ico" alt="Logo" className="w-8 h-8 rounded"/>  Dashboard Sales
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Dashboard sales untuk memantau performa penjualan dan analisis data terkait.
                    </p>
                </div>
            
            <div className="flex items-center gap-2 relative">
                <button onClick={fetchAnalyticsData} className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-100 dark:border-blue-800" title="Refresh Data">
                  <RefreshCw size={16} className={isLoading ? "animate-spin" : ""}/>
                </button>
                
                <div className="relative" ref={menuRef}>
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`p-2 rounded-full transition-colors ${isMenuOpen ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <MoreVertical size={20} className="text-slate-600 dark:text-slate-300"/>
                    </button>
                    {isMenuOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm md:absolute md:inset-auto md:top-full md:right-0 md:p-0 md:bg-transparent md:backdrop-blur-none md:block md:mt-2">
                            <div className="absolute inset-0 md:hidden" onClick={() => setIsMenuOpen(false)}></div>
                            <div className="relative w-full max-w-xs md:w-64 bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                 <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800 md:hidden bg-slate-50 dark:bg-slate-800/50">
                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200">Menu Opsi</span>
                                    <button onClick={() => setIsMenuOpen(false)} className="p-1 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500 hover:text-red-500 transition-colors"><X size={16} /></button>
                                 </div>
                                 <div className="border-t border-slate-100 dark:border-slate-800 p-2 flex justify-between bg-slate-50 dark:bg-slate-800/50">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center h-full">Tema</div>
                                    <div className="flex bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 p-0.5">
                                        {['light', 'dark', 'system'].map((m: any) => (
                                            <button key={m} onClick={() => setTheme(m)} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${theme === m ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-400'}`}>
                                              {m === 'light' ? <Sun size={12}/> : m === 'dark' ? <Moon size={12}/> : <Laptop size={12}/>}
                                            </button>
                                        ))}
                                    </div>
                                 </div>
                                 <div className="p-1.5 border-b border-slate-100 dark:border-slate-800">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">Customer Issue</div>
                                    <button onClick={() => router.push('/sales-issues')} 
                                    className="flex items-center gap-3 w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors mb-0.5">
                                      <FileWarning size={14} className="text-red-400"/> <span>Input Keluhan Baru</span>
                                    </button>
                                    <button onClick={() => router.push('/summary')} 
                                    className="flex items-center gap-3 w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors">
                                      <LayoutList size={14} className="text-emerald-500"/> <span>Lihat Summary Keluhan</span>
                                    </button>
                                 </div>
                                 <div className="p-1.5">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">System</div>
                                    <button onClick={handleRefreshDatabase} disabled={isRefreshing} 
                                    className="flex items-center gap-3 w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors disabled:opacity-50">
                                      <Database size={14} className="text-purple-500"/> <span>{isRefreshing ? 'Updating...' : 'Update Database'}</span>
                                    </button>
                                    
                                    {/* MODIFIED: HANYA TAMPIL JIKA USER ROLE ADALAH 'HO' */}
                                    {userRole === 'HO' && (
                                      <button onClick={() => router.push('/import-data')} 
                                      className="flex items-center gap-3 w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors mb-0.5">
                                        <Upload size={14} className="text-emerald-500"/> <span>Import Data Master</span>
                                      </button>
                                    )}

                                    <button onClick={() => router.push('/')} 
                                    className="flex items-center gap-3 w-full px-3 py-2 text-xs text-left hover:bg-red-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors">
                                      <LogOut size={14} className="text-blue-500"/> <span>Menu</span>
                                    </button>
                                 </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
          </div>
          
          {/* --- BAGIAN FILTER (UPDATE: Struktur 3 Baris, Layout Dipaksa Tetap 4-4-3 di Mobile) --- */}
          {/* --- BAGIAN FILTER (UPDATE: Lebar Kotak Seragam, Total Baris 3 Lebih Pendek) --- */}
          <div className="flex flex-col gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
             
             {/* STRATEGI:
                 - max-w-3xl : Membuat total lebar lebih pendek (tidak kepanjangan).
                 - grid-cols-4 : Dipakai di SEMUA baris (termasuk baris 3).
                 - Hasilnya : Ukuran per-kotak filter akan sama persis. Baris 3 akan kosong di ujung kanan.
             */}

             {/* BARIS 1: 4 Kolom (Penuh) */}
             <div className="grid grid-cols-4 gap-2 w-full max-w-2xl">
                 <MultiSelect label="Tahun" options={filterOptions.years} selectedValues={selectedYears} onChange={setSelectedYears} />
                 <MultiSelect label="Bulan" rawOptions={filterOptions.months} selectedValues={selectedMonths} onChange={setSelectedMonths} />
                 <MultiSelect label="Area" options={filterOptions.areas} selectedValues={selectedAreas} onChange={setSelectedAreas} />
                 
                 {userBaAccess ? (
                   <div className="flex flex-col w-full">
                     <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 ml-1 mb-0.5 uppercase truncate">
                       Business Area
                     </label>
                     <div className="flex items-center justify-between gap-2 w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm cursor-default overflow-hidden">
                       <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                         {userBaAccess}
                       </span>
                     </div>
                   </div>
                 ) : (
                   <MultiSelect label="Business Area" options={filterOptions.businessAreas} selectedValues={selectedBusinessAreas} onChange={setSelectedBusinessAreas} />
                 )}
             </div>

             {/* BARIS 2: 4 Kolom (Penuh) */}
             <div className="grid grid-cols-4 gap-2 w-full max-w-2xl">
                 <MultiSelect label="Key Account" options={filterOptions.keyAccountTypes} selectedValues={selectedKeyAccountTypes} onChange={setSelectedKeyAccountTypes} />
                 <MultiSelect label="Customer Group" options={filterOptions.customerGroups} selectedValues={selectedCustomerGroups} onChange={setSelectedCustomerGroups} />
                 <MultiSelect label="Customer Name" options={filterOptions.customerNames} selectedValues={selectedCustomerNames} onChange={setSelectedCustomerNames} />
                 <MultiSelect label="PSS" options={filterOptions.pss} selectedValues={selectedPSS} onChange={setSelectedPSS} />
             </div>

             {/* BARIS 3: Tetap pakai grid-cols-4 agar lebar per-item SAMA dengan atasnya */}
             <div className="grid grid-cols-4 gap-2 w-full max-w-2xl">
                 <MultiSelect label="Product" options={filterOptions.products} selectedValues={selectedProducts} onChange={setSelectedProducts} />
                 <MultiSelect label="Material Desc" options={filterOptions.materialDescriptions} selectedValues={selectedMaterialDescriptions} onChange={setSelectedMaterialDescriptions} />
                 <MultiSelect label="Material" options={filterOptions.materials} selectedValues={selectedMaterials} onChange={setSelectedMaterials} />
                 {/* Slot ke-4 dibiarkan kosong agar alignment terjaga */}
             </div>

          </div>
        </div>

        {/* CHART SECTION */}
        {(chartData.length > 0 || isLoading || isRefreshing) && (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative z-30 flex flex-col transition-colors min-h-87.5">
                {(isLoading || isRefreshing) && renderLoadingOverlay("Memuat Chart...")}
                
                <div className="flex items-center justify-between mb-2 border-b border-slate-50 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={18} className="text-indigo-600 dark:text-indigo-400"/>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">SALES PERFORMANCE</span>
                  </div>
                </div>

                <div className="h-80 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                      <XAxis dataKey="name" tick={{fontSize: 11, fill: isDarkMode ? '#94a3b8' : '#64748b'}} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={yAxisFormatter} tick={{fontSize:10, fill: isDarkMode ? '#94a3b8' : '#64748b'}} axisLine={false} tickLine={false} width={40} />
                      <Tooltip cursor={{fill: isDarkMode ? '#1e293b' : '#f8fafc'}} content={<ChartTooltip />} />
                      {MONTH_OPTIONS.map((m, i) => (
                        <Bar key={m.value} dataKey={m.value} name={m.label} stackId="a" fill={MONTH_COLORS[i]} barSize={40} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
            </div>
        )}

        {/* HIERARCHY CONTROLS */}
        <div 
           onClickCapture={() => setActiveLayer('hier')}
           className={`bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center gap-3 relative transition-colors ${activeLayer === 'hier' ? 'z-50' : 'z-40'}`}
        >
           {/* BARIS ATAS: SORTING & ZOOM */}
           {/* Saya gunakan justify-end dan grouping agar Sort ada di kiri Zoom, tapi tetap di sisi kanan layout */}
           <div className="w-full flex flex-col md:flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-1 gap-3">
              
              {/* Spacer Kiri (Agar controls terdorong ke kanan) */}
              <div className="hidden md:block"></div> 

              <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                  
                  {/* --- SORTING CONTROLS (DI SEBELAH KIRI ZOOM) --- */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase hidden sm:inline">Sort:</span>
                    
                    {/* Toggle Nama / Amount */}
                    <div className="flex bg-slate-50 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 p-0.5">
                        <button 
                            onClick={() => setSortBy('name')}
                            className={`px-2 py-1 text-[10px] font-bold rounded flex items-center gap-1 transition-all ${sortBy === 'name' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            title="Urutkan berdasarkan Nama"
                        >
                            <ArrowDownAZ size={12}/> <span className="hidden sm:inline">Nama</span>
                        </button>
                        <button 
                            onClick={() => setSortBy('value')}
                            className={`px-2 py-1 text-[10px] font-bold rounded flex items-center gap-1 transition-all ${sortBy === 'value' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            title="Urutkan berdasarkan Amount"
                        >
                            <ArrowDown01 size={12}/> <span className="hidden sm:inline">Amount</span>
                        </button>
                    </div>

                    {/* --- DROPDOWN TAHUN (HANYA MUNCUL JIKA SORT BY AMOUNT & ADA LEBIH DARI 1 TAHUN) --- */}
                    {sortBy === 'value' && visibleYears.length > 1 && (
                      <div className="relative">
                        <select 
                          value={sortYear}
                          onChange={(e) => setSortYear(e.target.value)}
                          className="appearance-none pl-2 pr-6 py-1 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="Total">Total (All)</option>
                          {visibleYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                        <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                      </div>
                    )}
                    
                    {/* Toggle Asc / Desc */}
                    <button 
                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                        title={sortOrder === 'asc' ? "Terkecil ke Terbesar" : "Terbesar ke Terkecil"}
                    >
                        {sortOrder === 'asc' ? <SortAsc size={14}/> : <SortDesc size={14}/>}
                    </button>
                  </div>

                  {/* Separator Kecil */}
                  <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

                  {/* --- ZOOM CONTROLS (ASLI - TIDAK DIUBAH INTERNYA) --- */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase sm:flex"><Maximize size={14}/><span>Zoom</span></div>
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                        <button onClick={() => setZoomLevel(p => Math.max(0.4, Number((p - 0.1).toFixed(1))))} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex justify-center active:scale-90"><ZoomOut size={14}/></button>
                        <input type="range" min="0.4" max="1.5" step="0.1" value={zoomLevel} onChange={e => setZoomLevel(parseFloat(e.target.value))} className="w-20 md:w-32 h-1 bg-slate-300 dark:bg-slate-600 rounded-lg appearance-none accent-blue-600"/>
                        <button onClick={() => setZoomLevel(p => Math.min(1.5, Number((p + 0.1).toFixed(1))))} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex justify-center active:scale-90"><ZoomIn size={14}/></button>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 w-8 text-right font-bold">{(zoomLevel * 100).toFixed(0)}%</span>
                    </div>
                  </div>

              </div>
           </div>
           
           <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 w-full">
             <DimensionSelectBox label="Level 1" value={level1Field} onChange={setLevel1Field} options={HIERARCHY_OPTIONS} />
             <DimensionSelectBox label="Level 2" value={level2Field} onChange={setLevel2Field} options={HIERARCHY_OPTIONS} />
             <DimensionSelectBox label="Level 3" value={level3Field} onChange={setLevel3Field} options={HIERARCHY_OPTIONS} />
             <DimensionSelectBox label="Level 4" value={level4Field} onChange={setLevel4Field} options={HIERARCHY_OPTIONS} />
             <DimensionSelectBox label="Level 5" value={level5Field} onChange={setLevel5Field} options={HIERARCHY_OPTIONS} />
             <DimensionSelectBox label="Level 6" value={level6Field} onChange={setLevel6Field} options={HIERARCHY_OPTIONS} />
           </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[65vh] md:h-[70vh] relative z-20 transition-colors">
          {(isLoading || isRefreshing) && renderLoadingOverlay("Memuat Data Table...")}
          
          <div className="overflow-auto flex-1 relative w-full">
            <div style={{ fontSize: `${14 * zoomLevel}px` }} className="min-w-full inline-block align-top transition-all duration-200">
              <table className="w-full border-collapse leading-normal text-slate-600 dark:text-slate-400">
                
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 sticky top-0 z-20 shadow-sm">
                  <tr>
                    <th className="p-3 text-left font-bold border-b border-r border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 sticky left-0 z-30 min-w-[8em]">HIERARKI</th>
                    {pivotData.colKeys.map(key => { 
                      const info = getHeaderInfo(key);
                      const showExpand = info.type === 'year' || info.type === 'subtotal';
                      const bgClass = info.type === 'year' 
                        ? 'bg-slate-100 dark:bg-slate-800' 
                        : info.type === 'subtotal' 
                          ? 'bg-slate-200 dark:bg-slate-700 border-l dark:border-l-slate-600' 
                          : 'bg-white dark:bg-slate-900 font-normal text-slate-500 dark:text-slate-500';
                      
                      return (
                        <th key={key} className={`p-2 text-center font-bold border-b border-slate-300 dark:border-slate-600 min-w-[6em] ${bgClass}`}>
                          <div className="flex items-center justify-center gap-1">
                            {showExpand && (
                              <button onClick={() => setExpandedCols(prev => ({ ...prev, [info.parent]: !prev[info.parent] }))} className="hover:text-blue-600 dark:hover:text-blue-400">
                                {expandedCols[info.parent] ? <MinusSquare size="1.2em" className="text-red-500 dark:text-red-400"/> : <PlusSquare size="1.2em" className="text-blue-600 dark:text-blue-400"/>}
                              </button>
                            )}
                            {info.label}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleRows.length > 0 ? visibleRows.map(node => (
                    <tr key={node.id} className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group">
                      <td className="p-2 font-medium text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 sticky left-0 z-10 whitespace-nowrap">
                        <div className="flex items-center gap-[0.5em]" style={{ paddingLeft: `${node.level * 1.5}em` }}>
                          {!node.isLeaf ? (
                            <button onClick={() => setExpandedRows(prev => ({ ...prev, [node.id]: !prev[node.id] }))} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400">
                              {expandedRows[node.id] ? <MinusSquare size="1.2em"/> : <PlusSquare size="1.2em"/>}
                            </button>
                          ) : <span style={{ width: '1.2em' }}/>}
                          
                          <span className={`${node.isLeaf ? "text-slate-600 dark:text-slate-400" : "font-bold text-slate-800 dark:text-slate-200"} ${node.label.startsWith('No ') ? 'text-red-500 dark:text-red-400 italic' : ''}`}>
                            {node.label}
                          </span>
                        </div>
                      </td>

                      {pivotData.colKeys.map(key => { 
                        const value = node.values[key] || 0;
                        const info = getHeaderInfo(key);
                        const isSubtotal = info.type === 'subtotal';
                        
                        const prevKey = getDynamicPrevKey(key, info);
                        let prevValue = (prevKey && node.values[prevKey]) ? node.values[prevKey] : 0;

                        if (isSubtotal && prevValue === 0 && prevKey) {
                          const rawPrevYear = prevKey.split('-')[0]; 
                          prevValue = node.values[rawPrevYear] || 0;
                        }

                        const cellBackground = isSubtotal 
                          ? 'bg-slate-50 dark:bg-slate-800/50 font-bold border-l border-slate-200 dark:border-slate-700' 
                          : '';

                        return (
                          <td key={key} className={`p-2 text-right border-r border-slate-100 dark:border-slate-800 align-top ${cellBackground}`}>
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={value ? 'text-slate-900 dark:text-slate-200' : 'text-slate-300 dark:text-slate-700 font-mono'}>
                                {formatNumber(value)}
                              </span>
                              {prevValue > 0 && <YearOverYearBadge current={value} previous={prevValue}/>}
                            </div>
                          </td>
                        ) 
                      })}
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={20} className="p-12 text-center text-slate-400 dark:text-slate-500">
                        <Filter size={24} className="mx-auto mb-2"/>Data tidak ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>

                <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200 sticky bottom-0 z-30 shadow-sm">
                  <tr>
                    <td className="p-3 sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 border-t border-r border-slate-300 dark:border-slate-600">GRAND TOTAL</td>
                    {pivotData.colKeys.map(key => { 
                      const info = getHeaderInfo(key);
                      const total = pivotData.colTotals[key] || 0;
                      
                      const prevKey = getDynamicPrevKey(key, info);
                      let prevTotal = (prevKey && pivotData.colTotals[prevKey]) ? pivotData.colTotals[prevKey] : 0;

                      if (info.type === 'subtotal' && prevTotal === 0 && prevKey) {
                        const rawPrevYear = prevKey.split('-')[0];
                        prevTotal = pivotData.colTotals[rawPrevYear] || 0;
                      }

                      return (
                        <td key={key} className={`p-3 text-right border-t border-r border-slate-200 dark:border-slate-700 ${info.type === 'subtotal' ? 'bg-slate-200 dark:bg-slate-700' : ''}`}>
                          <div className="flex flex-col items-end justify-between h-full gap-0.5 min-h-[2.5em]">
                            <span className="font-mono">{formatNumber(total)}</span>
                            {prevTotal > 0 ? <YearOverYearBadge current={total} previous={prevTotal}/> : <div className="h-[1em]"></div>}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
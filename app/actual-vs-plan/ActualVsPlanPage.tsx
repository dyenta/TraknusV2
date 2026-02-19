'use client'

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { 
  RefreshCw, Filter, MinusSquare, PlusSquare, 
  Database, ArrowUp, ArrowDown, ChevronDown, Check, ZoomIn, 
  ZoomOut, Maximize, Search, X, BarChart3, LogOut, Sun, Upload,
  Moon, Laptop, Loader2, MoreVertical, FileWarning, LayoutList,
  ArrowDownAZ, ArrowDown01, SortAsc, SortDesc, Download, Target,
  BarChart2, LayoutGrid,
  Truck
} from 'lucide-react'
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts'
import { useTheme } from '../components/ThemeProvider'

// ==========================================
// TYPES & CONSTANTS
// ==========================================

interface RawData {
  year_val: number
  month_val: number
  col_label_1: string
  col_label_2: string
  col_label_3: string
  col_label_4: string
  col_label_5: string
  col_label_6: string
  plan_amount: number
  actual_amount: number
  variance: number
  achievement_percentage: number
}

interface PivotNode {
  id: string;
  label: string;
  level: number;
  isLeaf: boolean;
  plan: number;
  actual: number;
  children?: PivotNode[];
  childMap?: Record<string, PivotNode>;
}

const HIERARCHY_OPTIONS = [
  { label: '(None)', value: '' },
  { label: 'Business Area', value: 'business_area' },
  { label: 'PSS', value: 'pss' },
  { label: 'Key Account Type', value: 'key_account_type' },
  { label: 'Customer Group', value: 'cust_group' },
  { label: 'Customer Name', value: 'cust_name' },
  { label: 'Product', value: 'product' },
  { label: 'Area', value: 'area' }
]

const MONTH_OPTIONS = [
  { label: 'Jan', value: '1' }, { label: 'Feb', value: '2' }, 
  { label: 'Mar', value: '3' }, { label: 'Apr', value: '4' }, 
  { label: 'Mei', value: '5' }, { label: 'Jun', value: '6' }, 
  { label: 'Jul', value: '7' }, { label: 'Agu', value: '8' }, 
  { label: 'Sep', value: '9' }, { label: 'Okt', value: '10' }, 
  { label: 'Nov', value: '11' }, { label: 'Des', value: '12' }
]

// ==========================================
// HELPER COMPONENTS
// ==========================================

const AchievementBadge = ({ plan, actual }: { plan: number, actual: number }) => {
  if (plan === 0 && actual === 0) return <span className="text-[9px] text-slate-300 dark:text-slate-600">-</span>;
  
  const ach = plan === 0 ? (actual > 0 ? 999 : 0) : (actual / plan) * 100;
  
  const colorClass = ach >= 100 
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
    : ach >= 80
      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
      : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800';

  return (
    <div className={`flex items-center gap-[0.2em] text-[0.7em] font-bold px-[0.5em] rounded-full border shadow-sm ${colorClass}`}>
      {ach >= 100 ? (
        <ArrowUp className="w-[0.8em] h-[0.8em]" />
      ) : (
        <ArrowDown className="w-[0.8em] h-[0.8em]" />
      )}
      <span>{Math.min(ach, 999).toFixed(1)}%</span>
    </div>
  )
}

const DimensionSelectBox = ({ label, value, onChange, options, disabled }: any) => {
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
    <div className={`flex flex-col w-full relative ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} ref={containerRef}>
      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 ml-1 mb-0.5 uppercase">
        {label}
      </label>
      <button 
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)} 
        className={`flex items-center justify-between gap-2 w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded-md shadow-sm transition-colors text-left 
          ${isOpen ? 'border-blue-500 ring-1 ring-blue-500 dark:border-blue-400' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}
          ${disabled ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 pointer-events-none' : ''} 
          `}> 
        <span className="truncate font-medium text-slate-700 dark:text-slate-200">{selectedLabel}</span>
        <ChevronDown size={14} className="text-slate-400 shrink-0" />
      </button>
      
      {isOpen && !disabled && (
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
                  <div className={`w-3 h-3 rounded border flex items-center justify-center ${isAddToSelectionMode ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
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
    const planVal = payload.find((p: any) => p.dataKey === 'plan')?.value || 0;
    const actualVal = payload.find((p: any) => p.dataKey === 'actual')?.value || 0;
    const variance = actualVal - planVal;
    const ach = planVal === 0 ? 0 : (actualVal / planVal) * 100;
    const isAchieved = actualVal >= planVal;

    return (
      <div className="bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-800 shadow-xl rounded-lg text-[10px] z-50 min-w-40">
        <div className="font-bold text-slate-700 dark:text-slate-200 mb-1.5 border-b border-slate-100 dark:border-slate-800 pb-1">{label}</div>
        <div className="flex flex-col gap-1 mb-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              <span className="text-slate-500 dark:text-slate-400">Plan</span>
            </div>
            <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">{planVal.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isAchieved ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
              <span className="text-slate-500 dark:text-slate-400">Actual</span>
            </div>
            <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">{actualVal.toLocaleString('id-ID')}</span>
          </div>
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 space-y-1">
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded">
            <span className="text-slate-500 dark:text-slate-400 font-bold">VAR</span>
            <span className={`font-mono font-bold ${variance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {variance >= 0 ? '+' : ''}{variance.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded">
            <span className="text-slate-500 dark:text-slate-400 font-bold">ACH</span>
            <span className={`font-mono font-bold ${ach >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {ach.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

// ==========================================
// LOGIC HOOKS
// ==========================================

function usePivotTreeData({ data, expandedRows, activeLevels, sortBy, sortOrder }: any) {
  return useMemo(() => {
    const rootMap: Record<string, PivotNode> = {};

    for (const item of data) {
      const plan = item.plan_amount || 0;
      const actual = item.actual_amount || 0;

      const levels: string[] = activeLevels.map((lvlField: string, idx: number) => {
        const value = (item as any)[`col_label_${idx + 1}`];
        return (!value || String(value).trim() === '') 
          ? `No ${lvlField.replace(/_/g, ' ')}` 
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
            plan: 0,
            actual: 0,
            childMap: {}
          };
        }

        const node = currentMap[levelLabel];
        node.plan += plan;
        node.actual += actual;

        if (!node.isLeaf) {
          if (!node.childMap) node.childMap = {};
          currentMap = node.childMap;
        }
      });
    }

    const processMapToNodes = (map: any): PivotNode[] => {
      return Object.values(map)
        .sort((a: any, b: any) => {
           if (sortBy === 'actual') {
             return sortOrder === 'asc' 
               ? a.actual - b.actual 
               : b.actual - a.actual;
           } else if (sortBy === 'plan') {
             return sortOrder === 'asc' 
               ? a.plan - b.plan 
               : b.plan - a.plan;
           } else {
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

    const rowRoots = processMapToNodes(rootMap); 

    const visibleRows: PivotNode[] = [];
    const traverseAndCollectVisible = (nodes: PivotNode[]) => {
      nodes.forEach(node => {
        visibleRows.push(node);
        if (node.children && expandedRows[node.id]) {
          traverseAndCollectVisible(node.children);
        }
      });
    };

    traverseAndCollectVisible(rowRoots);

    // Grand totals
    const grandPlan = data.reduce((sum: number, d: any) => sum + (d.plan_amount || 0), 0);
    const grandActual = data.reduce((sum: number, d: any) => sum + (d.actual_amount || 0), 0);

    return { 
      rowRoots,
      visibleRows, 
      grandPlan,
      grandActual
    };
  }, [data, expandedRows, activeLevels, sortBy, sortOrder]);
}

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================

export default function ActualVsPlanPage() {
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
  const [sortBy, setSortBy] = useState<'name' | 'actual' | 'plan'>('actual');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [userBaAccess, setUserBaAccess] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [rawData, setRawData] = useState<RawData[]>([]);
  
  const [filterOptions, setFilterOptions] = useState<{
    years: any[], months: any[], areas: any[], businessAreas: any[], 
    pss: any[], keyAccountTypes: any[], products: any[], 
    customerGroups: any[], customerNames: any[]
  }>({
    years: [], months: [], areas: [], businessAreas: [], 
    pss: [], keyAccountTypes: [], products: [], 
    customerGroups: [], customerNames: []
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

  // VIEW STATE
  const [level1Field, setLevel1Field] = useState('key_account_type');
  const [level2Field, setLevel2Field] = useState('');
  const [level3Field, setLevel3Field] = useState('');
  const [level4Field, setLevel4Field] = useState('');
  const [level5Field, setLevel5Field] = useState('');
  const [level6Field, setLevel6Field] = useState('');
  
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [zoomLevel, setZoomLevel] = useState(1);

  // COMPUTED
  const isDarkMode = isMounted && (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
  
  const activeHierarchyLevels = useMemo(() => 
    [level1Field, level2Field, level3Field, level4Field, level5Field, level6Field].filter(l => l !== ''),
    [level1Field, level2Field, level3Field, level4Field, level5Field, level6Field]
  );

  const { rowRoots, visibleRows, grandPlan, grandActual } = usePivotTreeData({ 
    data: rawData, 
    expandedRows, 
    activeLevels: activeHierarchyLevels,
    sortBy,
    sortOrder
  });

  const grandVariance = grandActual - grandPlan;
  const grandAch = grandPlan === 0 ? 0 : (grandActual / grandPlan) * 100;

  // Chart data: Actual vs Plan per month
  const chartData = useMemo(() => {
    const map: Record<string, { name: string, plan: number, actual: number }> = {};
    rawData.forEach(item => {
      const monthKey = String(item.month_val);
      const monthLabel = MONTH_OPTIONS.find(m => m.value === monthKey)?.label || monthKey;
      if (!map[monthKey]) map[monthKey] = { name: monthLabel, plan: 0, actual: 0 };
      map[monthKey].plan += (item.plan_amount || 0);
      map[monthKey].actual += (item.actual_amount || 0);
    });
    return Object.entries(map)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([, v]) => v);
  }, [rawData]);

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
      
      if (profile) setUserRole(profile.akses);

      if (profile?.akses === 'CUSTOMER') {
        router.push('/') 
      } else {
        const superUserRoles = ['ADMIN', 'HO', 'MANAGEMENT', 'PUSAT'];
        if (profile?.akses && !superUserRoles.includes(profile.akses)) {
            setUserBaAccess(profile.akses);
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

  const fetchFilterOptions = useCallback(async () => {
    // === HELPER: Semua filter definitions ===
    const allFilters: Record<string, { selected: string[], column: string, isNumeric?: boolean }> = {
      year: { selected: selectedYears, column: 'year', isNumeric: true },
      month: { selected: selectedMonths, column: 'month', isNumeric: true },
      area: { selected: selectedAreas, column: 'area' },
      business_area: { selected: selectedBusinessAreas, column: 'business_area' },
      pss: { selected: selectedPSS, column: 'pss' },
      key_account_type: { selected: selectedKeyAccountTypes, column: 'key_account_type' },
      cust_group: { selected: selectedCustomerGroups, column: 'cust_group' },
      product: { selected: selectedProducts, column: 'product' },
      cust_name: { selected: selectedCustomerNames, column: 'cust_name' },
    };

    // === HELPER: Build query untuk satu filter, EXCLUDE dirinya sendiri ===
    const buildQueryFor = (excludeKey: string) => {
      let q = supabase
        .from('mv_actual_vs_plan')
        .select(allFilters[excludeKey].column);

      // Terapkan semua filter KECUALI yang di-exclude
      for (const [key, f] of Object.entries(allFilters)) {
        if (key === excludeKey) continue; // Skip filter sendiri
        if (!f.selected.includes('All') && f.selected.length > 0) {
          q = q.in(f.column, f.isNumeric ? f.selected.map(Number) : f.selected);
        }
      }
      return q.limit(100000);
    };

    // === Jalankan semua query secara paralel ===
    const [
      yearRes, monthRes, areaRes, baRes, pssRes,
      katRes, cgRes, prodRes, cnRes
    ] = await Promise.all([
      buildQueryFor('year'),
      buildQueryFor('month'),
      buildQueryFor('area'),
      buildQueryFor('business_area'),
      buildQueryFor('pss'),
      buildQueryFor('key_account_type'),
      buildQueryFor('cust_group'),
      buildQueryFor('product'),
      buildQueryFor('cust_name'),
    ]);

    const uniqueSorted = (data: any[], key: string): any[] => {
      if (!data || data.length === 0) return [];
      const vals = [...new Set(data.map((d: any) => d[key]))]
        .filter(v => v != null && String(v).trim() !== '');
      return vals.sort((a: any, b: any) => String(a).localeCompare(String(b), undefined, { numeric: true }));
    };

    setFilterOptions({
      years: uniqueSorted(yearRes.data || [], 'year'),
      months: mapAvailableMonths(uniqueSorted(monthRes.data || [], 'month')),
      areas: uniqueSorted(areaRes.data || [], 'area'),
      businessAreas: uniqueSorted(baRes.data || [], 'business_area'),
      pss: uniqueSorted(pssRes.data || [], 'pss'),
      keyAccountTypes: uniqueSorted(katRes.data || [], 'key_account_type'),
      products: uniqueSorted(prodRes.data || [], 'product'),
      customerGroups: uniqueSorted(cgRes.data || [], 'cust_group'),
      customerNames: uniqueSorted(cnRes.data || [], 'cust_name'),
    });
  }, [
    selectedYears, selectedMonths, selectedAreas, selectedBusinessAreas,
    selectedPSS, selectedKeyAccountTypes, selectedCustomerGroups,
    selectedProducts, selectedCustomerNames, supabase
  ]);

  const fetchAnalyticsData = useCallback(async () => {
    if (isAuthChecking) return;
    setIsLoading(true); 

    // Fetch actual vs plan data
    const dataParams = {
      filter_years: selectedYears,
      filter_months: selectedMonths,
      filter_areas: selectedAreas,
      filter_business_areas: selectedBusinessAreas,
      filter_pss: selectedPSS,
      filter_products: selectedProducts,
      filter_cust_names: selectedCustomerNames,
      filter_key_account_types: selectedKeyAccountTypes,
      filter_cust_groups: selectedCustomerGroups,
      lvl1_field: level1Field || null,
      lvl2_field: level2Field || null,
      lvl3_field: level3Field || null,
      lvl4_field: level4Field || null,
      lvl5_field: level5Field || null,
      lvl6_field: level6Field || null,
    };

    try {
      // Jalankan filter options & data secara paralel
      const [, dataRes] = await Promise.all([
        fetchFilterOptions(),
        supabase.rpc('get_actual_vs_plan', dataParams),
      ]);
      
      if (dataRes.error) console.error('Data RPC error:', dataRes.error);
      if (dataRes.data) setRawData(dataRes.data);

    } catch (e) { 
      console.error("Error fetching data:", e);
    } finally { 
      setIsLoading(false); 
    }
  }, [
    selectedYears, selectedMonths, selectedAreas, selectedBusinessAreas, 
    selectedPSS, selectedKeyAccountTypes, selectedCustomerGroups, 
    selectedProducts, selectedCustomerNames,
    level1Field, level2Field, level3Field, level4Field, level5Field, level6Field,
    supabase, isAuthChecking, fetchFilterOptions
  ]);

  useEffect(() => { 
    if (!isAuthChecking) fetchAnalyticsData(); 
  }, [fetchAnalyticsData, isAuthChecking]); 

  useEffect(() => setExpandedRows({}), [level1Field, level2Field, level3Field, level4Field, level5Field, level6Field]);

  const handleRefreshDatabase = async () => { 
    if(!confirm("Update Data dari Master?")) return; 
    setIsRefreshing(true); 
    const { error } = await supabase.rpc('refresh_plan_data'); 
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

  // EXPORT EXCEL
  const handleExportExcel = async () => {
    if (!rowRoots || rowRoots.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Actual vs Plan');

    worksheet.properties.outlineProperties = { 
      summaryBelow: false, 
      summaryRight: false 
    };

    // Flatten tree
    const getAllFlatRows = (nodes: PivotNode[]): PivotNode[] => {
      let flatList: PivotNode[] = [];
      nodes.forEach(node => {
        flatList.push(node);
        if (node.children && node.children.length > 0) {
          flatList = flatList.concat(getAllFlatRows(node.children));
        }
      });
      return flatList;
    };
    const allRows = getAllFlatRows(rowRoots);

    const tableColumns = [
      { name: 'HIERARKI DATA', totalsRowLabel: 'GRAND TOTAL', filterButton: true },
      { name: 'PLAN', totalsRowFunction: 'custom' as const, filterButton: true },
      { name: 'ACTUAL', totalsRowFunction: 'custom' as const, filterButton: true },
      { name: 'VARIANCE', totalsRowFunction: 'custom' as const, filterButton: true },
      { name: 'ACH %', totalsRowFunction: 'custom' as const, filterButton: true },
    ];

    const tableRows: any[][] = [];
    const rowMetadata: { level: number, isParent: boolean }[] = [];

    allRows.forEach(node => {
      const variance = node.actual - node.plan;
      const ach = node.plan === 0 ? 0 : (node.actual / node.plan);
      tableRows.push([node.label, node.plan, node.actual, variance, ach]);
      rowMetadata.push({ level: node.level, isParent: !!(node.children && node.children.length > 0) });
    });

    worksheet.addTable({
      name: 'PivotTable',
      ref: 'A1',
      headerRow: true,
      totalsRow: true,
      style: { theme: 'TableStyleLight1', showRowStripes: false },
      columns: tableColumns,
      rows: tableRows,
    });

    // Header styling
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Body styling
    rowMetadata.forEach((meta, index) => {
      const rowIndex = index + 2;
      const row = worksheet.getRow(rowIndex);
      row.outlineLevel = meta.level; 
      if (meta.level > 0) row.hidden = true;
      row.getCell(1).alignment = { indent: meta.level + 1, vertical: 'middle' };

      if (meta.isParent) {
        row.font = { bold: true };
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; 
      } else {
        row.font = { color: { argb: 'FF334155' } };
        row.fill = { type: 'pattern', pattern: 'none' }; 
      }

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        if (colNum === 1) return;
        if (colNum <= 3) { // Plan, Actual
          cell.numFmt = '#,##0';
        } else if (colNum === 4) { // Variance
          cell.numFmt = '#,##0';
          const val = cell.value as number;
          if (val < 0) cell.font = { color: { argb: 'FFFF0000' }, italic: true };
          else if (val > 0) cell.font = { color: { argb: 'FF008000' }, italic: true };
        } else if (colNum === 5) { // Ach %
          cell.numFmt = '0.0%';
          const val = cell.value as number;
          if (val >= 1) cell.font = { color: { argb: 'FF008000' }, bold: true };
          else cell.font = { color: { argb: 'FFFF0000' }, italic: true };
        }
      });
    });

    // Grand total row
    const totalRowIndex = worksheet.rowCount;
    const totalRow = worksheet.getRow(totalRowIndex);
    totalRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.getCell(2).value = grandPlan; totalRow.getCell(2).numFmt = '#,##0';
    totalRow.getCell(3).value = grandActual; totalRow.getCell(3).numFmt = '#,##0';
    totalRow.getCell(4).value = grandVariance; totalRow.getCell(4).numFmt = '#,##0';
    totalRow.getCell(5).value = grandPlan === 0 ? 0 : grandActual / grandPlan; totalRow.getCell(5).numFmt = '0.0%';

    totalRow.eachCell(cell => {
      cell.border = {
        top: { style: 'double', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF334155' } }
      };
    });

    worksheet.columns.forEach((col, idx) => {
      if (idx === 0) col.width = 45;
      else col.width = 18;
    });
    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Actual_vs_Plan_${new Date().toISOString().slice(0,10)}.xlsx`);
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
        
        {/* ============================================ */}
        {/* HEADER & FILTERS                            */}
        {/* ============================================ */}
        <div 
          onClickCapture={() => setActiveLayer('top')}
          className={`bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 relative transition-colors ${activeLayer === 'top' ? 'z-50' : 'z-40'}`}
        >
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                <img src="/favicon.ico" alt="Logo" className="w-8 h-8 rounded"/> Dashboard Actual vs Plan
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Dashboard perbandingan realisasi (actual) terhadap target (plan) penjualan.
              </p>
            </div>
            
            <div className="flex items-center gap-2 relative">
              <button onClick={fetchAnalyticsData} className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-100 dark:border-blue-800" title="Refresh Data">
                <RefreshCw size={16} className={isLoading ? "animate-spin" : ""}/>
              </button>
              
              {/* MENU OPSI */}
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
                        <button onClick={() => router.push('/sales')} 
                          className="flex items-center gap-3 w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors mb-0.5">
                          <LayoutGrid size={14} className="text-blue-500"/> <span>Sales Analytics</span>
                        </button>
                        <button onClick={() => router.push('/otif')} 
                          className="flex items-center gap-3 w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors mb-0.5">
                          <Truck size={14} className="text-purple-500"/> <span>OTIF Analytics</span>
                        </button>
                      </div>
                      <div className="p-1.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">System</div>
                        <button onClick={handleRefreshDatabase} disabled={isRefreshing} 
                          className="flex items-center gap-3 w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors disabled:opacity-50">
                          <Database size={14} className="text-purple-500"/> <span>{isRefreshing ? 'Updating...' : 'Update Database'}</span>
                        </button>
                        {userRole === 'HO' && (
                          <button onClick={() => router.push('/import-plan')} 
                          className="flex items-center gap-3 w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors mb-0.5">
                          <Upload size={14} className="text-emerald-500"/> <span>Import Data Plan</span>
                          </button>
                        )}

                        <button onClick={() => router.push('/')} 
                          className="flex items-center gap-3 w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors">
                          <LogOut size={14} className="text-blue-500"/> <span>Menu</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* FILTER SECTION - Same 3 Row Grid Layout as SalesPage */}
          <div className="flex flex-col gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* BARIS 1: 4 Kolom */}
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

            {/* BARIS 2: 4 Kolom */}
            <div className="grid grid-cols-4 gap-2 w-full max-w-2xl">
              <MultiSelect label="Key Account" options={filterOptions.keyAccountTypes} selectedValues={selectedKeyAccountTypes} onChange={setSelectedKeyAccountTypes} />
              <MultiSelect label="Customer Group" options={filterOptions.customerGroups} selectedValues={selectedCustomerGroups} onChange={setSelectedCustomerGroups} />
              <MultiSelect label="Customer Name" options={filterOptions.customerNames} selectedValues={selectedCustomerNames} onChange={setSelectedCustomerNames} />
              <MultiSelect label="PSS" options={filterOptions.pss} selectedValues={selectedPSS} onChange={setSelectedPSS} />
            </div>

            {/* BARIS 3: Product only */}
            <div className="grid grid-cols-4 gap-2 w-full max-w-2xl">
              <MultiSelect label="Product" options={filterOptions.products} selectedValues={selectedProducts} onChange={setSelectedProducts} />
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* CHART SECTION: Actual vs Plan per Bulan     */}
        {/* ============================================ */}
        {(chartData.length > 0 || isLoading || isRefreshing) && (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative z-30 flex flex-col transition-colors min-h-87.5">
            {(isLoading || isRefreshing) && renderLoadingOverlay("Memuat Chart...")}
            
            <div className="flex items-center justify-between mb-2 border-b border-slate-50 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-indigo-600 dark:text-indigo-400"/>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">ACTUAL vs PLAN PER BULAN</span>
              </div>
              {/* Summary badges */}
              <div className="hidden md:flex items-center gap-3 text-[10px]">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-full border border-indigo-100 dark:border-indigo-800">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  <span className="text-indigo-700 dark:text-indigo-300 font-bold">Plan: {formatNumber(grandPlan)}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-full border border-emerald-100 dark:border-emerald-800">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold">Actual: {formatNumber(grandActual)}</span>
                </div>
                <div className={`px-2 py-1 rounded-full border font-bold ${grandAch >= 100 ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300' : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300'}`}>
                  Ach: {grandAch.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="h-80 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                  <XAxis dataKey="name" tick={{fontSize: 11, fill: isDarkMode ? '#94a3b8' : '#64748b'}} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={yAxisFormatter} tick={{fontSize:10, fill: isDarkMode ? '#94a3b8' : '#64748b'}} axisLine={false} tickLine={false} width={40} />
                  <Tooltip cursor={{fill: isDarkMode ? '#1e293b' : '#f8fafc'}} content={<ChartTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    height={30}
                    content={() => (
                      <div className="flex items-center justify-center gap-5 text-xs mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></div>
                          <span className="text-slate-600 dark:text-slate-300 font-medium">Plan</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex gap-0.5">
                            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></div>
                            <div className="w-2.5 h-2.5 rounded-sm bg-amber-500"></div>
                          </div>
                          <span className="text-slate-600 dark:text-slate-300 font-medium">Actual <span className="text-[9px] text-slate-400">(≥Plan / &lt;Plan)</span></span>
                        </div>
                      </div>
                    )}
                  />
                  <Bar dataKey="plan" name="Plan" fill={isDarkMode ? '#818cf8' : '#6366f1'} barSize={30} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name="Actual" barSize={30} radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.actual >= entry.plan ? (isDarkMode ? '#34d399' : '#10b981') : (isDarkMode ? '#fb923c' : '#f59e0b')}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* HIERARCHY CONTROLS                          */}
        {/* ============================================ */}
        <div 
          onClickCapture={() => setActiveLayer('hier')}
          className={`bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center gap-3 relative transition-colors ${activeLayer === 'hier' ? 'z-50' : 'z-40'}`}
        >
          {/* TOP ROW: SORTING & ZOOM */}
          <div className="w-full flex flex-col md:flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-1 gap-3">
            <div className="flex items-center gap-2 w-full md:w-auto mb-2 md:mb-0">
              <div className="text-indigo-600 dark:text-indigo-400">
                <LayoutList size={18} />
              </div>
              <span className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                Hierarchy Controls
              </span>
            </div>
            <div className="hidden md:block"></div> 

            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
              
              {/* SORTING CONTROLS */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase hidden sm:inline">Sort:</span>
                
                <div className="flex bg-slate-50 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 p-0.5">
                  <button 
                    onClick={() => setSortBy('name')}
                    className={`px-2 py-1 text-[10px] font-bold rounded flex items-center gap-1 transition-all ${sortBy === 'name' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    title="Urutkan berdasarkan Nama"
                  >
                    <ArrowDownAZ size={12}/> <span className="hidden sm:inline">Nama</span>
                  </button>
                  <button 
                    onClick={() => setSortBy('plan')}
                    className={`px-2 py-1 text-[10px] font-bold rounded flex items-center gap-1 transition-all ${sortBy === 'plan' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    title="Urutkan berdasarkan Plan Amount"
                  >
                    <ArrowDown01 size={12}/> <span className="hidden sm:inline">Plan</span>
                  </button>
                  <button 
                    onClick={() => setSortBy('actual')}
                    className={`px-2 py-1 text-[10px] font-bold rounded flex items-center gap-1 transition-all ${sortBy === 'actual' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    title="Urutkan berdasarkan Actual Amount"
                  >
                    <ArrowDown01 size={12}/> <span className="hidden sm:inline">Actual</span>
                  </button>
                </div>
                
                <button 
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                  title={sortOrder === 'asc' ? "Terkecil ke Terbesar" : "Terbesar ke Terkecil"}
                >
                  {sortOrder === 'asc' ? <SortAsc size={14}/> : <SortDesc size={14}/>}
                </button>
              </div>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

              {/* ZOOM CONTROLS */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase sm:flex"><Maximize size={14}/><span>Zoom</span></div>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                  <button onClick={() => setZoomLevel(p => Math.max(0.4, Number((p - 0.1).toFixed(1))))} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex justify-center active:scale-90" title="Zoom Out"><ZoomOut size={14}/></button>
                  <input type="range" min="0.4" max="1.5" step="0.1" value={zoomLevel} onChange={e => setZoomLevel(parseFloat(e.target.value))} className="w-20 md:w-32 h-1 bg-slate-300 dark:bg-slate-600 rounded-lg appearance-none accent-blue-600" title="Zoom Level"/>
                  <button onClick={() => setZoomLevel(p => Math.min(1.5, Number((p + 0.1).toFixed(1))))} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex justify-center active:scale-90" title="Zoom In"><ZoomIn size={14}/></button>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 w-8 text-right font-bold">{(zoomLevel * 100).toFixed(0)}%</span>
                </div>
              </div>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
              <button onClick={handleExportExcel} className="p-2 transition-colors rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100" title="Download Excel"><Download size={20} /></button>
            </div>
          </div>
          
          {/* HIERARCHY LEVEL SELECTORS */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 w-full">
            {[
              { val: level1Field, set: setLevel1Field, label: 'Level 1' },
              { val: level2Field, set: setLevel2Field, label: 'Level 2' },
              { val: level3Field, set: setLevel3Field, label: 'Level 3' },
              { val: level4Field, set: setLevel4Field, label: 'Level 4' },
              { val: level5Field, set: setLevel5Field, label: 'Level 5' },
              { val: level6Field, set: setLevel6Field, label: 'Level 6' },
            ].map((item, index, allLevels) => {
              const selectedElsewhere = allLevels
                .filter((_, i) => i !== index)
                .map(x => x.val)
                .filter(v => v !== '');

              const filteredOptions = HIERARCHY_OPTIONS.filter(opt => 
                opt.value === '' || !selectedElsewhere.includes(opt.value)
              );

              const isDisabled = index > 0 && allLevels[index - 1].val === '';

              return (
                <DimensionSelectBox
                  key={index}
                  label={item.label}
                  value={item.val}
                  onChange={(newValue: string) => { item.set(newValue); }}
                  options={filteredOptions}
                  disabled={isDisabled} 
                />
              );
            })}
          </div>
        </div>

        {/* ============================================ */}
        {/* DATA TABLE                                  */}
        {/* ============================================ */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[65vh] md:h-[70vh] relative z-20 transition-colors">
          {(isLoading || isRefreshing) && renderLoadingOverlay("Memuat Data Table...")}
          
          <div className="overflow-auto flex-1 relative w-full">
            <div style={{ fontSize: `${14 * zoomLevel}px` }} className="min-w-full inline-block align-top transition-all duration-200">
              <table className="w-full border-collapse leading-normal text-slate-600 dark:text-slate-400">
                
                {/* TABLE HEADER */}
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 sticky top-0 z-20 shadow-sm">
                  <tr>
                    <th className="p-3 text-left font-bold border-b border-r border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 sticky left-0 z-30 min-w-[14em]">HIERARKI</th>
                    <th className="p-2 text-center font-bold border-b border-slate-300 dark:border-slate-600 bg-blue-50 dark:bg-blue-900/20 min-w-[8em]">PLAN</th>
                    <th className="p-2 text-center font-bold border-b border-slate-300 dark:border-slate-600 bg-emerald-50 dark:bg-emerald-900/20 min-w-[8em]">ACTUAL</th>
                    <th className="p-2 text-center font-bold border-b border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 min-w-[8em]">VARIANCE</th>
                    <th className="p-2 text-center font-bold border-b border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 min-w-[6em]">ACH %</th>
                  </tr>
                </thead>

                {/* TABLE BODY */}
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleRows.length > 0 ? visibleRows.map(node => {
                    const variance = node.actual - node.plan;
                    const ach = node.plan === 0 ? (node.actual > 0 ? 999 : 0) : (node.actual / node.plan) * 100;
                    const isPositive = variance >= 0;

                    return (
                      <tr key={node.id} className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group">
                        {/* HIERARCHY COLUMN */}
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

                        {/* PLAN */}
                        <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 bg-blue-50/30 dark:bg-blue-900/5">
                          <span className={node.plan ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-700 font-mono'}>
                            {formatNumber(node.plan)}
                          </span>
                        </td>

                        {/* ACTUAL */}
                        <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 bg-emerald-50/30 dark:bg-emerald-900/5">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={node.actual ? 'text-slate-900 dark:text-slate-200 font-semibold' : 'text-slate-300 dark:text-slate-700 font-mono'}>
                              {formatNumber(node.actual)}
                            </span>
                          </div>
                        </td>

                        {/* VARIANCE */}
                        <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800">
                          <span className={
                            variance === 0 ? 'text-slate-400' 
                            : isPositive ? 'text-emerald-600 dark:text-emerald-400 font-medium' 
                            : 'text-rose-600 dark:text-rose-400 font-medium'
                          }>
                            {variance !== 0 && (isPositive ? '+' : '')}{formatNumber(variance)}
                          </span>
                        </td>

                        {/* ACHIEVEMENT % with mini progress bar */}
                        <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className={`font-bold text-right ${ach >= 100 ? 'text-emerald-600 dark:text-emerald-400' : ach >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {Math.min(ach, 999).toFixed(1)}%
                            </span>
                            <div className="w-[3em] h-[0.4em] bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shrink-0">
                              <div 
                                className={`h-full rounded-full transition-all ${ach >= 100 ? 'bg-emerald-500' : ach >= 80 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                                style={{ width: `${Math.min(ach, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-400 dark:text-slate-500">
                        <Filter size={24} className="mx-auto mb-2"/>Data tidak ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* TABLE FOOTER */}
                <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200 sticky bottom-0 z-30 shadow-sm">
                  <tr>
                    <td className="p-3 sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 border-t border-r border-slate-300 dark:border-slate-600">GRAND TOTAL</td>
                    <td className="p-3 text-right border-t border-r border-slate-200 dark:border-slate-700 bg-blue-100/50 dark:bg-blue-900/20">
                      <span className="font-mono">{formatNumber(grandPlan)}</span>
                    </td>
                    <td className="p-3 text-right border-t border-r border-slate-200 dark:border-slate-700 bg-emerald-100/50 dark:bg-emerald-900/20">
                      <span className="font-mono">{formatNumber(grandActual)}</span>
                    </td>
                    <td className="p-3 text-right border-t border-r border-slate-200 dark:border-slate-700">
                      <span className={`font-mono ${grandVariance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {grandVariance >= 0 ? '+' : ''}{formatNumber(grandVariance)}
                      </span>
                    </td>
                    <td className="p-3 text-center border-t border-slate-200 dark:border-slate-700">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`font-mono ${grandAch >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {grandAch.toFixed(1)}%
                        </span>
                      </div>
                    </td>
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
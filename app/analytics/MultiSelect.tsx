'use client'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface MultiSelectProps {
    label: string;
    options?: string[];
    optionsRaw?: { label: string, value: string }[];
    selected: string[];
    onChange: (val: string[]) => void;
}

export function MultiSelect({ label, options, optionsRaw, selected, onChange }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const finalOptions = optionsRaw || (options ? options.map(o => ({ label: o, value: o })) : [])
  
  useEffect(() => {
    function handleClickOutside(event: any) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])
  
  const isAllSelected = selected.includes('All') || (finalOptions.length > 0 && selected.length === finalOptions.length)
  
  const toggleOption = (val: string) => {
    if (val === 'All') onChange(isAllSelected ? [] : ['All'])
    else {
      let newSelected = [...selected]
      if (newSelected.includes('All')) newSelected = finalOptions.map(o => o.value)
      
      if (newSelected.includes(val)) newSelected = newSelected.filter(item => item !== val)
      else newSelected.push(val)
      
      if (newSelected.length === finalOptions.length) onChange(['All'])
      else onChange(newSelected)
    }
  }

  const getDisplayLabel = () => {
      if (selected.includes('All')) return 'All'
      if (selected.length === 0) return 'None'
      
      const isNumeric = finalOptions.every(opt => !isNaN(parseInt(opt.value)))

      if (isNumeric) {
          const sortedIndices = selected
              .map(val => parseInt(val))
              .sort((a, b) => a - b)

          const ranges: string[] = []
          let start = sortedIndices[0]
          let prev = sortedIndices[0]

          for (let i = 1; i < sortedIndices.length; i++) {
              const current = sortedIndices[i]
              if (current === prev + 1) {
                  prev = current
              } else {
                  const startLabel = finalOptions.find(o => parseInt(o.value) === start)?.label
                  const endLabel = finalOptions.find(o => parseInt(o.value) === prev)?.label
                  ranges.push(start === prev ? `${startLabel}` : `${startLabel}-${endLabel}`)
                  start = current
                  prev = current
              }
          }
          const startLabel = finalOptions.find(o => parseInt(o.value) === start)?.label
          const endLabel = finalOptions.find(o => parseInt(o.value) === prev)?.label
          ranges.push(start === prev ? `${startLabel}` : `${startLabel}-${endLabel}`)
          return ranges.join(', ')
      } 
      
      const names = selected.map(val => finalOptions.find(o => o.value === val)?.label).filter(Boolean)
      if (names.length > 2) return `${names[0]}, ${names[1]} +${names.length - 2}`
      return names.join(', ')
  }
  
  return (
    <div className="relative" ref={dropdownRef}>
       <div className="flex flex-col">
         <label className="text-[10px] font-bold text-slate-400 ml-1 mb-0.5 uppercase tracking-wider">{label}</label>
         <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center justify-between gap-2 min-w-25 max-w-45 px-3 py-1.5 text-xs bg-white border rounded-md shadow-sm transition-all ${isOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`}>
            <span className="truncate font-medium text-slate-700 block">{getDisplayLabel()}</span>
            <ChevronDown size={14} className="text-slate-400 shrink-0" />
         </button>
       </div>
       
       {isOpen && (
         <div className="absolute top-full left-0 mt-1 w-56 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-1">
            <div onClick={() => toggleOption('All')} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 rounded text-xs font-bold border-b border-slate-100 mb-1 sticky top-0 bg-white z-10">
              <div className={`w-3 h-3 rounded border flex items-center justify-center ${isAllSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                 {isAllSelected && <Check size={8} className="text-white" />}
              </div>
              Select All
            </div>
            {finalOptions.map(opt => {
               const isSelected = selected.includes(opt.value) || selected.includes('All')
               return (
                  <div key={opt.value} onClick={() => toggleOption(opt.value)} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 rounded text-xs">
                    <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                      {isSelected && <Check size={8} className="text-white" />}
                    </div>
                    {opt.label}
                  </div>
               )
            })}
         </div>
       )}
    </div>
  )
}
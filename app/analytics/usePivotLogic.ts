import { useMemo } from 'react'
import { AggregatedRecord, PivotNode } from './types'
import { MONTH_OPTIONS } from './constants'

interface UsePivotLogicProps {
  data: AggregatedRecord[];
  rowDimension: string;
  expandedCols: Record<string, boolean>;
  expandedRows: Record<string, boolean>;
}

export function usePivotLogic({ data, rowDimension, expandedCols, expandedRows }: UsePivotLogicProps) {
  
  // 1. MEMOIZED PIVOT CALCULATION
  const pivotData = useMemo(() => {
    const uniqueYearsSet = new Set<string>()
    data.forEach(d => uniqueYearsSet.add(String(d.year)))
    const sortedYears = Array.from(uniqueYearsSet).sort()

    // A. Columns Logic
    const finalColKeys: string[] = []
    sortedYears.forEach(year => {
        if (expandedCols[year]) {
            const monthsInYear = new Set<number>()
            data.filter(d => String(d.year) === year).forEach(d => monthsInYear.add(d.month))
            const sortedMonths = Array.from(monthsInYear).sort((a,b) => a - b)
            sortedMonths.forEach(m => finalColKeys.push(`${year}-${m < 10 ? '0'+m : m}`))
            finalColKeys.push(`${year}-Total`)
        } else {
            finalColKeys.push(year)
        }
    })

    // B. Tree Logic
    const colTotals: Record<string, number> = {}
    let grandTotal = 0
    const rootMap: Record<string, PivotNode> = {}

    for (const item of data) {
      const yearStr = String(item.year)
      const monthStr = item.month < 10 ? `0${item.month}` : String(item.month)
      const val = item.total_amount || 0
      
      const keysToUpdate = [yearStr, `${yearStr}-${monthStr}`, `${yearStr}-Total`]

      grandTotal += val
      
      for (const k of keysToUpdate) colTotals[k] = (colTotals[k] || 0) + val

      let levels: string[] = []
      
      if (rowDimension === 'hierarchy_account') {
         levels = [item.col_label_1, item.col_label_2, item.col_label_3]
      } else if (rowDimension === 'hierarchy_ba_pss') {
         levels = [item.col_label_1, item.col_label_2]
      } else {
         levels = [item.col_label_1]
      }
      levels = levels.filter(l => l && l !== '-')

      let currentMap = rootMap
      let currentIdPath = ""

      levels.forEach((lvlLabel, idx) => {
        const isLastLevel = idx === levels.length - 1
        currentIdPath = currentIdPath ? `${currentIdPath}|${lvlLabel}` : lvlLabel
        
        if (!currentMap[lvlLabel]) {
            currentMap[lvlLabel] = {
                id: currentIdPath,
                label: lvlLabel,
                level: idx,
                isLeaf: isLastLevel,
                values: {}, 
                rowTotal: 0,
            }
        }
        
        const node = currentMap[lvlLabel]
        for (const k of keysToUpdate) node.values[k] = (node.values[k] || 0) + val
        node.rowTotal += val

        if (!isLastLevel) {
            if (!(node as any).childrenMap) { (node as any).childrenMap = {} }
            currentMap = (node as any).childrenMap
        }
      })
    }

    const processChildren = (map: Record<string, PivotNode>): PivotNode[] => {
        return Object.values(map)
            .sort((a, b) => a.label.localeCompare(b.label))
            .map(node => {
                if ((node as any).childrenMap) {
                    node.children = processChildren((node as any).childrenMap)
                    delete (node as any).childrenMap
                }
                return node
            })
    }

    return { 
        roots: processChildren(rootMap), 
        colKeys: finalColKeys, 
        colTotals, 
        grandTotal
    }
  }, [data, rowDimension, expandedCols])

  // 2. FLATTEN VISIBLE ROWS
  const visibleRows = useMemo(() => {
    const rows: PivotNode[] = []
    const traverse = (nodes: PivotNode[]) => {
        nodes.forEach(node => {
            rows.push(node)
            if (node.children && expandedRows[node.id]) {
                traverse(node.children)
            }
        })
    }
    traverse(pivotData.roots)
    return rows
  }, [pivotData.roots, expandedRows])

  // 3. HELPER HEADER
  const getHeaderInfo = (colKey: string) => {
      if (colKey.includes('-Total')) return { type: 'subtotal', label: 'TOTAL', parent: colKey.split('-')[0] }
      if (colKey.includes('-')) {
          const [y, m] = colKey.split('-')
          const monthLabel = MONTH_OPTIONS.find(o => o.value === String(parseInt(m)))?.label || m
          return { type: 'month', label: monthLabel, parent: y }
      }
      return { type: 'year', label: colKey, parent: colKey }
  }

  return { pivotData, visibleRows, getHeaderInfo }
}
export interface AggregatedRecord {
  year: number;
  month: number;
  col_label_1: string;
  col_label_2: string;
  col_label_3: string;
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
}
import drills from '../data/workbook.json';
import { dailyIndex } from './quotes';

export interface DrillField { id: string; label: string; rows: number }
export interface Drill {
  key: string;
  title: string;
  subtitle: string;
  category: string;
  intro: string;
  fields: DrillField[];
}

export const DRILLS = drills as Drill[];
export const DAILY_GOAL = 3;
export const drillByKey = (key: string) => DRILLS.find((d) => d.key === key);

/** Four suggested drills for the day (rotating), so there's choice but no paralysis. */
export function suggestedFor(day: string, count = 4): Drill[] {
  const start = dailyIndex(day, DRILLS.length, 2);
  return Array.from({ length: count }, (_, i) => DRILLS[(start + i * 7) % DRILLS.length]);
}

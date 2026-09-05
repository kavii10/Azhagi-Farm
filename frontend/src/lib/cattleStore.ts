import { supabase, isSupabaseConfigured } from './supabase';
import { addToSyncQueue } from './syncManager';

// ---- Types ----

export type AnimalType = 'cow' | 'buffalo';
export type AnimalStatus = 'milking' | 'dry' | 'calf' | 'sold';

export interface Animal {
  id: string;
  name: string;
  type: AnimalType;
  status: AnimalStatus;
  tag_number?: string;
  dob?: string;
  purchased_date?: string;
  notes?: string;
  created_at: string;
}

export interface DailyYield {
  id: string;
  animal_id: string;
  date: string; // YYYY-MM-DD
  morning_litres: number;
  evening_litres: number;
}

// Built-in ID generator (zero external dependencies)
function generateId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

// ---- Storage keys ----
const ANIMALS_KEY = 'azhagi_cattle_animals';
const YIELDS_KEY = 'azhagi_cattle_yields';

// ---- Raw storage helpers ----
function readAnimals(): Animal[] {
  try {
    return JSON.parse(localStorage.getItem(ANIMALS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAnimalsLocal(animals: Animal[]) {
  localStorage.setItem(ANIMALS_KEY, JSON.stringify(animals));
}

function readYields(): DailyYield[] {
  try {
    return JSON.parse(localStorage.getItem(YIELDS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveYieldsLocal(yields: DailyYield[]) {
  localStorage.setItem(YIELDS_KEY, JSON.stringify(yields));
}

// ---- Background Supabase Sync ----
export async function syncCattleWithCloud(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    // 1. Fetch cloud animals
    const { data: cloudAnimals, error: aErr } = await supabase.from('cattle').select('*');
    if (!aErr && cloudAnimals && cloudAnimals.length > 0) {
      saveAnimalsLocal(cloudAnimals as Animal[]);
    }

    // 2. Fetch cloud yields
    const { data: cloudYields, error: yErr } = await supabase.from('cattle_yields').select('*');
    if (!yErr && cloudYields && cloudYields.length > 0) {
      const mapped: DailyYield[] = cloudYields.map((cy: any) => ({
        id: cy.id,
        animal_id: cy.animal_id,
        date: cy.yield_date,
        morning_litres: cy.morning_litres || 0,
        evening_litres: cy.evening_litres || 0,
      }));
      saveYieldsLocal(mapped);
    }
  } catch (err) {
    // Silently continue with local store
    console.warn('Cloud cattle sync:', err);
  }
}

// ---- Animal CRUD ----

export function getAnimals(): Animal[] {
  return readAnimals().sort((a, b) => a.name.localeCompare(b.name));
}

export function getAnimal(id: string): Animal | undefined {
  return readAnimals().find((a) => a.id === id);
}

export function saveAnimal(data: Omit<Animal, 'id' | 'created_at'> & { id?: string }): Animal {
  const animals = readAnimals();
  let savedAnimal: Animal;

  if (data.id) {
    // Update
    const idx = animals.findIndex((a) => a.id === data.id);
    if (idx >= 0) {
      animals[idx] = { ...animals[idx], ...data } as Animal;
      savedAnimal = animals[idx];
    } else {
      savedAnimal = {
        ...data,
        id: data.id,
        created_at: new Date().toISOString(),
      };
      animals.push(savedAnimal);
    }
  } else {
    // Create
    savedAnimal = {
      ...data,
      id: generateId('animal'),
      created_at: new Date().toISOString(),
    };
    animals.push(savedAnimal);
  }

  saveAnimalsLocal(animals);

  // Cloud sync or offline queue
  if (isSupabaseConfigured()) {
    if (navigator.onLine) {
      Promise.resolve(supabase.from('cattle').upsert(savedAnimal))
        .then(({ error }: any) => {
          if (error) {
            console.warn('Supabase animal save warning, queuing offline sync:', error.message);
            addToSyncQueue('cattle', 'upsert', savedAnimal);
          }
        })
        .catch(() => {
          addToSyncQueue('cattle', 'upsert', savedAnimal);
        });
    } else {
      addToSyncQueue('cattle', 'upsert', savedAnimal);
    }
  }

  return savedAnimal;
}

export function deleteAnimal(id: string) {
  const animals = readAnimals().filter((a) => a.id !== id);
  saveAnimalsLocal(animals);

  // Also delete yields for this animal
  const yields = readYields().filter((y) => y.animal_id !== id);
  saveYieldsLocal(yields);

  // Cloud delete or offline queue
  if (isSupabaseConfigured()) {
    if (navigator.onLine) {
      Promise.resolve(supabase.from('cattle').delete().eq('id', id))
        .catch(() => {
          addToSyncQueue('cattle', 'delete', { id });
        });
    } else {
      addToSyncQueue('cattle', 'delete', { id });
    }
  }
}

// ---- Daily Yield CRUD ----

export function getYieldsForAnimal(animalId: string, year: number, month: number): DailyYield[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return readYields().filter(
    (y) => y.animal_id === animalId && y.date.startsWith(prefix)
  );
}

export function getAllYieldsForDate(date: string): DailyYield[] {
  return readYields().filter((y) => y.date === date);
}

export function upsertDailyYield(data: {
  animal_id: string;
  date: string;
  morning_litres: number;
  evening_litres: number;
}): DailyYield {
  const yields = readYields();
  const existingIdx = yields.findIndex(
    (y) => y.animal_id === data.animal_id && y.date === data.date
  );

  let entry: DailyYield;
  if (existingIdx >= 0) {
    yields[existingIdx] = { ...yields[existingIdx], ...data };
    entry = yields[existingIdx];
  } else {
    entry = { id: generateId('yield'), ...data };
    yields.push(entry);
  }

  saveYieldsLocal(yields);

  // Cloud sync or offline queue
  if (isSupabaseConfigured()) {
    const yieldRecord = {
      id: entry.id,
      animal_id: entry.animal_id,
      yield_date: entry.date,
      morning_litres: entry.morning_litres,
      evening_litres: entry.evening_litres,
    };

    if (navigator.onLine) {
      Promise.resolve(
        supabase
          .from('cattle_yields')
          .upsert(yieldRecord, { onConflict: 'animal_id,yield_date' })
      )
        .then(({ error }: any) => {
          if (error) {
            console.warn('Supabase yield save warning, queuing offline sync:', error.message);
            addToSyncQueue('cattle_yields', 'upsert', yieldRecord);
          }
        })
        .catch(() => {
          addToSyncQueue('cattle_yields', 'upsert', yieldRecord);
        });
    } else {
      addToSyncQueue('cattle_yields', 'upsert', yieldRecord);
    }
  }

  return entry;
}

// ---- Aggregation helpers ----

export function getTodayFarmYield(date: string): { morning: number; evening: number; total: number } {
  const todayYields = getAllYieldsForDate(date);
  const morning = todayYields.reduce((s, y) => s + y.morning_litres, 0);
  const evening = todayYields.reduce((s, y) => s + y.evening_litres, 0);
  return {
    morning: parseFloat(morning.toFixed(2)),
    evening: parseFloat(evening.toFixed(2)),
    total: parseFloat((morning + evening).toFixed(2)),
  };
}

export function getMonthlyYieldForAnimal(
  animalId: string,
  year: number,
  month: number
): { totalMorning: number; totalEvening: number; totalLitres: number } {
  const yields = getYieldsForAnimal(animalId, year, month);
  const totalMorning = yields.reduce((s, y) => s + y.morning_litres, 0);
  const totalEvening = yields.reduce((s, y) => s + y.evening_litres, 0);
  return {
    totalMorning: parseFloat(totalMorning.toFixed(2)),
    totalEvening: parseFloat(totalEvening.toFixed(2)),
    totalLitres: parseFloat((totalMorning + totalEvening).toFixed(2)),
  };
}

export function getAllMonthlyYield(year: number, month: number): number {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const yields = readYields().filter((y) => y.date.startsWith(prefix));
  return parseFloat(
    yields.reduce((s, y) => s + y.morning_litres + y.evening_litres, 0).toFixed(2)
  );
}

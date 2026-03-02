import { supabase } from '../lib/supabase';

// Generic CRUD operations for any table
export async function getAll<T>(table: string): Promise<T[]> {
    const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('createdAt', { ascending: false });

    if (error) throw error;
    return data as T[];
}

export async function getById<T>(table: string, id: string): Promise<T | null> {
    const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data as T;
}

export async function create<T>(table: string, item: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const { data, error } = await supabase
        .from(table)
        .insert({ id: crypto.randomUUID(), ...item })
        .select()
        .single();

    if (error) throw error;
    return data as T;
}

export async function update<T>(table: string, id: string, updates: Partial<T>): Promise<T> {
    const { data, error } = await supabase
        .from(table)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data as T;
}

export async function remove(table: string, id: string): Promise<void> {
    const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

    if (error) throw error;
}

// Query builder helpers
export async function getWhere<T>(table: string, column: string, value: unknown): Promise<T[]> {
    const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq(column, value);

    if (error) throw error;
    return data as T[];
}

export async function getWithRelations<T>(
    table: string,
    relations: string
): Promise<T[]> {
    const { data, error } = await supabase
        .from(table)
        .select(relations)
        .order('createdAt', { ascending: false });

    if (error) throw error;
    return data as T[];
}

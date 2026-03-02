import { supabase } from '../lib/supabase';
import { TeamMember } from '../types';

const TABLE = 'team_members';
const USERS_TABLE = 'users';

export const teamService = {
    async getAll(): Promise<TeamMember[]> {
        const { data, error } = await supabase
            .from(USERS_TABLE)
            .select(`
        *,
        team_members (*)
      `)
            .order('createdAt', { ascending: false });

        if (error) throw error;

        // Transform to match frontend TeamMember interface
        return (data || []).map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role === 'ADMIN' ? 'Admin' :
                user.role === 'MANAGER' ? 'Manager' :
                    user.role === 'SALES' ? 'Sales Executive' : 'Support',
            status: 'Active' as const,
            phone: user.phone,
            avatar: user.avatar,
            image: user.avatar,
            joinDate: user.team_members?.joinDate || user.createdAt,
            commissionRate: user.team_members?.commissionRate || 0.20,
            baseSalary: user.team_members?.baseSalary || 0,
        })) as TeamMember[];
    },

    async getById(id: string): Promise<TeamMember | null> {
        const { data, error } = await supabase
            .from(USERS_TABLE)
            .select(`
        *,
        team_members (*)
      `)
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) return null;

        return {
            id: data.id,
            name: data.name,
            email: data.email,
            role: data.role === 'ADMIN' ? 'Admin' :
                data.role === 'MANAGER' ? 'Manager' :
                    data.role === 'SALES' ? 'Sales Executive' : 'Support',
            status: 'Active' as const,
            phone: data.phone,
            avatar: data.avatar,
            image: data.avatar,
            joinDate: data.team_members?.joinDate || data.createdAt,
            commissionRate: data.team_members?.commissionRate || 0.20,
            baseSalary: data.team_members?.baseSalary || 0,
        } as TeamMember;
    },

    async create(member: Omit<TeamMember, 'id'>): Promise<TeamMember> {
        // Create user first
        const roleMap: Record<string, string> = {
            'Admin': 'ADMIN',
            'Manager': 'MANAGER',
            'Sales Executive': 'SALES',
            'Support': 'SUPPORT'
        };

        const { data: user, error: userError } = await supabase
            .from(USERS_TABLE)
            .insert({
                id: crypto.randomUUID(),
                name: member.name,
                email: member.email,
                role: roleMap[member.role] || 'SUPPORT',
                phone: member.phone,
                avatar: member.avatar || member.image,
            })
            .select()
            .single();

        if (userError) throw userError;

        // Create team_member record
        const { error: tmError } = await supabase
            .from(TABLE)
            .insert({
                id: crypto.randomUUID(),
                userId: user.id,
                baseSalary: member.baseSalary || 0,
                commissionRate: member.commissionRate || 0.20,
                joinDate: member.joinDate || new Date().toISOString(),
            });

        if (tmError) throw tmError;

        return {
            ...member,
            id: user.id,
        } as TeamMember;
    },

    async update(id: string, updates: Partial<TeamMember>): Promise<TeamMember> {
        const roleMap: Record<string, string> = {
            'Admin': 'ADMIN',
            'Manager': 'MANAGER',
            'Sales Executive': 'SALES',
            'Support': 'SUPPORT'
        };

        // Update user
        const { error: userError } = await supabase
            .from(USERS_TABLE)
            .update({
                name: updates.name,
                email: updates.email,
                role: updates.role ? roleMap[updates.role] : undefined,
                phone: updates.phone,
                avatar: updates.avatar || updates.image,
            })
            .eq('id', id);

        if (userError) throw userError;

        // Update team_member if needed
        if (updates.baseSalary !== undefined || updates.commissionRate !== undefined) {
            await supabase
                .from(TABLE)
                .update({
                    baseSalary: updates.baseSalary,
                    commissionRate: updates.commissionRate,
                })
                .eq('userId', id);
        }

        return { id, ...updates } as TeamMember;
    },

    async delete(id: string): Promise<void> {
        // Delete user (team_member will cascade)
        const { error } = await supabase
            .from(USERS_TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};

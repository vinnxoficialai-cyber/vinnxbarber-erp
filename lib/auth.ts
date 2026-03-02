import { supabase } from './supabase';
import { TeamMember } from '../types';

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: 'Admin' | 'Manager' | 'Sales Executive' | 'Support';
    avatar?: string;
    password?: string; // Added to enable delete confirmation
}

export const authService = {
    // Helper to prevent hanging queries (30s default - generous for slow connections)
    async _withTimeout<T>(promise: Promise<T>, ms = 30000): Promise<T> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Operation timed out'));
            }, ms);

            promise
                .then(value => {
                    clearTimeout(timer);
                    resolve(value);
                })
                .catch(err => {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    },

    // Helper to extract role from user_metadata (fallback when DB is unreachable)
    _roleFromMeta(meta?: Record<string, any>): AuthUser['role'] {
        const r = (meta?.role || '').toUpperCase();
        if (r === 'ADMIN') return 'Admin';
        if (r === 'MANAGER') return 'Manager';
        if (r === 'SALES' || r === 'SALES EXECUTIVE') return 'Sales Executive';
        return 'Support';
    },

    // Sign in with email and password
    async signIn(email: string, password: string): Promise<{ user: AuthUser | null; error: Error | null }> {
        try {
            // No timeout on auth - let Supabase handle its own timeouts
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            if (!data.user) throw new Error('No user returned');

            // Get user profile from users table (15s timeout - generous)
            let profile = null;
            try {
                const { data: profileData, error: profileError } = await this._withTimeout(
                    supabase
                        .from('users')
                        .select('*')
                        .eq('email', email)
                        .single(),
                    15000
                );
                if (!profileError) {
                    profile = profileData;
                }
            } catch (profileErr) {
                console.warn('Profile fetch failed, using auth data only:', profileErr);
            }

            const authUser: AuthUser = {
                id: data.user.id,
                email: data.user.email || email,
                name: profile?.name || data.user.user_metadata?.name || email.split('@')[0],
                role: profile?.role === 'ADMIN' ? 'Admin' :
                    profile?.role === 'MANAGER' ? 'Manager' :
                        profile?.role === 'SALES' ? 'Sales Executive' : 'Support',
                avatar: profile?.avatar,
                password: profile?.password, // Include password for delete confirmation
            };

            // Persist role in user_metadata so PWA fallback can recover it
            if (profile?.role) {
                supabase.auth.updateUser({
                    data: { role: profile.role, name: authUser.name }
                }).catch(() => { /* best-effort, non-blocking */ });
            }

            return { user: authUser, error: null };
        } catch (err) {
            console.error("SignIn error:", err);
            return { user: null, error: err as Error };
        }
    },

    // Sign up new user
    async signUp(email: string, password: string, name: string): Promise<{ user: AuthUser | null; error: Error | null }> {
        try {
            const { data, error } = await this._withTimeout(supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { name },
                },
            }));

            if (error) throw error;
            if (!data.user) throw new Error('No user returned');

            // Create user profile in users table
            const { error: profileError } = await this._withTimeout(
                supabase
                    .from('users')
                    .insert({
                        id: data.user.id,
                        email,
                        name,
                        role: 'SUPPORT', // Default role
                    })
            );

            if (profileError) throw profileError;

            const authUser: AuthUser = {
                id: data.user.id,
                email,
                name,
                role: 'Support',
            };

            return { user: authUser, error: null };
        } catch (err) {
            return { user: null, error: err as Error };
        }
    },

    // Sign out
    async signOut(): Promise<{ error: Error | null }> {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            return { error: null };
        } catch (err) {
            return { error: err as Error };
        }
    },

    // Get current session
    async getSession() {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    },

    // Get current user from session
    async getCurrentUser(): Promise<AuthUser | null> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            // Attempt to fetch profile with timeout
            let profile = null;
            let profileFetchFailed = false;
            try {
                const { data, error } = await this._withTimeout(
                    supabase
                        .from('users')
                        .select('*')
                        .eq('id', user.id)
                        .single(),
                    15000 // 15s timeout - generous for slow connections
                );
                if (error && error.code !== 'PGRST116') {
                    // PGRST116 = "row not found" — any other error is a real failure
                    profileFetchFailed = true;
                    console.warn("DB error fetching profile:", error.message);
                }
                profile = data;
            } catch (err) {
                profileFetchFailed = true;
                console.warn("Could not fetch user profile from DB:", err);
            }

            // Only sign out if profile was NOT found (confirmed missing, not query error)
            if (!profile && !profileFetchFailed) {
                console.warn('[Auth] User exists in auth but not in users table — signing out (deleted user)');
                await supabase.auth.signOut();
                return null;
            }

            // If fetch failed (timeout/network), fall back to auth metadata — don't lock user out
            if (!profile && profileFetchFailed) {
                return {
                    id: user.id,
                    email: user.email || '',
                    name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
                    role: this._roleFromMeta(user.user_metadata),
                    avatar: user.user_metadata?.avatar_url,
                };
            }

            return {
                id: user.id,
                email: user.email || '',
                name: profile.name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
                role: profile.role === 'ADMIN' ? 'Admin' :
                    profile.role === 'MANAGER' ? 'Manager' :
                        profile.role === 'SALES' ? 'Sales Executive' : 'Support',
                avatar: profile.avatar,
            };
        } catch {
            return null;
        }
    },

    // Convert AuthUser to TeamMember for app compatibility
    toTeamMember(authUser: AuthUser): TeamMember {
        return {
            id: authUser.id,
            name: authUser.name,
            email: authUser.email,
            role: authUser.role,
            status: 'Active',
            avatar: authUser.avatar,
            image: authUser.avatar,
            password: authUser.password, // Pass through for delete confirmation
        } as TeamMember;
    },

    // Listen to auth state changes - fetches real role from database
    onAuthStateChange(callback: (user: AuthUser | null) => void) {
        return supabase.auth.onAuthStateChange((event, session) => {
            console.log('[Auth] State changed:', event);
            if (session?.user) {
                // Fetch the REAL role from DB before calling callback
                // DO NOT emit a "quickUser" with temporary Support role — this causes
                // ProtectedRoute to deny access to admin pages during the role flash
                (async () => {
                    try {
                        const { data: profile, error } = await supabase
                            .from('users')
                            .select('name, role, avatar')
                            .eq('id', session.user.id)
                            .single();

                        if (error && error.code !== 'PGRST116') {
                            // Real DB error — fall back to basic auth data
                            console.warn('[Auth] DB error fetching profile:', error.message);
                            callback({
                                id: session.user.id,
                                email: session.user.email || '',
                                name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                                role: this._roleFromMeta(session.user.user_metadata),
                                avatar: session.user.user_metadata?.avatar_url,
                            });
                            return;
                        }

                        if (profile) {
                            // Keep user_metadata fresh for PWA fallback
                            supabase.auth.updateUser({
                                data: { role: profile.role, name: profile.name }
                            }).catch(() => { /* best-effort */ });

                            callback({
                                id: session.user.id,
                                email: session.user.email || '',
                                name: profile.name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                                role: profile.role === 'ADMIN' ? 'Admin' :
                                    profile.role === 'MANAGER' ? 'Manager' :
                                        profile.role === 'SALES' ? 'Sales Executive' : 'Support',
                                avatar: profile.avatar || session.user.user_metadata?.avatar_url,
                            });
                        } else {
                            // Profile confirmed missing (PGRST116) — user was deleted
                            console.warn('[Auth] User not found in users table — logging out deleted user');
                            await supabase.auth.signOut();
                            callback(null);
                        }
                    } catch (err) {
                        console.warn('[Auth] Could not fetch profile:', err);
                        // Fall back to basic auth data so UI is not blocked
                        callback({
                            id: session.user.id,
                            email: session.user.email || '',
                            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                            role: this._roleFromMeta(session.user.user_metadata),
                            avatar: session.user.user_metadata?.avatar_url,
                        });
                    }
                })();
            } else {
                callback(null);
            }
        });
    },
};

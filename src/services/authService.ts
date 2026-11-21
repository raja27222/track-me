import { supabase } from '../lib/supabase';
import { getBrowserTimezone } from '../utils/dateUtils';

export const authService = {
  async signUp(params: { fullName: string; email: string; password: string }) {
    const timezone = getBrowserTimezone();
    const { data, error } = await supabase.auth.signUp({
      email: params.email.trim(),
      password: params.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: params.fullName.trim(),
          timezone,
        },
      },
    });
    if (error) throw error;
    return data;
  },

  async signIn(params: { email: string; password: string }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: params.email.trim(),
      password: params.password,
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async resetPasswordForEmail(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/?mode=reset-password`,
    });
    if (error) throw error;
    return data;
  },

  async updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
    return data;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },
};

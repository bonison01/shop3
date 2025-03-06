
import React, { createContext, useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType, UserProfile, CompanyAccessType } from './types';
import { useAuthFunctions } from './useAuthFunctions';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [staffCompanyAccess, setStaffCompanyAccess] = useState<CompanyAccessType[] | null>(null);
  
  const {
    isLoading,
    setIsLoading,
    profile,
    setProfile,
    isAdmin,
    setIsAdmin,
    isStaff,
    setIsStaff,
    fetchProfile,
    signIn,
    signUp,
    updateBusinessName: updateProfileBusinessName,
    signOut
  } = useAuthFunctions();

  // Handle business name update (wrapper to pass in user id)
  const updateBusinessName = async (businessName: string) => {
    if (user) {
      await updateProfileBusinessName(user.id, businessName);
    }
  };

  // Fetch company access for staff members
  const fetchCompanyAccess = async (email: string) => {
    try {
      setIsLoading(true);
      console.log('Fetching company access for email:', email);
      
      // First get staff ID by email
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id')
        .eq('staff_email', email)
        .maybeSingle();

      if (staffError) {
        console.error('Error fetching staff data:', staffError);
        setStaffCompanyAccess(null);
        setIsLoading(false);
        return;
      }

      if (!staffData) {
        console.log('No staff record found for email:', email);
        setStaffCompanyAccess(null);
        setIsLoading(false);
        return;
      }

      console.log('Found staff record:', staffData);

      // Now get company access with staff ID
      const { data: accessData, error: accessError } = await supabase
        .from('company_access')
        .select(`
          id,
          business_name,
          owner_id,
          staff_id,
          created_at
        `)
        .eq('staff_id', staffData.id);

      if (accessError) {
        console.error('Error fetching company access:', accessError);
        setStaffCompanyAccess(null);
        setIsLoading(false);
        return;
      }

      // Transform data to match CompanyAccessType
      if (accessData && accessData.length > 0) {
        console.log('Raw company access data:', accessData);
        
        const transformedData = accessData.map(item => ({
          id: item.id,
          business_name: item.business_name || 'Unknown Company',
          owner_id: item.owner_id || '',
          staff_id: item.staff_id,
          created_at: item.created_at
        }));
        
        console.log('Transformed company access:', transformedData);
        setStaffCompanyAccess(transformedData as CompanyAccessType[]);
      } else {
        console.log('No company access found');
        setStaffCompanyAccess([]);
      }
    } catch (error) {
      console.error('Error in fetchCompanyAccess:', error);
      setStaffCompanyAccess(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial session fetch
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        if (session.user.email) {
          fetchCompanyAccess(session.user.email);
        }
      } else {
        setIsLoading(false);
      }
    });

    // Set up auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          fetchProfile(session.user.id);
          if (session.user.email) {
            fetchCompanyAccess(session.user.email);
          }
        } else {
          setProfile(null);
          setIsAdmin(false);
          setIsStaff(false);
          setStaffCompanyAccess(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    session,
    user,
    profile,
    isLoading,
    signIn,
    signUp,
    signOut,
    isAdmin,
    isStaff,
    updateBusinessName,
    staffCompanyAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

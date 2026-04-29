import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Field, Zone, Device, Plan, Strategy,
  mockFields, mockDevices, mockPlans, mockStrategies
} from '../data/mockData';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { fetchFieldsFromSupabase } from '../../lib/fieldService';
import { fetchDevicesFromSupabase, seedDevicesInSupabase } from '../../lib/deviceService';
import { getWifiDemoAppDevice } from '../../lib/wifiDemoConfig';
import { fetchPlansFromSupabase } from '../../lib/planService';

interface AppUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  avatar: string;
}

interface AppContextType {
  isAuthReady: boolean;
  isAuthenticated: boolean;
  user: AppUser | null;
  authMode: 'supabase' | 'mock';
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;

  fields: Field[];
  setFields: React.Dispatch<React.SetStateAction<Field[]>>;
  isFieldsLoading: boolean;
  refreshFields: () => Promise<void>;
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  refreshDevices: () => Promise<void>;
  plans: Plan[];
  setPlans: React.Dispatch<React.SetStateAction<Plan[]>>;
  refreshPlans: () => Promise<void>;
  strategies: Strategy[];
  setStrategies: React.Dispatch<React.SetStateAction<Strategy[]>>;

  selectedFieldId: string | null;
  setSelectedFieldId: React.Dispatch<React.SetStateAction<string | null>>;
}

const AppContext = createContext<AppContextType | null>(null);

const MOCK_USER: AppUser = {
  id: 'u1',
  username: 'admin',
  displayName: '张建国',
  email: 'zhangjianguo@irrigate.com',
  role: '系统管理员',
  avatar: 'ZJ',
};

function withWifiDemoDevice(devices: Device[]) {
  const wifiDemoDevice = getWifiDemoAppDevice();
  if (!wifiDemoDevice) {
    return devices;
  }

  const exists = devices.some((device) => device.id === wifiDemoDevice.id);
  if (exists) {
    return devices.map((device) => (
      device.id === wifiDemoDevice.id
        ? { ...device, ...wifiDemoDevice, bindings: device.bindings ?? wifiDemoDevice.bindings }
        : device
    ));
  }

  return [...devices, wifiDemoDevice];
}

function deriveUser(session: Session): AppUser {
  const email = session.user.email ?? '';
  const metadata = session.user.user_metadata ?? {};
  const displayName =
    typeof metadata.display_name === 'string' && metadata.display_name.trim()
      ? metadata.display_name.trim()
      : email.split('@')[0] || '未命名用户';
  const username = email.split('@')[0] || session.user.id.slice(0, 8);

  return {
    id: session.user.id,
    username,
    displayName,
    email,
    role: '业务用户',
    avatar: displayName.slice(0, 2).toUpperCase(),
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [fields, setFields] = useState<Field[]>(mockFields);
  const [isFieldsLoading, setIsFieldsLoading] = useState(false);
  const [devices, setDevices] = useState<Device[]>(mockDevices);
  const [plans, setPlans] = useState<Plan[]>(mockPlans);
  const [strategies, setStrategies] = useState<Strategy[]>(mockStrategies);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setIsAuthenticated(false);
      setUser(null);
      setIsAuthReady(true);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;

      const session = data.session;
      setIsAuthenticated(Boolean(session));
      setUser(session ? deriveUser(session) : null);
      setIsAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setIsAuthenticated(Boolean(session));
      setUser(session ? deriveUser(session) : null);
      setIsAuthReady(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshFields = async () => {
    if (!supabase) {
      setFields(mockFields);
      return;
    }

    setIsFieldsLoading(true);
    try {
      const nextFields = await fetchFieldsFromSupabase();
      setFields(nextFields);
    } catch (error) {
      console.error('Failed to load fields from Supabase:', error);
    } finally {
      setIsFieldsLoading(false);
    }
  };

  const refreshDevices = async () => {
    if (!supabase) {
      setDevices(withWifiDemoDevice(mockDevices));
      return;
    }

    if (!user) {
      setDevices([]);
      return;
    }

    try {
      await seedDevicesInSupabase(user.id);
      const nextDevices = await fetchDevicesFromSupabase();
      setDevices(withWifiDemoDevice(nextDevices));
    } catch (error) {
      console.error('Failed to load devices from Supabase:', error);
    }
  };

  const refreshPlans = async () => {
    if (!supabase) {
      setPlans(mockPlans);
      return;
    }

    if (!user) {
      setPlans([]);
      return;
    }

    try {
      const nextPlans = await fetchPlansFromSupabase();
      setPlans(nextPlans);
    } catch (error) {
      console.error('Failed to load plans from Supabase:', error);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setFields(mockFields);
      setDevices(withWifiDemoDevice(mockDevices));
      setPlans(mockPlans);
      setIsFieldsLoading(false);
      return;
    }

    if (!isAuthenticated) {
      setFields([]);
      setDevices([]);
      setPlans([]);
      setIsFieldsLoading(false);
      return;
    }

    void refreshFields();
    void refreshDevices();
    void refreshPlans();
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!supabase || !isAuthenticated) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshFields();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [isAuthenticated, user?.id]);

  const login = async (username: string, password: string) => {
    if (!supabase) {
      return {
        ok: false,
        error: 'Supabase 环境变量未配置，请先在 web-dev/.env 中填写 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。',
      };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: username.trim(),
      password,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  };

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      return;
    }

    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AppContext.Provider value={{
      isAuthReady,
      isAuthenticated,
      user,
      authMode: isSupabaseConfigured ? 'supabase' : 'mock',
      login,
      logout,
      fields, setFields,
      isFieldsLoading,
      refreshFields,
      devices, setDevices,
      refreshDevices,
      plans, setPlans,
      refreshPlans,
      strategies, setStrategies,
      selectedFieldId, setSelectedFieldId,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

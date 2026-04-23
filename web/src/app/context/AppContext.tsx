import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  Field, Zone, Device, Plan, Strategy,
  mockFields, mockDevices, mockPlans, mockStrategies
} from '../data/mockData';

interface AppUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  avatar: string;
}

interface AppContextType {
  isAuthenticated: boolean;
  user: AppUser | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;

  fields: Field[];
  setFields: React.Dispatch<React.SetStateAction<Field[]>>;
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  plans: Plan[];
  setPlans: React.Dispatch<React.SetStateAction<Plan[]>>;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [fields, setFields] = useState<Field[]>(mockFields);
  const [devices, setDevices] = useState<Device[]>(mockDevices);
  const [plans, setPlans] = useState<Plan[]>(mockPlans);
  const [strategies, setStrategies] = useState<Strategy[]>(mockStrategies);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  const login = (username: string, password: string): boolean => {
    if (username === 'admin' && password === '123456') {
      setIsAuthenticated(true);
      setUser(MOCK_USER);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AppContext.Provider value={{
      isAuthenticated, user, login, logout,
      fields, setFields,
      devices, setDevices,
      plans, setPlans,
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

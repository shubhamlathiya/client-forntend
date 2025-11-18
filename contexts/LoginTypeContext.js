import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginTypeContext = createContext({ loginType: null, setLoginType: () => {} });

export function LoginTypeProvider({ children }) {
  const [loginType, setLoginTypeState] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('loginType');
        if (stored) setLoginTypeState(stored);
      } catch {}
    })();
  }, []);

  const setLoginType = async (type) => {
    try {
      const normalized = type === 'business' ? 'business' : 'individual';
      await AsyncStorage.setItem('loginType', normalized);
      setLoginTypeState(normalized);
    } catch {
      setLoginTypeState(type);
    }
  };

  return (
    <LoginTypeContext.Provider value={{ loginType, setLoginType }}>
      {children}
    </LoginTypeContext.Provider>
  );
}

export function useLoginType() {
  return useContext(LoginTypeContext);
}


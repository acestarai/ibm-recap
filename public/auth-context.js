const { createContext, useContext, useState, useEffect } = React;

const AuthContext = createContext(null);

function normalizeUser(user) {
  if (!user) return null;
  const fullName = user.full_name ?? user.fullName ?? null;

  return {
    ...user,
    full_name: fullName,
    fullName
  };
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'));
  
  // Check if user is logged in on mount
  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);
  
  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(normalizeUser(data.user));
      } else {
        // Token invalid, clear it
        logout();
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }
  
  async function register(email, password, fullName) {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    
    return data;
  }

  async function verifyCode(email, code) {
    const response = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || 'Verification failed');
      error.code = data.code;
      throw error;
    }

    return data;
  }
  
  async function login(email, password) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      const error = new Error(data.error || 'Login failed');
      error.code = data.code;
      throw error;
    }
    
    // Save token
    localStorage.setItem('auth_token', data.token);
    setToken(data.token);
    setUser(normalizeUser(data.user));
    
    return data;
  }
  
  async function logout() {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
    }
  }
  
  async function forgotPassword(email) {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to send reset email');
    }
    
    return data;
  }
  
  async function resetPassword(token, password) {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to reset password');
    }
    
    return data;
  }
  
  async function resendVerification(email) {
    const response = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to resend verification');
    }
    
    return data;
  }

  async function refreshUser() {
    if (!token) return null;
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh user');
      }
      const normalizedUser = normalizeUser(data.user);
      setUser(normalizedUser);
      return normalizedUser;
    } catch (error) {
      console.error('Refresh user error:', error);
      throw error;
    }
  }

  async function updateAccount(fullName) {
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch('/api/auth/account', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ fullName })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update account');
    }

    const normalizedUser = normalizeUser(data.user);
    setUser(normalizedUser);
    return {
      ...data,
      user: normalizedUser
    };
  }
  
  const value = {
    user,
    loading,
    token,
    register,
    verifyCode,
    login,
    logout,
    forgotPassword,
    resetPassword,
    resendVerification,
    refreshUser,
    updateAccount,
    isAuthenticated: !!user
  };
  
  return React.createElement(AuthContext.Provider, { value }, children);
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Made with Bob

const { useState } = React;

function AuthPage() {
  const { login, register, verifyCode, forgotPassword, resendVerification } = useAuth();
  const [mode, setMode] = useState('login'); // 'login', 'signup', 'forgot', 'verify'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    verificationCode: ''
  });
  
  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  }
  
  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(formData.email, formData.password);
      // User will be redirected to main app automatically
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setMode('verify');
        setSuccess('Check your email for the 6-digit code or use the verification link to finish activating your account.');
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleSignup(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await register(formData.email, formData.password, formData.fullName);
      setFormData((current) => ({
        ...current,
        email: result.email || current.email,
        verificationCode: ''
      }));
      setMode('verify');
      setSuccess(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await verifyCode(formData.email, formData.verificationCode);
      setSuccess(result.message);
      setTimeout(() => {
        setMode('login');
        setFormData((current) => ({
          ...current,
          verificationCode: '',
          password: '',
          confirmPassword: ''
        }));
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleForgotPassword(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      const result = await forgotPassword(formData.email);
      setSuccess(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleResendVerification() {
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      const result = await resendVerification(formData.email);
      setSuccess(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Left side - Branding */}
        <div className="auth-branding">
          <div className="auth-branding-content">
            <div className="auth-logo">
              <div className="logo-text">
                <span>IBM </span>
                <span className="logo-recap">
                  Recap
                  <div className="logo-underline"></div>
                </span>
              </div>
            </div>
            <p className="auth-tagline">Transform your Teams calls into actionable insights</p>
            <div className="auth-features">
              <div className="auth-feature">
                <span className="auth-feature-icon">🎙️</span>
                <div>
                  <h3>Upload & Transcribe</h3>
                  <p>Automatically transcribe your meetings with speaker identification</p>
                </div>
              </div>
              <div className="auth-feature">
                <span className="auth-feature-icon">📝</span>
                <div>
                  <h3>AI Summaries</h3>
                  <p>Get structured summaries with action items and key decisions</p>
                </div>
              </div>
              <div className="auth-feature">
                <span className="auth-feature-icon">🔒</span>
                <div>
                  <h3>Secure & Private</h3>
                  <p>Your data is encrypted and stored securely in the cloud</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right side - Auth forms */}
        <div className="auth-forms">
          <div className="auth-form-container">
            {/* Login Form */}
            {mode === 'login' && (
              <div className="auth-form">
                <h2>Welcome back</h2>
                <p className="auth-subtitle">Sign in to your IBM Recap account</p>
                
                {error && <div className="alert alert-error">{error}</div>}
                
                <form onSubmit={handleLogin}>
                  <div className="form-group">
                    <label htmlFor="email">IBM Email</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your.name@ibm.com or your.name@us.ibm.com"
                      required
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter your password"
                      required
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="forgot-password-link">
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setMode('forgot')}
                      disabled={loading}
                    >
                      Forgot password?
                    </button>
                  </div>
                  
                  <button type="submit" className="btn btn-primary btn-block btn-centered" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign in'}
                  </button>
                </form>
                
                <div className="auth-divider">
                  <span>Don't have an account?</span>
                </div>
                
                <button
                  className="btn btn-secondary btn-block btn-centered"
                  onClick={() => setMode('signup')}
                  disabled={loading}
                >
                  Create account
                </button>
              </div>
            )}
            
            {/* Signup Form */}
            {mode === 'signup' && (
              <div className="auth-form">
                <h2>Create your account</h2>
                <p className="auth-subtitle">Get started with IBM Recap</p>
                
                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}
                
                <form onSubmit={handleSignup}>
                  <div className="form-group">
                    <label htmlFor="fullName">Full Name</label>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="John Doe"
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="email">IBM Email *</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your.name@ibm.com or your.name@us.ibm.com"
                      required
                      disabled={loading}
                    />
                    <small>Supported email domains: @ibm.com and @us.ibm.com</small>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="password">Password *</label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create a strong password"
                      required
                      disabled={loading}
                    />
                    <small>At least 8 characters with uppercase, lowercase, and number</small>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="confirmPassword">Confirm Password *</label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Re-enter your password"
                      required
                      disabled={loading}
                    />
                  </div>
                  
                  <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                    {loading ? 'Creating account...' : 'Create account'}
                  </button>
                </form>
                
                <div className="auth-divider">
                  <span>Already have an account?</span>
                </div>
                
                <button
                  className="btn btn-secondary btn-block"
                  onClick={() => setMode('login')}
                  disabled={loading}
                >
                  Sign in
                </button>
              </div>
            )}
            
            {/* Forgot Password Form */}
            {mode === 'forgot' && (
              <div className="auth-form">
                <h2>Reset your password</h2>
                <p className="auth-subtitle">Enter your email to receive a reset link</p>
                
                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}
                
                <form onSubmit={handleForgotPassword}>
                  <div className="form-group">
                    <label htmlFor="email">IBM Email</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your.name@ibm.com or your.name@us.ibm.com"
                      required
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                  
                  <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                    {loading ? 'Sending...' : 'Send reset link'}
                  </button>
                </form>
                
                <div className="auth-divider">
                  <span>Remember your password?</span>
                </div>
                
                <button
                  className="btn btn-secondary btn-block"
                  onClick={() => setMode('login')}
                  disabled={loading}
                >
                  Back to sign in
                </button>
              </div>
            )}
            
            {/* Email Verification Notice */}
            {mode === 'verify' && (
              <div className="auth-form">
                <div className="auth-success-icon">📧</div>
                <h2>Verify your email</h2>
                <p className="auth-subtitle">
                  We sent a verification email to <strong>{formData.email}</strong> with a 6-digit code and a verification link.
                </p>
                
                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}
                
                <form onSubmit={handleVerifyCode}>
                  <div className="form-group">
                    <label htmlFor="verificationCode">Verification Code</label>
                    <input
                      type="text"
                      id="verificationCode"
                      name="verificationCode"
                      value={formData.verificationCode}
                      onChange={handleChange}
                      placeholder="Enter 6-digit code"
                      inputMode="numeric"
                      maxLength="6"
                      required
                      disabled={loading}
                      autoFocus
                    />
                    <small>The code and verification link both expire in 24 hours.</small>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-block"
                    disabled={loading}
                  >
                    {loading ? 'Verifying...' : 'Verify email'}
                  </button>
                </form>

                <div className="auth-divider">
                  <span>Didn't get the code?</span>
                </div>

                <button
                  className="btn btn-secondary btn-block"
                  onClick={handleResendVerification}
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Resend verification email'}
                </button>
                
                <div className="auth-divider">
                  <span>Want to use a different email?</span>
                </div>
                
                <button
                  className="btn btn-secondary btn-block"
                  onClick={() => setMode('signup')}
                  disabled={loading}
                >
                  Back to sign up
                </button>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="auth-footer">
            <p>© 2026 IBM Recap. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Made with Bob

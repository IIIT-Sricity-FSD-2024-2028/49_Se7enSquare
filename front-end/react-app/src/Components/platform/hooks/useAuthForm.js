import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { authService } from '../../../services/authService';
import {
  authFormChanged,
  resetAuthForm,
  loginSuccess,
  loginUser,
  registerUser,
  clearAuthErrors,
  setAuthLoginError,
  setAuthRegError,
  selectLoginLoading,
  selectLoginError,
  selectRegLoading,
  selectRegError,
} from '../../../store/slices/authSlice';
import { toastShown } from '../../../store/slices/uiSlice';
import { initiateGoogleSignIn } from '../../../services/googleAuth';
import { getHomeRoute } from '../../../services/roleAccess';

export const PERSONAS = import.meta.env.DEV ? [
  { name: 'ADMIN (admin01)', username: 'admin01', role: 'admin', icon: '🛡️', pass: 'Demo@123' },
  { name: 'MOD (mod01)', username: 'mod01', role: 'moderator', icon: '🔍', pass: 'Demo@123' },
  { name: 'CM (cm01)', username: 'cm01', role: 'community_manager', icon: '📅', pass: 'Demo@123' },
  { name: 'ORGANIZER (org01)', username: 'org01', role: 'organizer', icon: '🏆', pass: 'Demo@123' },
  { name: 'PLAYER (player01)', username: 'player01', role: 'user', icon: '🎮', pass: 'Demo@123' },
  { name: 'OWNER (sanidhya)', username: 'sanidhya', role: 'owner', icon: '👑', pass: 'Demo@123' },
] : [];

/**
 * Custom hook managing authentication, validation, state, and submissions for the Login/Register page.
 */
export default function useAuthForm() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // ── Redux Auth State ──
  const loginLoading = useAppSelector(selectLoginLoading);
  const reduxLoginError = useAppSelector(selectLoginError);
  const regLoading = useAppSelector(selectRegLoading);
  const reduxRegError = useAppSelector(selectRegError);

  // ── 1. Tab & View State ──
  const {
    currentTab, cardShake, loginEmail, loginPassword, loginRole, rememberMe, showLoginPassword, loginFieldErrors,
    regFullName, regEmail, regHandle, regPassword, regConfirm, regRole, regTerms, showRegPassword, showRegConfirm,
    regFieldErrors, forgotEmail, forgotError, forgotLoading, googleLoading,
  } = useAppSelector((state) => state.auth.form);
  const setCurrentTab = (value) => dispatch(authFormChanged({ currentTab: value }));
  const setCardShake = (value) => dispatch(authFormChanged({ cardShake: value }));
  const setLoginEmail = (value) => dispatch(authFormChanged({ loginEmail: value }));
  const setLoginPassword = (value) => dispatch(authFormChanged({ loginPassword: value }));
  const setLoginRole = (value) => dispatch(authFormChanged({ loginRole: value }));
  const setRememberMe = (value) => dispatch(authFormChanged({ rememberMe: value }));
  const setShowLoginPassword = (value) => dispatch(authFormChanged({ showLoginPassword: value }));
  const setLoginFieldErrors = useCallback((update) => dispatch((send, getState) => {
    const value = typeof update === 'function' ? update(getState().auth.form.loginFieldErrors) : update;
    send(authFormChanged({ loginFieldErrors: value }));
  }), [dispatch]);
  const setRegFullName = (value) => dispatch(authFormChanged({ regFullName: value }));
  const setRegEmail = (value) => dispatch(authFormChanged({ regEmail: value }));
  const setRegHandle = (value) => dispatch(authFormChanged({ regHandle: value }));
  const setRegPassword = (value) => dispatch(authFormChanged({ regPassword: value }));
  const setRegConfirm = (value) => dispatch(authFormChanged({ regConfirm: value }));
  const setRegRole = (value) => dispatch(authFormChanged({ regRole: value }));
  const setRegTerms = (value) => dispatch(authFormChanged({ regTerms: value }));
  const setShowRegPassword = (value) => dispatch(authFormChanged({ showRegPassword: value }));
  const setShowRegConfirm = (value) => dispatch(authFormChanged({ showRegConfirm: value }));
  const setRegFieldErrors = useCallback((update) => dispatch((send, getState) => {
    const value = typeof update === 'function' ? update(getState().auth.form.regFieldErrors) : update;
    send(authFormChanged({ regFieldErrors: value }));
  }), [dispatch]);
  const setForgotEmail = (value) => dispatch(authFormChanged({ forgotEmail: value }));
  const setForgotError = (value) => dispatch(authFormChanged({ forgotError: value }));
  const setForgotLoading = (value) => dispatch(authFormChanged({ forgotLoading: value }));
  const setGoogleLoading = (value) => dispatch(authFormChanged({ googleLoading: value }));

  const shakeTimeout = useRef(null);
  const pageTimers = useRef(new Set());
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const timers = pageTimers.current;
    return () => {
      mounted.current = false;
      clearTimeout(shakeTimeout.current);
      timers.forEach(clearTimeout);
      timers.clear();
      dispatch(resetAuthForm());
      dispatch(clearAuthErrors());
    };
  }, [dispatch]);

  const schedule = (callback, wait) => {
    if (!mounted.current) return;
    const timer = setTimeout(() => {
      pageTimers.current.delete(timer);
      callback();
    }, wait);
    pageTimers.current.add(timer);
  };

  // Tabs: 'login' | 'register' | 'forgot' | 'forgot-success'

  // ── 2. Toast (app-wide Redux toast) ──
  const showToast = useCallback((icon, msg) => dispatch(toastShown({ icon, msg, duration: 3500 })), [dispatch]);

  const triggerShake = () => {
    if (!mounted.current) return;
    setCardShake(true);
    clearTimeout(shakeTimeout.current);
    shakeTimeout.current = setTimeout(() => dispatch(authFormChanged({ cardShake: false })), 450);
  };

  // ── 3. Login Form State & Validation ──

  // Merge client field validation errors with Redux server-side login error
  const loginErrors = useMemo(() => ({
    ...loginFieldErrors,
    ...(reduxLoginError || {}),
  }), [loginFieldErrors, reduxLoginError]);

  const setLoginErrors = useCallback((updater) => {
    if (typeof updater === 'function') {
      setLoginFieldErrors((prev) => {
        const next = updater({ ...prev, ...(reduxLoginError || {}) });
        if (!next.general && reduxLoginError?.general) {
          dispatch(setAuthLoginError(null));
        }
        return next;
      });
    } else if (updater && Object.keys(updater).length === 0) {
      setLoginFieldErrors({});
      dispatch(setAuthLoginError(null));
    } else {
      setLoginFieldErrors(updater || {});
      if (updater?.general) {
        dispatch(setAuthLoginError({ general: updater.general, isSanctioned: updater.isSanctioned }));
      }
    }
  }, [dispatch, reduxLoginError, setLoginFieldErrors]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const accountStatus = params.get('accountStatus');
      const reason = params.get('reason');
      if (accountStatus) {
        const msg =
          reason ||
          (accountStatus === 'ACCOUNT_BANNED'
            ? 'This account has been banned.'
            : 'This account has been suspended.');
        dispatch(setAuthLoginError({ general: msg, isSanctioned: true }));
        showToast('⚠️', msg);
      }
      // Set by handleRoleMismatch() in services/api.js after an admin changed
      // this user's role: explain why they were logged out.
      if (params.get('roleChanged')) {
        const msg = 'Your role was changed by an admin. Please log in again.';
        dispatch(setAuthLoginError({ general: msg, isSanctioned: false }));
        showToast('ℹ️', msg);
      }
    }
  }, [dispatch, showToast]);

  const validateLogin = () => {
    const errors = {};
    const trimmedInput = loginEmail.trim();

    if (!trimmedInput) {
      errors.email = 'Email or username is required.';
    }

    if (!loginPassword) {
      errors.password = 'Password is required.';
    }

    setLoginFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const navigateByRole = (userRole) => {
    navigate(getHomeRoute(userRole));
  };


  const handleLoginSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loginLoading) return;
    if (!validateLogin()) {
      triggerShake();
      showToast('⚠️', 'Please enter your username/email and password.');
      return;
    }

    setLoginFieldErrors({});
    dispatch(clearAuthErrors());

    try {
      const user = await dispatch(loginUser({
        login: loginEmail,
        password: loginPassword,
        role: loginRole,
      })).unwrap();

      showToast(
        '✅',
        `Signed in successfully as ${user.username} (${(user.role || loginRole || 'user').toUpperCase()})!`
      );

      schedule(() => {
        navigateByRole(user.role);
      }, 700);
    } catch (err) {
      console.error('Login request failed:', err);
      triggerShake();
      const failMsg = err?.general || err?.reason || err?.message || 'Cannot reach authentication server';
      showToast('❌', failMsg);
    }
  };

  const handleQuickLogin = (p) => {
    setCurrentTab('login');
    setLoginEmail(p.username);
    setLoginPassword(p.pass);
    setLoginRole(p.role);
    setLoginFieldErrors({});
    dispatch(clearAuthErrors());
    showToast('⚡', `Loaded credentials for ${p.name}`);
  };

  // ── 4. Register Form State & Validation ──

  // Merge client field validation errors with Redux server-side registration error
  const regErrors = useMemo(() => ({
    ...regFieldErrors,
    ...(reduxRegError || {}),
  }), [regFieldErrors, reduxRegError]);

  const setRegErrors = useCallback((updater) => {
    if (typeof updater === 'function') {
      setRegFieldErrors((prev) => {
        const next = updater({ ...prev, ...(reduxRegError || {}) });
        if (!next.general && reduxRegError?.general) {
          dispatch(setAuthRegError(null));
        }
        return next;
      });
    } else if (updater && Object.keys(updater).length === 0) {
      setRegFieldErrors({});
      dispatch(setAuthRegError(null));
    } else {
      setRegFieldErrors(updater || {});
      if (updater?.general) {
        dispatch(setAuthRegError({ general: updater.general }));
      }
    }
  }, [dispatch, reduxRegError, setRegFieldErrors]);

  const getPasswordStrength = (pass) => {
    if (!pass) return { level: '', label: '' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[!@#$%^&*]/.test(pass)) score++;

    const levels = ['', 'weak', 'fair', 'good', 'strong'];
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    return { level: levels[score] || 'weak', label: labels[score] || 'Weak' };
  };

  const strength = getPasswordStrength(regPassword);

  const validateRegister = () => {
    const errors = {};
    if (!regFullName.trim()) errors.fullName = 'Full Name is required.';
    if (!regEmail.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!regHandle.trim()) {
      errors.handle = 'Username is required.';
    } else if (regHandle.trim().length < 3) {
      errors.handle = 'Username must be at least 3 characters.';
    } else if (!/^[a-zA-Z0-9_]+$/.test(regHandle.trim())) {
      errors.handle = 'Username can only contain letters, numbers, and underscores.';
    }

    if (!regPassword) {
      errors.password = 'Password is required.';
    } else if (regPassword.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }

    if (!regConfirm) {
      errors.confirm = 'Please confirm your password.';
    } else if (regPassword !== regConfirm) {
      errors.confirm = 'Passwords do not match.';
    }

    if (!regTerms) {
      errors.terms = 'You must agree to the Terms of Service and Privacy Policy.';
    }

    setRegFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegisterSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (regLoading) return;
    if (!validateRegister()) {
      triggerShake();
      showToast('⚠️', 'Please complete all required registration fields.');
      return;
    }

    setRegFieldErrors({});
    dispatch(clearAuthErrors());

    try {
      const nameParts = regFullName.trim().split(/\s+/);
      const firstName = nameParts[0] || regFullName.trim();
      const lastName = nameParts.slice(1).join(' ') || undefined;

      const createdUser = await dispatch(registerUser({
        username: regHandle,
        email: regEmail,
        password: regPassword,
        role: regRole,
        firstName,
        lastName,
      })).unwrap();

      showToast('🎉', `Account @${createdUser.username} created successfully! Please sign in.`);
      schedule(() => {
        setCurrentTab('login');
        setLoginEmail(createdUser.username);
        setLoginPassword(regPassword);
        setLoginRole(createdUser.role || regRole);
      }, 1000);
    } catch (err) {
      console.error('Registration error:', err);
      triggerShake();
      const failMsg = err?.general || err?.message || 'Unable to connect to registration server';
      showToast('❌', failMsg);
    }
  };

  // ── 5. Forgot Password State ──

  const handleForgotSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!forgotEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      setForgotError('Please enter a valid email address.');
      triggerShake();
      return;
    }

    setForgotError('');
    setForgotLoading(true);

    schedule(() => {
      setForgotLoading(false);
      setCurrentTab('forgot-success');
      showToast('✉️', 'Password reset instructions sent!');
    }, 1200);
  };

  // ── 6. Google Sign-In State & Handler ──

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    try {
      const result = await initiateGoogleSignIn(clientId);

      if (result.error) {
        if (
          result.error === 'ACCESS_DENIED' ||
          result.error === 'POPUP_FAILED' ||
          result.error === 'POPUP_CLOSED'
        ) {
          showToast('ℹ️', result.message || 'Google sign-in was cancelled.');
        } else if (result.error === 'MISSING_CLIENT_ID') {
          showToast('⚠️', result.message);
        } else {
          showToast('❌', result.message || 'Google sign-in failed.');
        }
        setGoogleLoading(false);
        return;
      }

      if (result.accessToken || result.credential) {
        showToast('🔄', 'Signing in with Google...');
        const user = await authService.loginWithGoogle({
          accessToken: result.accessToken,
          credential: result.credential,
        });
        dispatch(loginSuccess(user));

        showToast(
          '🎉',
          `Welcome, ${user.firstName || user.username} (${(user.role || 'user').toUpperCase()})!`
        );

        schedule(() => {
          navigateByRole(user.role);
        }, 700);
      }
    } catch (err) {
      console.error('Google login error:', err);
      triggerShake();
      const failMsg = err.message || 'Google authentication failed';
      showToast('❌', failMsg);
    } finally {
      if (mounted.current) setGoogleLoading(false);
    }
  };

  return {
    navigate,
    currentTab,
    setCurrentTab: (tab) => {
      dispatch(clearAuthErrors());
      setLoginFieldErrors({});
      setRegFieldErrors({});
      setCurrentTab(tab);
    },
    cardShake,
    showToast,
    // Login
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    loginRole,
    setLoginRole,
    rememberMe,
    setRememberMe,
    showLoginPassword,
    setShowLoginPassword,
    loginLoading,
    loginErrors,
    setLoginErrors,
    handleLoginSubmit,
    personas: PERSONAS,
    handleQuickLogin,
    // Register
    regFullName,
    setRegFullName,
    regEmail,
    setRegEmail,
    regHandle,
    setRegHandle,
    regPassword,
    setRegPassword,
    regConfirm,
    setRegConfirm,
    regRole,
    setRegRole,
    regTerms,
    setRegTerms,
    showRegPassword,
    setShowRegPassword,
    showRegConfirm,
    setShowRegConfirm,
    regLoading,
    regErrors,
    setRegErrors,
    strength,
    handleRegisterSubmit,
    // Forgot password
    forgotEmail,
    setForgotEmail,
    forgotError,
    forgotLoading,
    handleForgotSubmit,
    // Google Sign-In
    googleLoading,
    handleGoogleSignIn,
  };
}

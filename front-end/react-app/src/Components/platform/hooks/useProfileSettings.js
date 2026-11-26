import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { selectProfileCompleteness } from '../../../store/selectors/profileSelectors';
import { logoutUser } from '../../../store/slices/authSlice';
import { selectCurrentPlan, selectPricingLoading } from '../../../store/slices/pricingSlice';
import {
  fetchProfileSettings,
  profileFormChanged,
  resetProfileForm,
  profileFieldsOf as fieldsOf,
  getProfileFieldDefault,
  saveProfile,
  changePassword,
  deleteAccount,
  applyOrganizer as applyOrganizerThunk,
  fetchModeratorQuiz,
  applyModerator,
  selectProfileState,
} from '../../../store/slices/profileSlice';
import { DEFAULT_PRIVACY, EMPTY_PASSWORDS, EMPTY_ORGANISER, EMPTY_STATEMENT } from '../data/profileSettingsData';

export default function useProfileSettings() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { me: user, loading, saving, applying, organiser, moderator, settingsForm, settingsErrors, loadErrors } = useAppSelector(selectProfileState);
  const profileCompleteness = useAppSelector(selectProfileCompleteness);
  const currentPlan = useAppSelector(selectCurrentPlan);
  const planLoading = useAppSelector(selectPricingLoading);
  const plan = planLoading ? null : { plan: currentPlan };
  const {
    formData: draftFields, privacy: draftPrivacy, passwords, showPassword, avatarPreview,
    activeTab, toastMsg, applicationErrors: draftApplicationErrors, organiserForm, statement,
    questions, quizAnswers, quizOpen, showCustomOrganiser, deletePassword,
  } = settingsForm;
  const formData = draftFields ?? fieldsOf(user || {});
  const privacy = draftPrivacy ?? { ...DEFAULT_PRIVACY, ...user?.privacy };
  const errors = settingsForm.errors.length ? settingsForm.errors : loadErrors;
  const applicationErrors = draftApplicationErrors ?? settingsErrors;
  const avatarFile = useRef(null);
  const avatarUrl = useRef('');

  const setField = (field, update) => dispatch((send, getState) => {
    const { profile } = getState();
    const previous = profile.settingsForm[field] ?? getProfileFieldDefault(profile, field);
    const value = typeof update === 'function' ? update(previous) : update;
    send(profileFormChanged({ [field]: value }));
  });
  const setFormData = (value) => setField('formData', value);
  const setPrivacy = (value) => setField('privacy', value);
  const setPasswords = (value) => setField('passwords', value);
  const setShowPassword = (value) => setField('showPassword', value);
  const setActiveTab = (value) => setField('activeTab', value);
  const setErrors = (value) => setField('errors', value);
  const setToastMsg = (value) => setField('toastMsg', value);
  const setApplicationErrors = (value) => setField('applicationErrors', value);
  const setOrganiserForm = (value) => setField('organiserForm', value);
  const setStatement = (value) => setField('statement', value);
  const setQuestions = (value) => setField('questions', value);
  const setQuizAnswers = (value) => setField('quizAnswers', value);
  const setQuizOpen = (value) => setField('quizOpen', value);
  const setShowCustomOrganiser = (value) => setField('showCustomOrganiser', value);

  const setAvatarFile = (file) => {
    if (avatarUrl.current) URL.revokeObjectURL(avatarUrl.current);
    avatarFile.current = file;
    avatarUrl.current = file ? URL.createObjectURL(file) : '';
    setField('avatarPreview', avatarUrl.current);
  };

  const resetForms = (profile) => {
    setFormData(fieldsOf(profile));
    setPrivacy({ ...DEFAULT_PRIVACY, ...profile.privacy });
  };

  useEffect(() => {
    dispatch(fetchProfileSettings());
    return () => {
      if (avatarUrl.current) URL.revokeObjectURL(avatarUrl.current);
      avatarUrl.current = '';
      avatarFile.current = null;
      dispatch(resetProfileForm());
    };
  }, [dispatch]);

  const isDirty = Boolean(user && (
    avatarPreview ||
    JSON.stringify(formData) !== JSON.stringify(fieldsOf(user)) ||
    JSON.stringify(privacy) !== JSON.stringify({ ...DEFAULT_PRIVACY, ...user.privacy }) ||
    Object.values(passwords).some(Boolean) ||
    JSON.stringify(organiserForm) !== JSON.stringify(EMPTY_ORGANISER) ||
    JSON.stringify(statement) !== JSON.stringify(EMPTY_STATEMENT) ||
    quizAnswers.some(answer => answer !== undefined)
  ));

  const canDiscard = isDirty || quizOpen;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => prev.filter(e => !e.startsWith(field + ':')));
  };

  const handleAvatarUpload = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setErrors(['avatar: select a PNG, JPG, GIF or WEBP image no larger than 5MB']);
      return;
    }
    setAvatarFile(file);
    setErrors([]);
  };

  const discardChanges = () => {
    if (user) resetForms(user);
    setPasswords(EMPTY_PASSWORDS);
    setAvatarFile(null);
    setErrors([]);
    setShowPassword({});
    setOrganiserForm(EMPTY_ORGANISER);
    setStatement(EMPTY_STATEMENT);
    setQuizAnswers([]);
    setQuizOpen(false);
    setToastMsg('Draft discarded.');
  };

  const changeUserPassword = async () => {
    if (saving || !user) return;
    const validation = [];
    if (user.hasPassword && !passwords.current) validation.push('current: enter your current password');
    if (!passwords.new || passwords.new.length < 8 || !/[A-Za-z]/.test(passwords.new) || !/\d/.test(passwords.new)) {
      validation.push('new: use at least 8 characters, including a letter and a number');
    }
    if (passwords.new !== passwords.confirm) validation.push('confirm: passwords do not match');

    setErrors(validation);
    if (validation.length) return;

    setToastMsg('');
    try {
      await dispatch(changePassword(passwords)).unwrap();
      setPasswords(EMPTY_PASSWORDS);
      setShowPassword({});
      setErrors([]);
      setToastMsg('✅ Password updated successfully!');
    } catch (messages) {
      setErrors(messages);
    }
  };

  const saveAllChanges = async () => {
    if (saving || !user) return;
    const validation = [];

    // Optional firstName length check only if provided
    if (formData.firstName && formData.firstName.trim().length > 50) {
      validation.push('firstName: first name cannot exceed 50 characters');
    }
    // Bio check only if provided
    if (formData.bio && (formData.bio.length < 5 || formData.bio.length > 160)) {
      validation.push('bio: must contain 5 to 160 characters (or leave blank)');
    }

    const wantsPasswordChange = Object.values(passwords).some(Boolean);
    if (wantsPasswordChange) {
      if (user.hasPassword && !passwords.current) validation.push('current: enter your current password');
      if (passwords.new.length < 8 || !/[A-Za-z]/.test(passwords.new) || !/\d/.test(passwords.new)) {
        validation.push('new: use at least 8 characters, including a letter and a number');
      }
      if (passwords.new !== passwords.confirm) validation.push('confirm: passwords do not match');
    }

    setErrors(validation);
    if (validation.length) return;

    setToastMsg('');
    let profileSaved = false;

    const changes = Object.fromEntries(
      Object.entries(formData).filter(([key, value]) => value !== (user[key] ?? ''))
    );
    changes.privacy = privacy;
    if (!avatarFile.current && formData.avatar === '' && user.avatar) changes.avatar = null;

    try {
      const saved = await dispatch(saveProfile({ changes, avatarFile: avatarFile.current })).unwrap();
      resetForms(saved);
      setAvatarFile(null);
      profileSaved = true;

      if (wantsPasswordChange) {
        await dispatch(changePassword(passwords)).unwrap();
        setPasswords(EMPTY_PASSWORDS);
        setShowPassword({});
      }

      setToastMsg('✅ Profile and settings saved successfully.');
    } catch (messages) {
      setErrors(messages);
      if (profileSaved) {
        setToastMsg('Profile saved. Password was not changed; correct the error and try again.');
      }
    }
  };

  const applyOrganizer = async (overrideData) => {
    if (applying) return;
    setApplicationErrors(prev => ({ ...prev, organiser: '' }));

    const submission = overrideData || {
      ...organiserForm,
      expectedTournamentSize: Number(organiserForm.expectedTournamentSize) || 64,
      pastEventLinks: organiserForm.pastEventLinks
        ? organiserForm.pastEventLinks.split('\n').map(s => s.trim()).filter(Boolean)
        : [],
    };

    try {
      await dispatch(applyOrganizerThunk(submission)).unwrap();
      setOrganiserForm(EMPTY_ORGANISER);
      setToastMsg('🎉 Organizer application submitted successfully! Admin review is pending.');
    } catch (messages) {
      setApplicationErrors(prev => ({ ...prev, organiser: messages.join('; ') }));
    }
  };

  // Direct submit helper for organizer with pre-filled valid data
  const directApplyOrganizer = async () => {
    const quickData = {
      experienceNote: 'Experienced esports tournament organizer with over 2 years managing competitive gaming events and brackets.',
      games: 'Valorant, CS:GO, Rocket League, Apex Legends',
      organisations: 'Independent Community League',
      pastEventLinks: [],
      expectedTournamentSize: 64,
      rulesAgreement: true,
    };
    await applyOrganizer(quickData);
  };

  const openQuiz = async () => {
    setApplicationErrors(prev => ({ ...prev, moderator: '' }));
    try {
      const qData = await dispatch(fetchModeratorQuiz()).unwrap();
      setQuestions(qData);
      setQuizAnswers(new Array(qData.length).fill(undefined));
      setStatement(prev => ({
        why: prev.why || 'Passionate about fair play, community guidelines enforcement, and helping players resolve disputes smoothly.',
        timeZone: prev.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
        weeklyHours: prev.weeklyHours || 10,
      }));
      setQuizOpen(true);
    } catch (err) {
      setApplicationErrors(prev => ({ ...prev, moderator: err.message }));
    }
  };

  const submitQuiz = async () => {
    if (applying) return;
    if (questions.some((_, i) => !Number.isInteger(quizAnswers[i]))) {
      setApplicationErrors(prev => ({ ...prev, moderator: 'Please answer every question before submitting.' }));
      return;
    }
    if (!statement.why || statement.why.length < 20) {
      setApplicationErrors(prev => ({ ...prev, moderator: 'Why do you want to moderate? (Must be at least 20 characters).' }));
      return;
    }

    setApplicationErrors(prev => ({ ...prev, moderator: '' }));
    try {
      const data = await dispatch(applyModerator({
        answers: quizAnswers,
        statement: {
          ...statement,
          weeklyHours: Number(statement.weeklyHours) || 10,
        },
      })).unwrap();
      setQuizOpen(false);
      setStatement(EMPTY_STATEMENT);
      setQuizAnswers([]);
      if (data.status === 'pending') {
        setToastMsg(`🎉 Quiz passed with ${data.quizScore}%! Application is pending admin approval.`);
      } else {
        setToastMsg(`Quiz submitted. Status: ${data.status} (Score: ${data.quizScore}%).`);
      }
    } catch (messages) {
      setApplicationErrors(prev => ({ ...prev, moderator: messages.join('; ') }));
    }
  };

  const setDeletePassword = (value) => setField('deletePassword', value);
  const handleDeleteAccount = async (event) => {
    event.preventDefault();
    if (!deletePassword || !window.confirm('Permanently delete your account?')) return;
    setDeletePassword('');
    try {
      await dispatch(deleteAccount(deletePassword)).unwrap();
      navigate('/login');
    } catch (error) {
      setToastMsg(error.message);
    }
  };

  const handleLogout = async () => {
    const result = await dispatch(logoutUser());
    if (logoutUser.fulfilled.match(result)) navigate('/login');
  };

  const initials = `${formData.firstName?.[0] || user?.username?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase() || 'U';

  return {
    user, profileCompleteness, formData, setFormData, privacy, setPrivacy, passwords, setPasswords, showPassword, setShowPassword,
    activeTab, setActiveTab, isDirty, canDiscard, loading, saving, errors, setErrors, toastMsg, initials, avatarPreview,
    handleInputChange, handleAvatarUpload, removePhoto: () => { setAvatarFile(null); handleInputChange('avatar', ''); },
    discardChanges, saveAllChanges, changeUserPassword, handleLogout, navigate, showToast: setToastMsg,
    plan, organiser, moderator, applicationErrors, organiserForm, setOrganiserForm, statement, setStatement,
    questions, quizAnswers, setQuizAnswers, quizOpen, openQuiz, setQuizOpen, applying, applyOrganizer, directApplyOrganizer, submitQuiz,
    showCustomOrganiser, setShowCustomOrganiser, deletePassword, setDeletePassword, handleDeleteAccount,
  };
}

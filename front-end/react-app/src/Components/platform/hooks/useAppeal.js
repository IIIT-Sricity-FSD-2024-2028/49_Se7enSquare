import { useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { selectActiveSanctionSummary } from '../../../store/selectors/profileSelectors';
import { APPEAL_TYPES } from '../data/appealData';
import { selectCurrentUser } from '../../../store/slices/authSlice';
import { fetchMyProfile, selectProfile } from '../../../store/slices/profileSlice';
import {
  fetchActiveSanction,
  fetchMyAppeals,
  submitAppeal,
  appealFormChanged,
  resetAppealForm,
  selectAppealState,
} from '../../../store/slices/appealSlice';

/**
 * Connects the Appeal page to Redux: account status from the profile slice,
 * the active sanction and the user's appeals from the appeal slice.
 * Restriction details come from URL params (set by the Login redirect) when present.
 * The appeal form itself is page-only state.
 */
export default function useAppeal() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const sessionUser = useAppSelector(selectCurrentUser);
  const profile = useAppSelector(selectProfile);
  const { form, myAppeals, loadingAppeals, submitting } = useAppSelector(selectAppealState);

  // Session data first, replaced by the fresh profile (status & reason) once loaded
  const source = profile || sessionUser;
  const user = {
    role: sessionUser?.role || 'user',
    firstName: source?.firstName || 'User',
    username: source?.username || 'user',
    id: sessionUser?.id || null,
    status: source?.status || 'active',
    statusReason: source?.statusReason || '',
  };

  // Restriction from the login redirect, if any
  const { sanction } = useAppSelector(selectActiveSanctionSummary);
  const urlAction = useMemo(() => {
    const code = searchParams.get('accountStatus');
    if (!code) return null;
    return {
      type: code === 'ACCOUNT_BANNED' ? 'Account Ban' : 'Account Suspension',
      reason: searchParams.get('reason') || 'Violation of community guidelines',
      until: searchParams.get('until') || null,
      id: searchParams.get('actionId') || null,
    };
  }, [searchParams]);
  const action = urlAction || sanction;

  const { appealType, statement, commitment, errors, submitted, refId } = form;
  const setAppealType = (value) => dispatch(appealFormChanged({ appealType: value }));
  const setStatement = (value) => dispatch(appealFormChanged({ statement: value }));
  const setCommitment = (value) => dispatch(appealFormChanged({ commitment: value }));
  const setErrors = (value) => dispatch(appealFormChanged({ errors: value }));

  useEffect(() => () => dispatch(resetAppealForm()), [dispatch]);

  // Thunk conditions skip all three when nobody is logged in
  useEffect(() => {
    dispatch(fetchMyProfile());
    dispatch(fetchMyAppeals());
    // The sanctions endpoint may be unavailable if banned: that's ok, action stays null
    if (!urlAction) dispatch(fetchActiveSanction());
  }, [dispatch, urlAction, sessionUser?.id]);

  const validate = () => {
    const errs = {};
    if (!appealType) errs.type = 'Please select an appeal type.';
    if (!statement.trim() || statement.trim().length < 20) {
      errs.statement = 'Your statement must be at least 20 characters.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validate()) return;

    // POST /appeals needs a logged-in user (x-user-id header). Banned or
    // suspended users cannot log in, so without a session the request can
    // only fail. Say so honestly instead of showing a fake reference.
    if (!user.id) {
      setErrors({
        submit: 'You must be logged in to submit an appeal. Banned or suspended accounts cannot log in, so please contact an administrator.',
      });
      return;
    }

    const payload = {
      userId: Number(user.id),
      actionId: action?.id || `ACT-${Date.now()}`,
      text: statement.trim(),
      acknowledgement: (commitment || 'I agree to the platform community guidelines').slice(0, 95),
      resolution: (appealType || 'Reconsideration').slice(0, 95),
      evidence: [],
    };

    return dispatch(submitAppeal(payload));
  };

  const resetForm = () => dispatch(resetAppealForm());

  return {
    navigate,
    user,
    action,
    // Form state
    appealType,
    setAppealType,
    statement,
    setStatement,
    commitment,
    setCommitment,
    errors,
    // Submission
    submitted,
    submitting,
    refId,
    handleSubmit,
    resetForm,
    // Previous appeals
    myAppeals,
    loadingAppeals,
    APPEAL_TYPES,
  };
}

import { useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { toastShown } from '../../../store/slices/uiSlice';
import {
  fetchCommunitySettings,
  saveCommunitySettings,
  removeMember,
  uploadBanner,
  fieldChanged,
  memberRoleChanged,
  channelDeleted,
  channelCreated,
  changesDiscarded,
  setActiveTab as setActiveTabAction,
  setModalOpen as setModalOpenAction,
  setNewChName as setNewChNameAction,
  setNewChType as setNewChTypeAction,
  resetCommunitySettings,
  selectCommunitySettings,
  selectSettingsActiveTab,
  selectSettingsModalOpen,
  selectNewChName,
  selectNewChType,
} from '../../../store/slices/communitySettingsSlice';

/**
 * Custom hook connecting the Community Settings page to the Redux communitySettings slice.
 * All draft, tab, and channel creation modal states are fully managed by Redux.
 */
export default function useCommunitySettings() {
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const communityId = paramId || searchParams.get('id') || '1';

  const dispatch = useAppDispatch();
  const { community, loading, isDirty } = useAppSelector(selectCommunitySettings);

  // Redux UI State
  const activeTab = useAppSelector(selectSettingsActiveTab);
  const modalOpen = useAppSelector(selectSettingsModalOpen);
  const newChName = useAppSelector(selectNewChName);
  const newChType = useAppSelector(selectNewChType);

  const setActiveTab = useCallback((tab) => dispatch(setActiveTabAction(tab)), [dispatch]);
  const setModalOpen = useCallback((open) => dispatch(setModalOpenAction(open)), [dispatch]);
  const setNewChName = useCallback((name) => dispatch(setNewChNameAction(name)), [dispatch]);
  const setNewChType = useCallback((type) => dispatch(setNewChTypeAction(type)), [dispatch]);

  const showToast = useCallback((msg) => dispatch(toastShown({ msg })), [dispatch]);

  useEffect(() => {
    dispatch(fetchCommunitySettings(communityId));
  }, [dispatch, communityId]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      dispatch(resetCommunitySettings());
    };
  }, [dispatch]);

  const handleFieldChange = (field, value) => {
    dispatch(fieldChanged({ field, value }));
  };

  const handleMemberRoleChange = (memberId, newRole) => {
    dispatch(memberRoleChanged({ memberId, role: newRole }));
    showToast(`Role updated to ${newRole}`);
  };

  const handleRemoveMember = async (memberId) => {
    try {
      await dispatch(removeMember(memberId)).unwrap();
      showToast('✅ Member removed');
    } catch (err) {
      showToast(`⚠️ ${err.message || 'Could not remove member'}`);
    }
  };

  const handleDeleteChannel = (channelId) => {
    dispatch(channelDeleted(channelId));
    showToast('Channel deleted');
  };

  const handleCreateChannel = (e) => {
    e.preventDefault();
    if (!newChName.trim()) {
      showToast('⚠️ Channel name is required');
      return;
    }
    const action = dispatch(channelCreated({ name: newChName, type: newChType }));
    dispatch(setNewChNameAction(''));
    dispatch(setModalOpenAction(false));
    showToast(`Channel #${action.payload.name} created`);
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      showToast('⚠️ Please upload a valid image file (PNG, JPG, GIF, or WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('⚠️ Image must be smaller than 5MB');
      return;
    }
    try {
      await dispatch(uploadBanner(file)).unwrap();
      showToast('📷 Banner updated! Save to persist.');
    } catch (err) {
      showToast(`⚠️ ${err.message || 'Banner upload failed'}`);
    }
  };

  const saveSettings = async () => {
    try {
      await dispatch(saveCommunitySettings()).unwrap();
      showToast('✅ Community settings saved successfully!');
    } catch (err) {
      showToast(`⚠️ ${err.message || 'Could not save settings'}`);
    }
  };

  const discardSettings = () => {
    dispatch(changesDiscarded());
    showToast('Changes discarded.');
  };

  return {
    communityId,
    activeTab,
    setActiveTab,
    loading,
    isDirty,
    community,
    modalOpen,
    setModalOpen,
    newChName,
    setNewChName,
    newChType,
    setNewChType,
    handleFieldChange,
    handleMemberRoleChange,
    handleRemoveMember,
    handleDeleteChannel,
    handleCreateChannel,
    handleBannerUpload,
    saveSettings,
    discardSettings,
  };
}

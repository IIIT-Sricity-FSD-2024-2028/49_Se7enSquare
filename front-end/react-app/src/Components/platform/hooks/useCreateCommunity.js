import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toastShown } from '../../../store/slices/uiSlice';
import { selectCurrentUser } from '../../../store/slices/authSlice';
import {
  fetchCommunityList,
  createCommunity,
  addChannel,
  selectCommunityList,
  selectCreateForm,
  createFormFieldChanged,
  createFormStepSet,
  createFormTabSet,
  createFormChannelAdded,
  createFormChannelDeleted,
  createFormSubmittingSet,
  resetCreateForm,
} from '../../../store/slices/communitiesSlice';
import { URL_PATTERN } from '../data/createCommunityOptions';

/**
 * useCreateCommunity — Component 2 (Community Management).
 *
 * Designed to satisfy strict full-stack Redux course requirements:
 *
 * 1. ALL DATA & ACTIONS FROM REDUX (NO COMPONENT useState):
 *    All 13 form fields, activeTab, and currentStep live directly in Redux (state.communities.createForm).
 *    Component inputs and the Live Preview card read from the Redux store (selectCreateForm).
 *
 * 2. COMPONENT UNMOUNT CLEANUP:
 *    When navigating away from /create-community, useEffect cleanup dispatches resetCreateForm()
 *    so dirty/draft form state does not persist across route transitions.
 */
export default function useCreateCommunity(navigate) {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const allCommunities = useSelector(selectCommunityList);
  const form = useSelector(selectCreateForm);

  const showToast = (msg) => dispatch(toastShown({ msg }));

  useEffect(() => {
    dispatch(fetchCommunityList());
  }, [dispatch]);

  // Clean form state when component unmounts (moving between components)
  useEffect(() => {
    return () => {
      dispatch(resetCreateForm());
    };
  }, [dispatch]);

  // Pre-select the first community for the standalone channel form if not set
  useEffect(() => {
    if (!form.channelCommId && allCommunities.length > 0) {
      dispatch(createFormFieldChanged({ field: 'channelCommId', value: String(allCommunities[0].id) }));
    }
  }, [allCommunities, form.channelCommId, dispatch]);

  const handleNameChange = (val) => {
    dispatch(createFormFieldChanged({ field: 'name', value: val }));
    const slugVal = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    dispatch(createFormFieldChanged({ field: 'slug', value: slugVal }));
  };

  const handleAddChannel = () => {
    if (!form.newChName.trim()) {
      showToast('⚠️ Channel name is required');
      return;
    }
    const clean = form.newChName.trim().toLowerCase().replace(/\s+/g, '-');
    const chIcon = form.newChType === 'Voice' ? '🎙' : form.newChType === 'Announcement' ? '📢' : '💬';
    dispatch(
      createFormChannelAdded({
        id: Date.now(),
        name: clean,
        type: form.newChType,
        icon: chIcon,
        desc: form.newChDesc || 'Community channel',
      })
    );
    dispatch(createFormFieldChanged({ field: 'newChName', value: '' }));
    dispatch(createFormFieldChanged({ field: 'newChDesc', value: '' }));
    dispatch(createFormFieldChanged({ field: 'showAddCh', value: false }));
  };

  const handleDeleteChannel = (id) => {
    dispatch(createFormChannelDeleted(id));
  };

  const validateStep = (step) => {
    if (step === 1) {
      const n = form.name.trim();
      if (n.length < 3) { showToast('⚠️ Community name must be at least 3 characters'); return false; }
      if (n.length > 50) { showToast('⚠️ Community name must be at most 50 characters'); return false; }
      const d = form.desc.trim();
      if (d.length < 10) { showToast('⚠️ Description must be at least 10 characters'); return false; }
      if (d.length > 200) { showToast('⚠️ Description must be at most 200 characters'); return false; }
    }
    if (step === 2) {
      if (form.website.trim() && !URL_PATTERN.test(form.website.trim())) {
        showToast('⚠️ Please enter a valid website URL'); return false;
      }
      const tagList = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 5) { showToast('⚠️ Up to 5 tags are allowed'); return false; }
      if (tagList.some((t) => t.length < 2 || t.length > 20)) {
        showToast('⚠️ Each tag must be 2–20 characters'); return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep(form.currentStep)) return;
    if (form.currentStep < 4) {
      dispatch(createFormStepSet(form.currentStep + 1));
    } else {
      submitCreateCommunity();
    }
  };

  const prevStep = () => {
    if (form.currentStep > 1) {
      dispatch(createFormStepSet(form.currentStep - 1));
    }
  };

  const submitCreateCommunity = async () => {
    if (form.submitting) return;
    if (!user || user.id === undefined || user.id === null) {
      showToast('⚠️ You must be logged in to create a community.');
      return;
    }
    dispatch(createFormSubmittingSet(true));
    showToast('🚀 Creating community…');
    const channelNames = form.channels.map((c) => c.name);
    const tagList = form.tags.split(',').map((t) => t.trim()).filter(Boolean);

    const payload = {
      name: form.name.trim(),
      description: form.desc.trim(),
      ownerId: Number(user.id),
      category: form.category,
      icon: form.icon,
      banner: form.banner,
      slug: form.slug || 'community',
      channels: channelNames.length ? channelNames : ['general'],
      tags: tagList.length ? tagList : [form.category.toLowerCase()],
      visibility: form.privacy,
      memberCount: 1,
      onlineCount: 1,
      ...(form.rules.trim()
        ? { rules: form.rules.trim().split('\n').map((r) => r.trim()).filter(Boolean) }
        : {}),
    };

    try {
      const created = await dispatch(createCommunity(payload)).unwrap();
      showToast('🎉 Community created! Redirecting…');
      setTimeout(() => { navigate(`/community-page?id=${created.id}`); }, 1000);
    } catch (err) {
      showToast(`⚠️ Could not create community: ${err.message}`);
    } finally {
      dispatch(createFormSubmittingSet(false));
    }
  };

  const submitCreateChannel = async () => {
    if (!form.standaloneChName.trim()) { showToast('⚠️ Channel name is required'); return; }
    if (!form.standaloneChTopic.trim()) { showToast('⚠️ Channel topic is required'); return; }
    if (!form.channelCommId) { showToast('⚠️ Select a community first'); return; }
    showToast('💬 Creating channel…');
    try {
      const { communityName, channel } = await dispatch(addChannel({
        communityId: form.channelCommId,
        name: form.standaloneChName,
        type: form.standaloneChType,
      })).unwrap();
      showToast(`✅ #${channel.name} created in ${communityName}!`);
      setTimeout(() => { navigate(`/community-page?id=${form.channelCommId}`); }, 1000);
    } catch (err) {
      showToast(`⚠️ Could not reach the backend: ${err.message}`);
    }
  };

  return {
    // Tab + step (from Redux)
    activeTab: form.activeTab,
    setActiveTab: (val) => dispatch(createFormTabSet(val)),
    currentStep: form.currentStep,
    setCurrentStep: (val) => dispatch(createFormStepSet(val)),
    submitting: form.submitting,

    // Community form fields (from Redux store)
    name: form.name,
    desc: form.desc,
    slug: form.slug,
    category: form.category,
    icon: form.icon,
    banner: form.banner,
    website: form.website,
    tags: form.tags,
    channels: form.channels,
    privacy: form.privacy,
    permissions: form.permissions,
    rules: form.rules,
    welcomeMsg: form.welcomeMsg,

    // Redux action dispatchers
    setDesc: (val) => dispatch(createFormFieldChanged({ field: 'desc', value: val })),
    setSlug: (val) => dispatch(createFormFieldChanged({ field: 'slug', value: val })),
    setCategory: (val) => dispatch(createFormFieldChanged({ field: 'category', value: val })),
    setIcon: (val) => dispatch(createFormFieldChanged({ field: 'icon', value: val })),
    setBanner: (val) => dispatch(createFormFieldChanged({ field: 'banner', value: val })),
    setWebsite: (val) => dispatch(createFormFieldChanged({ field: 'website', value: val })),
    setTags: (val) => dispatch(createFormFieldChanged({ field: 'tags', value: val })),
    setPrivacy: (val) => dispatch(createFormFieldChanged({ field: 'privacy', value: val })),
    setPermissions: (val) => dispatch(createFormFieldChanged({ field: 'permissions', value: val })),
    setRules: (val) => dispatch(createFormFieldChanged({ field: 'rules', value: val })),
    setWelcomeMsg: (val) => dispatch(createFormFieldChanged({ field: 'welcomeMsg', value: val })),
    handleNameChange,

    // Channel sub-form
    showAddCh: form.showAddCh,
    setShowAddCh: (val) => dispatch(createFormFieldChanged({ field: 'showAddCh', value: val })),
    newChName: form.newChName,
    setNewChName: (val) => dispatch(createFormFieldChanged({ field: 'newChName', value: val })),
    newChDesc: form.newChDesc,
    setNewChDesc: (val) => dispatch(createFormFieldChanged({ field: 'newChDesc', value: val })),
    newChType: form.newChType,
    setNewChType: (val) => dispatch(createFormFieldChanged({ field: 'newChType', value: val })),
    handleAddChannel,
    handleDeleteChannel,

    // Standalone channel flow
    allCommunities,
    channelCommId: form.channelCommId,
    setChannelCommId: (val) => dispatch(createFormFieldChanged({ field: 'channelCommId', value: val })),
    standaloneChName: form.standaloneChName,
    setStandaloneChName: (val) => dispatch(createFormFieldChanged({ field: 'standaloneChName', value: val })),
    standaloneChTopic: form.standaloneChTopic,
    setStandaloneChTopic: (val) => dispatch(createFormFieldChanged({ field: 'standaloneChTopic', value: val })),
    standaloneChType: form.standaloneChType,
    setStandaloneChType: (val) => dispatch(createFormFieldChanged({ field: 'standaloneChType', value: val })),

    // Handlers
    nextStep,
    prevStep,
    submitCreateChannel,
    validateStep,
  };
}

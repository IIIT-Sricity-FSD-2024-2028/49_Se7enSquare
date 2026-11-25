import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../services/api';
import { DEFAULT_COMMUNITY } from '../../Components/platform/data/defaultCommunityData';
import { logout } from './authSlice';

/**
 * Community Settings slice: the community being edited (a draft), a snapshot
 * of what the server has (for Discard), active tab, modal state, and channel creation form.
 *
 * CRUD operations:
 * - Read:   fetchCommunitySettings (GET /api/communities/:id)
 * - Update: saveCommunitySettings  (PATCH /api/communities/:id)
 *           uploadBanner           (POST /api/uploads)
 *           createChannel          (PATCH /api/communities/:id)
 * - Delete: removeMember           (DELETE /api/memberships/:id)
 */

// Loads the community, its memberships and users in parallel and shapes them for the form
export const fetchCommunitySettings = createAsyncThunk(
  'communitySettings/fetch',
  async (communityId, { rejectWithValue }) => {
    try {
      const [data, mems, usrs] = await Promise.all([
        apiRequest(`/communities/${communityId}`),
        apiRequest(`/memberships?communityId=${communityId}`).catch(() => null),
        apiRequest(`/users?communityId=${communityId}`).catch(() => null),
      ]);

      let members = [];
      if (Array.isArray(mems) && Array.isArray(usrs)) {
        const usersById = new Map(usrs.map((u) => [String(u.id), u]));
        members = mems.map((m) => {
          const u = usersById.get(String(m.userId)) || {};
          const uName = u.fullName || u.name || u.username || `User #${m.userId}`;
          return {
            id: m.id,
            userId: m.userId,
            name: uName,
            handle: `@${u.username || 'user'}`,
            role: u.id === data.ownerId ? 'Owner' : (u.role || 'Member'),
            initials: uName.slice(0, 2).toUpperCase(),
          };
        });
      }

      return {
        ...DEFAULT_COMMUNITY,
        ...data,
        members,
        rules: Array.isArray(data.rules) ? data.rules.join('\n') : data.rules || DEFAULT_COMMUNITY.rules,
        channels: Array.isArray(data.channels)
          ? data.channels.map((ch, idx) => (typeof ch === 'string' ? { id: idx + 1, name: ch, type: 'Text' } : ch))
          : DEFAULT_COMMUNITY.channels,
      };
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to fetch community settings' });
    }
  }
);

// PATCH /communities/:id with the draft from the store
export const saveCommunitySettings = createAsyncThunk(
  'communitySettings/save',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { communityId, community } = getState().communitySettings;

      const rules = typeof community.rules === 'string'
        ? community.rules.split('\n').map((r) => r.trim()).filter(Boolean)
        : community.rules;

      // Normalise channels to plain objects the backend can store
      const channels = (community.channels || []).map((ch, idx) => ({
        id: ch.id ? String(ch.id) : (ch.name ? String(ch.name) : String(idx + 1)),
        name: ch.name,
        type: ch.type || 'Text',
        topic: ch.topic || `#${ch.name} channel`,
      }));

      const res = await apiRequest(`/communities/${communityId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: community.name,
          description: community.description,
          banner: community.banner || undefined,
          rules,
          channels,
        }),
      });
      return res;
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to save community settings' });
    }
  }
);

// Creates a channel and commits it to the backend community channels
export const createChannel = createAsyncThunk(
  'communitySettings/createChannel',
  async ({ communityId, name, type }, { getState, rejectWithValue }) => {
    try {
      const state = getState().communitySettings;
      const targetId = communityId || state.communityId;
      const cleanName = name.trim().toLowerCase().replace(/\s+/g, '-');
      const newChannel = { id: Date.now(), name: cleanName, type: type || 'Text', topic: `#${cleanName} channel` };
      const currentChannels = state.community.channels || [];
      const updatedChannels = [...currentChannels, newChannel];
      const res = await apiRequest(`/communities/${targetId}`, {
        method: 'PATCH',
        body: JSON.stringify({ channels: updatedChannels }),
      });
      return { channel: newChannel, res };
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to create channel' });
    }
  }
);

// DELETE /memberships/:id takes effect immediately
export const removeMember = createAsyncThunk(
  'communitySettings/removeMember',
  async (memberId, { rejectWithValue }) => {
    try {
      await apiRequest(`/memberships/${memberId}`, { method: 'DELETE' });
      return memberId;
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to remove member' });
    }
  }
);

// Uploads the image first and returns short URL
export const uploadBanner = createAsyncThunk(
  'communitySettings/uploadBanner',
  async (file, { rejectWithValue }) => {
    try {
      const upload = new FormData();
      upload.append('file', file);
      const { fileUrl } = await apiRequest('/uploads', { method: 'POST', body: upload });
      return fileUrl;
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Failed to upload banner' });
    }
  }
);

const initialState = {
  communityId: null,
  community: DEFAULT_COMMUNITY,
  initialCommunity: DEFAULT_COMMUNITY,
  loading: true,
  saving: false,
  isDirty: false,
  // UI State moved to Redux
  activeTab: 'general',
  modalOpen: false,
  newChName: '',
  newChType: 'Text',
};

const communitySettingsSlice = createSlice({
  name: 'communitySettings',
  initialState,
  reducers: {
    fieldChanged(state, action) {
      const { field, value } = action.payload;
      state.community[field] = value;
      state.isDirty = true;
    },
    memberRoleChanged(state, action) {
      const { memberId, role } = action.payload;
      const member = state.community.members.find((m) => m.id === memberId);
      if (member) member.role = role;
      state.isDirty = true;
    },
    channelDeleted(state, action) {
      state.community.channels = state.community.channels.filter((c) => c.id !== action.payload);
      state.isDirty = true;
    },
    channelCreated: {
      reducer(state, action) {
        state.community.channels.push(action.payload);
        state.isDirty = true;
      },
      prepare({ name, type }) {
        const cleanName = name.trim().toLowerCase().replace(/\s+/g, '-');
        return { payload: { id: Date.now(), name: cleanName, type } };
      },
    },
    changesDiscarded(state) {
      state.community = state.initialCommunity;
      state.isDirty = false;
    },
    setActiveTab(state, action) {
      state.activeTab = action.payload;
    },
    setModalOpen(state, action) {
      state.modalOpen = action.payload;
    },
    setNewChName(state, action) {
      state.newChName = action.payload;
    },
    setNewChType(state, action) {
      state.newChType = action.payload;
    },
    resetCommunitySettings() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCommunitySettings.pending, (state, action) => {
        if (action.meta.arg !== state.communityId) {
          state.community = DEFAULT_COMMUNITY;
          state.initialCommunity = DEFAULT_COMMUNITY;
        }
        state.communityId = action.meta.arg;
        state.loading = true;
        state.isDirty = false;
      })
      .addCase(fetchCommunitySettings.fulfilled, (state, action) => {
        state.loading = false;
        state.community = action.payload;
        state.initialCommunity = action.payload;
      })
      .addCase(fetchCommunitySettings.rejected, (state) => {
        state.loading = false;
      })
      .addCase(saveCommunitySettings.pending, (state) => {
        state.saving = true;
      })
      .addCase(saveCommunitySettings.fulfilled, (state, action) => {
        const saved = action.payload;
        const updated = saved && typeof saved === 'object'
          ? {
              ...state.community,
              ...saved,
              rules: Array.isArray(saved.rules) ? saved.rules.join('\n') : (saved.rules || state.community.rules),
              channels: Array.isArray(saved.channels) ? saved.channels : state.community.channels,
            }
          : state.community;
        state.community = updated;
        state.initialCommunity = updated;
        state.saving = false;
        state.isDirty = false;
      })
      .addCase(saveCommunitySettings.rejected, (state) => {
        state.saving = false;
      })
      .addCase(createChannel.fulfilled, (state, action) => {
        state.community.channels.push(action.payload.channel);
        state.modalOpen = false;
        state.newChName = '';
        state.newChType = 'Text';
        state.isDirty = false;
      })
      .addCase(removeMember.fulfilled, (state, action) => {
        const keep = (m) => m.id !== action.payload;
        state.community.members = state.community.members.filter(keep);
        state.initialCommunity.members = state.initialCommunity.members.filter(keep);
      })
      .addCase(uploadBanner.fulfilled, (state, action) => {
        state.community.banner = action.payload;
        state.isDirty = true;
      })
      .addCase(logout, () => initialState);
  },
});

export const {
  fieldChanged,
  memberRoleChanged,
  channelDeleted,
  channelCreated,
  changesDiscarded,
  setActiveTab,
  setModalOpen,
  setNewChName,
  setNewChType,
  resetCommunitySettings,
} = communitySettingsSlice.actions;

export const selectCommunitySettings = (state) => state.communitySettings;
export const selectSettingsActiveTab = (state) => state.communitySettings.activeTab;
export const selectSettingsModalOpen = (state) => state.communitySettings.modalOpen;
export const selectNewChName = (state) => state.communitySettings.newChName;
export const selectNewChType = (state) => state.communitySettings.newChType;

export default communitySettingsSlice.reducer;

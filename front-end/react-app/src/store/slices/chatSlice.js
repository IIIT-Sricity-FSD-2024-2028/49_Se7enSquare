import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../services/api';
import { DEFAULT_CHANNELS } from '../../Components/platform/data/chatData';
import { logout } from './authSlice';

const asArray = (data) => (Array.isArray(data) ? data : []);
const timeOf = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Backend stores reactions as { "👍": [userId, userId, ...] } (who reacted).
// The count is the array length. Emojis with nobody left are hidden.
function toReactionList(reactions) {
  if (!reactions || typeof reactions !== 'object') return [];
  return Object.entries(reactions)
    .map(([emoji, userIds]) => ({ emoji, count: Array.isArray(userIds) ? userIds.length : 0 }))
    .filter((r) => r.count > 0);
}

function toMessage(m) {
  const authorName = m.authorName || m.author?.name || m.author || 'User';
  return {
    id: m.id,
    pinned: Boolean(m.pinned),
    authorId: m.authorId,
    author: authorName,
    initials: authorName.slice(0, 2).toUpperCase(),
    color: '#6366f1',
    text: m.content || '',
    time: timeOf(m.createdAt),
    reactions: toReactionList(m.reactions),
  };
}

// Channels live on the community record. Resolves with [] when it has none.
export const fetchChatChannels = createAsyncThunk('chat/fetchChannels', async (communityId) => {
  const comm = await apiRequest(`/communities/${communityId}`);
  return asArray(comm?.channels).map((c, idx) => ({
    id: typeof c === 'string' ? c : c.id || c.name || String(idx + 1),
    name: typeof c === 'string' ? c : c.name,
    topic: typeof c === 'object' && c.topic ? c.topic : `#${typeof c === 'string' ? c : c.name} channel`,
  }));
});

export const fetchChatMembers = createAsyncThunk('chat/fetchMembers', async (communityId) => {
  const [mems, usrs] = await Promise.all([
    apiRequest(`/memberships?communityId=${communityId}`),
    apiRequest(`/users?communityId=${communityId}`),
  ]);
  const userMap = new Map(asArray(usrs).map((u) => [String(u.id), u]));
  return asArray(mems).map((m) => {
    const u = userMap.get(String(m.userId)) || {};
    const name = u.fullName || u.username || `User #${m.userId}`;
    return {
      name,
      userId: m.userId,
      avatar: u.avatar,
      role: u.role || 'Member',
      status: u.status || 'active',
      initials: name.slice(0, 2).toUpperCase(),
      color: '#6366f1',
    };
  });
});

// Channel ids like "general" exist in every community, so filter by both
// communityId and channelId, or messages from all communities get mixed.
export const fetchChatMessages = createAsyncThunk('chat/fetchMessages', async ({ communityId, channelId }) => {
  const data = await apiRequest(
    `/messages?communityId=${encodeURIComponent(communityId)}&channelId=${encodeURIComponent(channelId)}`
  );
  return asArray(data).map(toMessage);
});

export const sendChatMessage = createAsyncThunk(
  'chat/send',
  async ({ communityId, channelId, content, authorName }, { getState }) => {
    const userId = getState().auth.user?.id;
    const created = await apiRequest('/messages', {
      method: 'POST',
      body: JSON.stringify({
        channelId: String(channelId),
        content,
        communityId: Number(communityId),
        authorId: userId ? Number(userId) : undefined,
        authorName,
      }),
    });
    return toMessage(created);
  },
  { condition: (_, { getState }) => !getState().chat.sendingMessage }
);

// The backend toggles (second click removes your reaction) and returns the
// updated message, so the real counts are shown instead of guessing "+1".
export const toggleChatReaction = createAsyncThunk(
  'chat/toggleReaction',
  async ({ msgId, emoji, actorName }, { getState }) => {
    const userId = getState().auth.user?.id;
    const updated = await apiRequest(`/messages/${msgId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji, actorId: userId ? Number(userId) : undefined, actorName }),
    });
    return { msgId, reactions: toReactionList(updated?.reactions) };
  }
);

export const togglePinMessage = createAsyncThunk(
  'chat/togglePin',
  async (id) => toMessage(await apiRequest(`/messages/${id}/pin`, { method: 'PATCH' })),
);

export const deleteChatMessage = createAsyncThunk(
  'chat/delete',
  (id) => apiRequest(`/messages/${id}`, { method: 'DELETE' }),
);

const initialState = {
  selectedChannelId: null,
  msgInput: '',
  channelSearch: '',
  msgSearchQuery: '',
  replyTo: null,
  activeMenuId: null,
  showEmojiPicker: false,
  showSearch: false,
  showPinned: false,
  showMembers: true,
  muted: false,
  deafened: false,
  sendRequestId: null,
  sendingMessage: false,
  messageScope: null,
  channelsRequestId: null,
  channels: DEFAULT_CHANNELS,
  channelsLoading: true,
  membersRequestId: null,
  members: [],
  messages: [],
  messagesRequestId: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    chatUiChanged(state, { payload }) {
      Object.assign(state, payload);
    },
    // No community selected: nothing to load or show
    chatCleared: () => ({ ...initialState, channelsLoading: false }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChatChannels.pending, (state, action) => {
        state.channelsRequestId = action.meta.requestId;
        state.channelsLoading = true;
      })
      .addCase(fetchChatChannels.fulfilled, (state, action) => {
        if (state.channelsRequestId !== action.meta.requestId) return;
        state.channelsRequestId = null;
        state.channelsLoading = false;
        state.channels = action.payload.length > 0 ? action.payload : DEFAULT_CHANNELS;
      })
      .addCase(fetchChatChannels.rejected, (state, action) => {
        if (state.channelsRequestId !== action.meta.requestId) return;
        state.channelsRequestId = null;
        state.channelsLoading = false;
        state.channels = DEFAULT_CHANNELS;
      })
      .addCase(fetchChatMembers.pending, (state, action) => {
        state.membersRequestId = action.meta.requestId;
      })
      .addCase(fetchChatMembers.fulfilled, (state, action) => {
        if (state.membersRequestId !== action.meta.requestId) return;
        state.membersRequestId = null;
        state.members = action.payload;
      })
      .addCase(fetchChatMembers.rejected, (state, action) => {
        if (state.membersRequestId !== action.meta.requestId) return;
        state.membersRequestId = null;
        state.members = [];
      })

      // Only the latest request may fill the feed: switching channels quickly
      // must not show a slower, earlier channel's messages.
      .addCase(fetchChatMessages.pending, (state, action) => {
        state.messagesRequestId = action.meta.requestId;
        state.messageScope = action.meta.arg;
      })
      .addCase(fetchChatMessages.fulfilled, (state, action) => {
        if (action.meta.requestId === state.messagesRequestId) state.messages = action.payload;
      })
      .addCase(fetchChatMessages.rejected, (state, action) => {
        if (action.meta.requestId === state.messagesRequestId) state.messages = [];
      })

      .addCase(sendChatMessage.pending, (state, action) => {
        state.sendingMessage = true;
        state.sendRequestId = action.meta.requestId;
      })
      .addCase(sendChatMessage.fulfilled, (state, action) => {
        if (state.sendRequestId !== action.meta.requestId) return;
        state.sendingMessage = false;
        state.sendRequestId = null;
        const { communityId, channelId } = action.meta.arg;
        if (state.messageScope?.communityId === communityId &&
            state.messageScope?.channelId === channelId &&
            !state.messages.some(({ id }) => id === action.payload.id)) {
          state.messages.push(action.payload);
        }
      })
      .addCase(sendChatMessage.rejected, (state, action) => {
        if (state.sendRequestId !== action.meta.requestId) return;
        state.sendingMessage = false;
        state.sendRequestId = null;
      })
      .addCase(togglePinMessage.fulfilled, (state, action) => {
        const message = state.messages.find(({ id }) => id === action.payload.id);
        if (message) message.pinned = action.payload.pinned;
      })
      .addCase(deleteChatMessage.fulfilled, (state, action) => {
        state.messages = state.messages.filter(({ id }) => id !== action.payload.id);
      })

      .addCase(toggleChatReaction.fulfilled, (state, action) => {
        const msg = state.messages.find((m) => m.id === action.payload.msgId);
        if (msg) msg.reactions = action.payload.reactions;
      })

      .addCase(logout, () => initialState);
  },
});

export const { chatCleared, chatUiChanged } = chatSlice.actions;

export const selectChat = (state) => state.chat;

export default chatSlice.reducer;

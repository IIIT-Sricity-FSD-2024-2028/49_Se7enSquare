import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { DEFAULT_CHANNELS, EMOJIS } from '../data/chatData';
import { selectCurrentUser } from '../../../store/slices/authSlice';
import { toastShown } from '../../../store/slices/uiSlice';
import {
  fetchChatChannels,
  fetchChatMembers,
  fetchChatMessages,
  sendChatMessage,
  toggleChatReaction,
  togglePinMessage,
  deleteChatMessage,
  chatUiChanged,
  chatCleared,
  selectChat,
} from '../../../store/slices/chatSlice';

import { selectFilteredChannels, selectFilteredMessages, selectPinnedMessages, selectChatStats } from '../../../store/selectors/chatSelectors';

// Shown when the page is opened without ?community=
const NO_COMMUNITY_CHANNEL = { id: 'general', name: 'general', topic: 'The main hub 👋' };

function toChatUser(raw) {
  if (!raw) {
    return { id: null, name: 'User', fullName: 'User', firstName: 'User', username: 'user', initials: 'U', role: 'user' };
  }
  const name = raw.fullName || raw.name || (raw.firstName ? `${raw.firstName} ${raw.lastName || ''}`.trim() : raw.username || 'User');
  return {
    id: raw.id,
    name,
    fullName: name,
    firstName: raw.firstName || raw.username || 'User',
    username: raw.username || 'user',
    initials: (raw.firstName ? raw.firstName.slice(0, 1) + (raw.lastName ? raw.lastName.slice(0, 1) : '') : (name || 'U')).slice(0, 2).toUpperCase(),
    role: raw.role || 'user',
  };
}

export default function useChat() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();

  const communityId    = searchParams.get('community') || '';
  const communityName  = decodeURIComponent(searchParams.get('cname')   || 'Community Chat');
  const initialChannel = decodeURIComponent(searchParams.get('channel') || 'general');

  const messagesEndRef = useRef(null);
  const user = toChatUser(useAppSelector(selectCurrentUser));
  const {
    channels, channelsLoading, members, messages, selectedChannelId, sendingMessage,
    msgInput, channelSearch, msgSearchQuery, replyTo, showEmojiPicker, showSearch,
    showPinned, showMembers, muted, deafened,
  } = useAppSelector(selectChat);
  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId) ||
    channels.find((channel) => channel.name === initialChannel || channel.id === initialChannel) ||
    channels[0] || DEFAULT_CHANNELS[0];
  const activeChannel = communityId ? selectedChannel : NO_COMMUNITY_CHANNEL;
  const loading = communityId ? channelsLoading : false;
  const setActiveChannel = (channel) => dispatch(chatUiChanged({ selectedChannelId: channel.id }));

  const setField = (field, update) => dispatch((send, getState) => {
    const value = typeof update === 'function' ? update(getState().chat[field]) : update;
    send(chatUiChanged({ [field]: value }));
  });

  const setMsgInput = (value) => setField('msgInput', value);
  const setChannelSearch = (value) => setField('channelSearch', value);
  const setMsgSearchQuery = (value) => setField('msgSearchQuery', value);
  const setReplyTo = (value) => setField('replyTo', value);
  const setShowEmojiPicker = (value) => setField('showEmojiPicker', value);
  const setShowSearch = (value) => setField('showSearch', value);
  const setShowPinned = (value) => setField('showPinned', value);
  const setShowMembers = (value) => setField('showMembers', value);
  const setMuted = (value) => setField('muted', value);
  const setDeafened = (value) => setField('deafened', value);

  const showToast = (msg) => dispatch(toastShown({ msg }));

  // Channels and members of this community
  useEffect(() => {
    if (communityId) {
      dispatch(fetchChatChannels(communityId));
      dispatch(fetchChatMembers(communityId));
    }
    return () => dispatch(chatCleared());
  }, [dispatch, communityId, initialChannel]);

  // Messages of the active channel of THIS community
  useEffect(() => {
    if (!communityId || !activeChannel?.id) return;
    dispatch(fetchChatMessages({ communityId, channelId: activeChannel.id }));
  }, [dispatch, communityId, activeChannel?.id]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = msgInput.trim();
    // Every message must belong to a real community. Before, a missing
    // communityId fell back to community 1, so messages ended up there.
    if (!text || !activeChannel?.id || !communityId || sendingMessage) return;

    const content = replyTo ? `↩️ ${replyTo}: ${text}` : text;
    setMsgInput('');
    setReplyTo(null);

    try {
      await dispatch(sendChatMessage({
        communityId,
        channelId: activeChannel.id,
        content,
        authorName: user.username || user.firstName || 'User',
      })).unwrap();
    } catch (err) {
      // Keep any new draft text and restore the failed message if the draft is empty.
      setMsgInput(prev => prev || text);
      showToast(`⚠️ Message not sent: ${err.message}`);
    }
  };

  const toggleReaction = async (msgId, emoji) => {
    try {
      await dispatch(toggleChatReaction({ msgId, emoji, actorName: user.username || user.firstName })).unwrap();
    } catch (err) {
      showToast(`⚠️ ${err.message}`);
    }
  };

  const filteredChannels = useAppSelector(selectFilteredChannels);
  const filteredMessages = useAppSelector(selectFilteredMessages);
  const pinnedMessages = useAppSelector(selectPinnedMessages);
  const stats = useAppSelector(selectChatStats);

  const togglePin = (id) => dispatch(togglePinMessage(id));
  const removeMessage = (id) => {
    if (window.confirm('Delete this message?')) dispatch(deleteChatMessage(id));
  };

  return {
    // Identity / routing
    navigate, user, communityId, communityName,
    // Refs
    messagesEndRef,
    // Channel state
    channels, loading, activeChannel, setActiveChannel,
    channelSearch, setChannelSearch,
    filteredChannels,
    // Message state
    messages, filteredMessages,
    members, pinnedMessages, stats,
    msgInput, setMsgInput,
    msgSearchQuery, setMsgSearchQuery,
    replyTo, setReplyTo,
    // UI toggles
    showEmojiPicker, setShowEmojiPicker,
    showSearch, setShowSearch,
    showPinned, setShowPinned,
    showMembers, setShowMembers,
    muted, setMuted,
    deafened, setDeafened,
    // Actions
    sendMessage, toggleReaction, togglePin, removeMessage,
    EMOJIS,
  };
}
